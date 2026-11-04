import { Worker, Job } from "bullmq";
import redis from "@/lib/redis";
import prisma from "@/lib/prisma";
import { OcrProcessingStatus, ReviewSource, ValidationStatus } from "@prisma/client";
import { IMPORT_QUEUE_NAME, ImportJobData } from "../queues/importQueue";
import { ocrQueue } from "../queues/ocrQueue";
import { parseCsvStream } from "@/lib/parsers/csvStreamParser";
import { parseXlsxStream } from "@/lib/parsers/xlsxStreamParser";
import { downloadEvidenceImage, isExternalUrl, extractGoogleDriveFileId } from "../services/evidenceDownloader";
import { recordJobCompleted, recordJobFailed } from "../queues/queueTelemetry";
import path from "path";
import fs from "fs";

/**
 * Concurrently processes an array of items with a fixed maximum concurrency limit.
 */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

export function createImportWorker() {
  const worker = new Worker<ImportJobData>(
    IMPORT_QUEUE_NAME,
    async (job: Job<ImportJobData>) => {
      const jobStartTime = Date.now();
      const { importBatchId, filePath, userId, startRowNumber } = job.data;
      console.log(`[Import Worker] Starting batch ${importBatchId} for file ${filePath} (startRow: ${startRowNumber || 0})`);

      // 1. Fetch existing batch to preserve counts if resuming from checkpoint
      const existingBatch = await prisma.migrationBatch.findUnique({
        where: { id: importBatchId },
      });

      if (!existingBatch) {
        console.warn(`[Import Worker] Batch ${importBatchId} not found in database. Discarding orphaned job.`);
        return { success: false, reason: "Batch record not found in database" };
      }

      // Check if file physically exists on server disk
      if (!fs.existsSync(filePath)) {
        console.warn(`[Import Worker] File not found: ${filePath}. Marking batch as FAILED.`);
        await prisma.migrationBatch.update({
          where: { id: importBatchId },
          data: {
            status: "FAILED",
            errorMessage: `Berkas sumber tidak ditemukan pada disk: ${filePath}`,
            completedAt: new Date(),
          },
        });
        return { success: false, reason: `File not found on disk: ${filePath}` };
      }

      // 2. Update batch status to PROCESSING
      await prisma.migrationBatch.update({
        where: { id: importBatchId },
        data: {
          status: "PROCESSING",
          startedAt: existingBatch.startedAt || new Date(),
        },
      });

      try {
        // 2. Pre-fetch reference maps to make batch insertions blazing fast without DB roundtrips
        const allUp3s = await prisma.uP3.findMany({ select: { id: true, name: true, code: true } });
        const allUlps = await prisma.uLP.findMany({ select: { id: true, name: true, code: true, up3Id: true } });
        const allVersions = await prisma.appVersion.findMany({ select: { id: true, version: true } });

        const up3Map = new Map<string, string>();
        allUp3s.forEach((u) => {
          up3Map.set(u.name.toUpperCase(), u.id);
          up3Map.set(u.code.toUpperCase(), u.id);
        });

        const ulpMap = new Map<string, { id: string; up3Id: string }>();
        allUlps.forEach((ulp) => {
          ulpMap.set(ulp.name.toUpperCase(), { id: ulp.id, up3Id: ulp.up3Id });
          ulpMap.set(ulp.code.toUpperCase(), { id: ulp.id, up3Id: ulp.up3Id });
        });

        const versionMap = new Map<string, string>();
        allVersions.forEach((v) => {
          versionMap.set(v.version.toUpperCase(), v.id);
        });
        const defaultVersionId = allVersions[0]?.id || "";

        // Default fallback unit in case an unknown ULP appears
        const defaultUlp = allUlps[0];
        const defaultUp3 = allUp3s[0];

        let totalProcessedRows = existingBatch?.processedRows || 0;
        let totalFailedRows = existingBatch?.failedRows || 0;
        const effectiveStartRow =
          startRowNumber !== undefined && startRowNumber !== null
            ? startRowNumber
            : existingBatch?.lastProcessedRow || 0;

        // Verify submittedById exists in User table
        let validUserId: string | null = null;
        if (userId) {
          const userRecord = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
          });
          if (userRecord) validUserId = userRecord.id;
        }

        // In-memory set to track seen deduplication keys across the entire file stream (Opsi A1)
        const seenRowKeys = new Set<string>();

        const checkCancellation = async (): Promise<boolean> => {
          try {
            const cancelKey = await redis.get(`migration:cancel:${importBatchId}`);
            if (cancelKey === "1") {
              return true;
            }
            const dbBatch = await prisma.migrationBatch.findUnique({
              where: { id: importBatchId },
              select: { status: true },
            });
            return dbBatch?.status === "CANCELLED" || dbBatch?.status === "PAUSED";
          } catch {
            return false;
          }
        };

        const onBatchInsert = async (batchRows: any[]) => {
          // Check cancellation before inserting
          if (await checkCancellation()) {
            return;
          }

          // Pre-fetch existing matches from database to catch inter-batch duplicates
          const rawImagePaths = batchRows
            .map((r) => r.evidenceImagePath?.trim())
            .filter((p): p is string => Boolean(p && p !== "legacy/gdrive_import"));

          if (rawImagePaths.length > 0) {
            try {
              const existingMatches = await prisma.ratingReview.findMany({
                where: {
                  evidenceImagePath: { in: rawImagePaths },
                },
                select: {
                  evidenceImagePath: true,
                  playstoreReviewerName: true,
                },
              });

              for (const em of existingMatches) {
                const driveId = extractGoogleDriveFileId(em.evidenceImagePath);
                const normPath = driveId ? `gdrive:${driveId}` : em.evidenceImagePath.trim().toLowerCase();
                const normName = (em.playstoreReviewerName || "").trim().toLowerCase();
                seenRowKeys.add(`img:${normPath}|rev:${normName}`);
              }
            } catch (dbErr) {
              console.warn("[Import Worker] Failed to pre-fetch existing image duplicates:", dbErr);
            }
          }

          // Separate unique rows from duplicate rows (Opsi A1: Pre-Import Deduplication)
          const validRows: any[] = [];
          const duplicateRows: any[] = [];

          for (const row of batchRows) {
            const rawPath = (row.evidenceImagePath || "").trim();
            const driveId = extractGoogleDriveFileId(rawPath);
            const normPath = driveId ? `gdrive:${driveId}` : rawPath.toLowerCase();
            const reviewerName = (row.playstoreReviewerName || "").trim().toLowerCase();

            let dedupKey: string;
            if (normPath && normPath !== "legacy/gdrive_import") {
              dedupKey = `img:${normPath}|rev:${reviewerName}`;
            } else {
              const timeStr =
                row.timestamp instanceof Date && !isNaN(row.timestamp.getTime())
                  ? row.timestamp.toISOString()
                  : String(row.timestamp || "").trim();
              dedupKey = `text:${reviewerName}|time:${timeStr}|ulp:${(row.ulpName || "").trim().toLowerCase()}`;
            }

            if (seenRowKeys.has(dedupKey)) {
              duplicateRows.push({ row, dedupKey });
            } else {
              seenRowKeys.add(dedupKey);
              validRows.push(row);
            }
          }

          // Log duplicate rows to MigrationErrorLog and increment totalFailedRows (Skipped)
          if (duplicateRows.length > 0) {
            totalFailedRows += duplicateRows.length;
            try {
              await prisma.migrationErrorLog.createMany({
                data: duplicateRows.map(({ row }) => ({
                  batchId: importBatchId,
                  rowNumber: row.rowNumber,
                  rawRowData: JSON.stringify({
                    reviewer: row.playstoreReviewerName,
                    evidence: row.evidenceImagePath,
                    timestamp: row.timestamp,
                    unit: `${row.up3Name} / ${row.ulpName}`,
                  }),
                  errorReason: `Duplikasi Baris Diabaikan: Ulasan [${row.playstoreReviewerName}] dengan eviden gambar identik sudah terdaftar sebelumnya. Baris dilewati (Opsi A1).`,
                })),
              });
            } catch (e) {
              console.error("[Import Worker] Failed to log skipped duplicate rows:", e);
            }
          }

          let insertedReviews: {
            id: string;
            evidenceImagePath: string;
            playstoreReviewerName: string;
            validationStatus: ValidationStatus;
          }[] = [];

          if (validRows.length > 0) {
            // Build rating data payload directly without blocking on external file downloads
            const ratingData = validRows.map((row) => {
              const ulpEntry =
                ulpMap.get(row.ulpName.toUpperCase()) ||
                ulpMap.get(`ULP ${row.ulpName.toUpperCase()}`) ||
                { id: defaultUlp?.id || "", up3Id: defaultUp3?.id || "" };

              const up3Id =
                up3Map.get(row.up3Name.toUpperCase()) ||
                ulpEntry.up3Id ||
                defaultUp3?.id ||
                "";

              const appVersionId =
                versionMap.get(row.versionName.toUpperCase()) || defaultVersionId;

              return {
                timestamp: row.timestamp,
                up3Id,
                ulpId: ulpEntry.id,
                playstoreReviewerName: row.playstoreReviewerName,
                entryDate: row.entryDate,
                evidenceImagePath: row.evidenceImagePath || "legacy/gdrive_import",
                appVersionId,
                originalReviewerName: row.originalReviewerName || row.playstoreReviewerName,
                reviewerCategory: row.reviewerCategory || "Pelanggan",
                fieldNotes: row.fieldNotes || null,
                isDuplicate: row.isDuplicate || false,
                source: ReviewSource.MIGRATION,
                migrationBatchId: importBatchId,
                validationStatus: row.validationStatus || "PENDING",
                ocrStatus:
                  row.evidenceImagePath &&
                  row.evidenceImagePath.trim() !== "" &&
                  row.evidenceImagePath !== "legacy/gdrive_import"
                    ? OcrProcessingStatus.QUEUED
                    : OcrProcessingStatus.COMPLETED,
                reviewRemarks: row.reviewRemarks || null,
                submittedById: validUserId,
              };
            });

            // High-speed bulk insertion returning inserted review records
            insertedReviews = await prisma.ratingReview.createManyAndReturn({
              data: ratingData,
              skipDuplicates: true,
              select: {
                id: true,
                evidenceImagePath: true,
                playstoreReviewerName: true,
                validationStatus: true,
              },
            });

            totalProcessedRows += validRows.length;
          }

          // Non-blocking Tier 2: Asynchronously dispatch only valid reviews with evidence images to OCR background queue
          const ocrJobs = insertedReviews
            .filter(
              (r) =>
                r.evidenceImagePath &&
                r.evidenceImagePath.trim() !== "" &&
                r.evidenceImagePath !== "legacy/gdrive_import"
            )
            .map((r) => ({
              name: "process-ocr",
              data: {
                reviewId: r.id,
                evidenceImagePath: r.evidenceImagePath,
                expectedReviewerName: r.playstoreReviewerName,
              },
              opts: { priority: 2 },
            }));

          if (ocrJobs.length > 0) {
            await ocrQueue.addBulk(ocrJobs);
          }

          const maxRowInBatch = Math.max(
            ...batchRows.map((r: any) => r.rowNumber || 0),
            effectiveStartRow
          );

          await prisma.migrationBatch.update({
            where: { id: importBatchId },
            data: {
              processedRows: totalProcessedRows,
              failedRows: totalFailedRows,
              lastProcessedRow: maxRowInBatch,
            },
          });

          await job.updateProgress({ processedRows: totalProcessedRows, failedRows: totalFailedRows });
        };

        const onErrorLog = async (err: { rowNumber: number; raw: any; reason: string }) => {
          totalFailedRows++;
          try {
            await prisma.migrationErrorLog.create({
              data: {
                batchId: importBatchId,
                rowNumber: err.rowNumber,
                rawRowData: typeof err.raw === "string" ? err.raw : JSON.stringify(err.raw),
                errorReason: err.reason,
              },
            });
            await prisma.migrationBatch.update({
              where: { id: importBatchId },
              data: {
                failedRows: totalFailedRows,
                lastProcessedRow: Math.max(err.rowNumber, effectiveStartRow),
              },
            });
          } catch (e) {
            console.error("Failed to log migration error row:", e);
          }
        };

        const ext = path.extname(filePath).toLowerCase();

        if (ext === ".csv") {
          await parseCsvStream(filePath, {
            batchSize: 1000,
            startRowNumber: effectiveStartRow,
            shouldAbort: checkCancellation,
            onBatch: onBatchInsert,
            onError: onErrorLog,
          });
        } else if (ext === ".xlsx" || ext === ".xls") {
          await parseXlsxStream(filePath, {
            sheetName: "Form Responses 1",
            batchSize: 1000,
            startRowNumber: effectiveStartRow,
            shouldAbort: checkCancellation,
            onBatch: onBatchInsert,
            onError: onErrorLog,
          });
        } else {
          throw new Error(`Unsupported file extension for migration: ${ext}`);
        }

        // Check if aborted mid-way
        if (await checkCancellation()) {
          console.log(`[Import Worker] Batch ${importBatchId} was cancelled by user.`);
          await prisma.migrationBatch.update({
            where: { id: importBatchId },
            data: {
              status: "CANCELLED",
              completedAt: new Date(),
              errorMessage: "Dibatalkan oleh pengguna",
            },
          });
          return {
            success: false,
            cancelled: true,
            processedRows: totalProcessedRows,
            failedRows: totalFailedRows,
          };
        }

        // 3. Mark batch as COMPLETED
        await prisma.migrationBatch.update({
          where: { id: importBatchId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            totalRows: totalProcessedRows + totalFailedRows,
            processedRows: totalProcessedRows,
            failedRows: totalFailedRows,
          },
        });

        // 4. Pastikan semua ulasan pada batch migrasi ini dengan skor OCR >= 90% otomatis menjadi APPROVED (True)
        try {
          const autoApproved = await prisma.ratingReview.updateMany({
            where: {
              migrationBatchId: importBatchId,
              confidenceScore: { gte: 90.0 },
              isDuplicate: false,
              validationStatus: { not: "APPROVED" },
            },
            data: {
              validationStatus: "APPROVED",
              verifiedAt: new Date(),
              reviewRemarks: "Verifikasi Otomatis AI (Skor OCR >= 90%, Zona Hijau Valid)",
            },
          });
          if (autoApproved.count > 0) {
            console.log(
              `[Import Worker] Batch ${importBatchId}: ${autoApproved.count} baris zona hijau (>=90%) otomatis disetujui (APPROVED / True).`
            );
          }
        } catch (syncErr: any) {
          console.warn(`[Import Worker] Failed green-zone auto-approval sync:`, syncErr.message);
        }

        console.log(
          `[Import Worker] Batch ${importBatchId} completed successfully! Processed: ${totalProcessedRows}, Errors: ${totalFailedRows}`
        );

        const jobDurationMs = Date.now() - jobStartTime;
        recordJobCompleted(IMPORT_QUEUE_NAME, jobDurationMs);

        return {
          success: true,
          processedRows: totalProcessedRows,
          failedRows: totalFailedRows,
        };
      } catch (err: any) {
        recordJobFailed(IMPORT_QUEUE_NAME);
        console.error(`[Import Worker] Batch ${importBatchId} failed:`, err);
        try {
          await prisma.migrationBatch.update({
            where: { id: importBatchId },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              errorMessage: err.message || "Unknown worker error",
            },
          });
        } catch {
          // Ignore if batch record was already removed
        }
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 1, // Run 1 heavy migration job at a time to keep memory super lean
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Import Worker] Job ${job?.id} failed with error:`, err);
  });

  worker.on("error", (err) => {
    console.error(`[Import Worker] BullMQ worker internal error:`, err);
  });

  return worker;
}

if (require.main === module) {
  console.log("🚀 Starting standalone GORO S2JB Import Worker...");
  const worker = createImportWorker();

  process.on("uncaughtException", (err) => {
    console.error("[Import Worker] Uncaught Exception:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Import Worker] Unhandled Rejection:", reason);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down Import Worker...");
    await worker.close();
    process.exit(0);
  });
}
