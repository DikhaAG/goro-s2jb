import { Worker, Job } from "bullmq";
import redis from "@/lib/redis";
import prisma from "@/lib/prisma";
import { IMPORT_QUEUE_NAME, ImportJobData } from "../queues/importQueue";
import { parseCsvStream } from "@/lib/parsers/csvStreamParser";
import { parseXlsxStream } from "@/lib/parsers/xlsxStreamParser";
import path from "path";

export function createImportWorker() {
  const worker = new Worker<ImportJobData>(
    IMPORT_QUEUE_NAME,
    async (job: Job<ImportJobData>) => {
      const { importBatchId, filePath, userId, startRowNumber } = job.data;
      console.log(`[Import Worker] Starting batch ${importBatchId} for file ${filePath} (startRow: ${startRowNumber || 0})`);

      // 1. Fetch existing batch to preserve counts if resuming from checkpoint
      const existingBatch = await prisma.migrationBatch.findUnique({
        where: { id: importBatchId },
      });

      // 2. Update batch status to PROCESSING
      await prisma.migrationBatch.update({
        where: { id: importBatchId },
        data: {
          status: "PROCESSING",
          startedAt: existingBatch?.startedAt || new Date(),
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

        const onBatchInsert = async (batchRows: any[]) => {
          const ratingData = batchRows.map((row) => {
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
              validationStatus: row.validationStatus || "PENDING",
              reviewRemarks: row.reviewRemarks || null,
              submittedById: userId || null,
            };
          });

          await prisma.ratingReview.createMany({
            data: ratingData,
            skipDuplicates: true,
          });

          const maxRowInBatch = Math.max(
            ...batchRows.map((r: any) => r.rowNumber || 0),
            effectiveStartRow
          );
          totalProcessedRows += batchRows.length;
          await prisma.migrationBatch.update({
            where: { id: importBatchId },
            data: {
              processedRows: totalProcessedRows,
              lastProcessedRow: maxRowInBatch,
            },
          });

          await job.updateProgress({ processedRows: totalProcessedRows });
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
            batchSize: 2000,
            startRowNumber: effectiveStartRow,
            onBatch: onBatchInsert,
            onError: onErrorLog,
          });
        } else if (ext === ".xlsx" || ext === ".xls") {
          await parseXlsxStream(filePath, {
            sheetName: "Form Responses 1",
            batchSize: 2000,
            startRowNumber: effectiveStartRow,
            onBatch: onBatchInsert,
            onError: onErrorLog,
          });
        } else {
          throw new Error(`Unsupported file extension for migration: ${ext}`);
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

        console.log(
          `[Import Worker] Batch ${importBatchId} completed successfully! Processed: ${totalProcessedRows}, Errors: ${totalFailedRows}`
        );

        return {
          success: true,
          processedRows: totalProcessedRows,
          failedRows: totalFailedRows,
        };
      } catch (err: any) {
        console.error(`[Import Worker] Batch ${importBatchId} failed:`, err);
        await prisma.migrationBatch.update({
          where: { id: importBatchId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorMessage: err.message || "Unknown worker error",
          },
        });
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

  return worker;
}

if (require.main === module) {
  console.log("🚀 Starting standalone GORO S2JB Import Worker...");
  const worker = createImportWorker();

  process.on("SIGINT", async () => {
    console.log("Shutting down Import Worker...");
    await worker.close();
    process.exit(0);
  });
}
