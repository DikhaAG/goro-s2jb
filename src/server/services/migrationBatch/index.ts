import crypto from "crypto";
import fs from "fs";
import path from "path";
import { OcrProcessingStatus, ReviewSource, Role, ValidationStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { BASE_UPLOAD_DIR, confineToRoot } from "@/lib/storage";
import { IMPORT_QUEUE_NAME, importQueue } from "@/server/queues/importQueue";
import { logAuditEvent } from "@/server/services/auditService";
import { extractGoogleDriveFileId } from "@/server/services/evidenceAcquisition";
import { enqueueEvidenceVerification } from "@/server/services/evidenceVerification";
import { systemTelemetry } from "@/server/services/systemTelemetry";
import {
  serializeReviewsToCsv,
  streamSpreadsheetRows,
} from "./spreadsheet";
import type {
  DownloadBatchResult,
  GetBatchDetailsInput,
  IngestBatchInput,
  IngestBatchResult,
  ListBatchErrorsInput,
  ListBatchesInput,
  MigrationActor,
  MigrationBatchDeps,
  RawReviewRow,
  StartMigrationInput,
  StopSignal,
  StoreMigrationUploadInput,
  StoreMigrationUploadResult,
} from "./types";

export type * from "./types";
export {
  isGhostOrBlankRow,
  MIGRATION_CSV_HEADERS,
  normalizeSpreadsheetRow,
  parseExcelOrStandardDate,
  serializeReviewsToCsv,
  streamSpreadsheetRows,
} from "./spreadsheet";

const ALLOWED_MIGRATION_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);
const MIGRATION_UPLOAD_ROLES = new Set<Role>([Role.PEGAWAI, Role.SUPER_ADMIN]);

/**
 * Confines migration source paths to `baseUploadDir` and resolves host-vs-Docker mount prefixes.
 */
export function resolveMigrationFilePath(
  rawPath: string,
  baseUploadDir: string = BASE_UPLOAD_DIR
): { safeAbsolutePath: string; isAllowed: boolean } {
  const confined = confineToRoot(baseUploadDir, rawPath, {
    remapUploadsMount: true,
  });
  return {
    safeAbsolutePath: confined.safeAbsolutePath,
    isAllowed: confined.isAllowed,
  };
}

function assertBatchAccess(
  batch: { uploadedById: string | null },
  actor: MigrationActor,
  options: { allowManager?: boolean; forbiddenMessage?: string } = {}
): void {
  if (actor.role === Role.SUPER_ADMIN) {
    return;
  }
  if (options.allowManager && actor.role === Role.MANAGER) {
    return;
  }
  if (actor.role === Role.PEGAWAI && batch.uploadedById === actor.id) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      options.forbiddenMessage ||
      "Anda tidak memiliki wewenang untuk mengakses batch migrasi ini.",
  });
}

function getDownloadContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".csv") return "text/csv; charset=utf-8";
  if (ext === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (ext === ".xls") return "application/vnd.ms-excel";
  return "application/octet-stream";
}

function resolveBatchRowKeys(row: Pick<RawReviewRow, "evidenceImagePath" | "playstoreReviewerName" | "timestamp" | "ulpName">): string {
  const rawPath = (row.evidenceImagePath || "").trim();
  const driveId = extractGoogleDriveFileId(rawPath);
  const normPath = driveId ? `gdrive:${driveId}` : rawPath.toLowerCase();
  const reviewerName = (row.playstoreReviewerName || "").trim().toLowerCase();

  if (normPath && normPath !== "legacy/gdrive_import") {
    return `img:${normPath}|rev:${reviewerName}`;
  }

  const timeStr =
    row.timestamp instanceof Date && !Number.isNaN(row.timestamp.getTime())
      ? row.timestamp.toISOString()
      : String(row.timestamp || "").trim();
  return `text:${reviewerName}|time:${timeStr}|ulp:${(row.ulpName || "").trim().toLowerCase()}`;
}

export function createMigrationBatch(defaultDeps: MigrationBatchDeps = {}) {
  const resolveDeps = (overrideDeps: MigrationBatchDeps = {}) => ({
    db: overrideDeps.prisma ?? defaultDeps.prisma ?? prisma,
    redisClient: overrideDeps.redis ?? defaultDeps.redis ?? redis,
    baseUploadDir: overrideDeps.baseUploadDir ?? defaultDeps.baseUploadDir ?? BASE_UPLOAD_DIR,
    queue: overrideDeps.importQueue ?? defaultDeps.importQueue ?? importQueue,
    enqueueVerify:
      overrideDeps.enqueueVerification ??
      defaultDeps.enqueueVerification ??
      ((targets, opts) => enqueueEvidenceVerification(targets, opts)),
    recordTelemetry:
      overrideDeps.recordTelemetry ??
      defaultDeps.recordTelemetry ??
      ((ev) => systemTelemetry.record(ev)),
    audit:
      overrideDeps.audit ??
      defaultDeps.audit ??
      ((payload) => logAuditEvent(payload)),
  });

  return {
    async storeUpload(
      actor: MigrationActor,
      input: StoreMigrationUploadInput,
      overrideDeps: MigrationBatchDeps = {}
    ): Promise<StoreMigrationUploadResult> {
      if (!MIGRATION_UPLOAD_ROLES.has(actor.role)) {
        return {
          ok: false,
          status: 403,
          error:
            "Akses ditolak. Hanya Pegawai Triase atau Super Admin yang diizinkan mengunggah berkas migrasi.",
        };
      }

      const originalName = path.basename(input.fileName || "");
      const ext = path.extname(originalName).toLowerCase();
      if (!originalName || !ALLOWED_MIGRATION_EXTENSIONS.has(ext)) {
        return {
          ok: false,
          status: 400,
          error: "Only CSV and XLSX files are supported for migration",
        };
      }

      const { baseUploadDir } = resolveDeps(overrideDeps);
      const uniqueId = crypto.randomBytes(6).toString("hex");
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const relativeTarget = path.posix.join(
        "migration",
        `${Date.now()}_${uniqueId}_${sanitizedName}`
      );
      const confined = confineToRoot(baseUploadDir, relativeTarget);
      if (!confined.isAllowed) {
        return {
          ok: false,
          status: 400,
          error: "Jalur berkas migrasi tidak sah.",
        };
      }

      await fs.promises.mkdir(path.dirname(confined.safeAbsolutePath), { recursive: true });
      await fs.promises.writeFile(confined.safeAbsolutePath, input.bytes);

      return {
        ok: true,
        filePath: confined.safeAbsolutePath,
        relativePath: confined.relativePath,
        fileName: input.fileName,
        fileSize: input.fileSize ?? input.bytes.length,
      };
    },

    async start(
      actor: MigrationActor,
      input: StartMigrationInput,
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db, baseUploadDir, queue, audit } = resolveDeps(overrideDeps);
      const targetType = input.targetType ?? "FORM_RESPONSES_RAW";

      if (targetType !== "FORM_RESPONSES_RAW") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Tipe migrasi HISTORICAL_REPORTS belum didukung; gunakan FORM_RESPONSES_RAW.",
        });
      }

      const { safeAbsolutePath, isAllowed } = resolveMigrationFilePath(
        input.filePath,
        baseUploadDir
      );
      if (!isAllowed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Jalur berkas migrasi harus berada di dalam direktori unggahan resmi.",
        });
      }

      const ext = path.extname(input.fileName).toLowerCase();
      if (!ALLOWED_MIGRATION_EXTENSIONS.has(ext)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Format berkas migrasi harus .csv, .xlsx, atau .xls.",
        });
      }

      const batch = await db.migrationBatch.create({
        data: {
          fileName: input.fileName,
          fileSize: input.fileSize,
          filePath: safeAbsolutePath,
          targetType,
          status: "PENDING",
          uploadedById: actor.id || null,
        },
      });

      await queue.add("process-bulk-import", {
        importBatchId: batch.id,
        filePath: safeAbsolutePath,
        userId: actor.id || "admin_migration",
        startRowNumber: 0,
      });

      await audit({
        userId: actor.id,
        action: "START_MIGRATION",
        entityType: "MigrationBatch",
        entityId: batch.id,
        metadata: {
          fileName: input.fileName,
          fileSize: input.fileSize,
          targetType,
        },
      }).catch(() => {});

      return {
        success: true,
        batchId: batch.id,
        message: "Berkas berhasil dijadwalkan untuk proses migrasi massal di latar belakang",
      };
    },

    async getActiveOrInterrupted(
      actor: MigrationActor,
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db } = resolveDeps(overrideDeps);
      const isSuperAdmin = actor.role === Role.SUPER_ADMIN;

      return db.migrationBatch.findFirst({
        where: {
          ...(isSuperAdmin ? {} : { uploadedById: actor.id }),
          status: { in: ["PROCESSING", "PENDING", "PAUSED"] },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          errors: {
            take: 5,
            orderBy: { createdAt: "desc" },
          },
        },
      });
    },

    async pause(
      actor: MigrationActor,
      batchId: string,
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db, redisClient, audit } = resolveDeps(overrideDeps);
      const batch = await db.migrationBatch.findUnique({ where: { id: batchId } });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      assertBatchAccess(batch, actor, {
        forbiddenMessage: "Anda tidak memiliki wewenang untuk menjeda batch migrasi ini.",
      });

      if (batch.status === "COMPLETED" || batch.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Batch migrasi yang sudah selesai atau dibatalkan tidak dapat dijeda.",
        });
      }

      await redisClient.set(`migration:pause:${batch.id}`, "1", "EX", 3600).catch(() => {});

      await db.migrationBatch.update({
        where: { id: batch.id },
        data: { status: "PAUSED" },
      });

      await audit({
        userId: actor.id,
        action: "PAUSE_MIGRATION",
        entityType: "MigrationBatch",
        entityId: batch.id,
        metadata: { lastProcessedRow: batch.lastProcessedRow },
      }).catch(() => {});

      return {
        success: true,
        message: "Migrasi dijeda",
      };
    },

    async resume(
      actor: MigrationActor,
      batchId: string,
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db, redisClient, baseUploadDir, queue, audit } = resolveDeps(overrideDeps);
      const batch = await db.migrationBatch.findUnique({ where: { id: batchId } });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      assertBatchAccess(batch, actor, {
        forbiddenMessage: "Anda tidak memiliki wewenang untuk melanjutkan batch migrasi ini.",
      });

      if (batch.status === "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Batch migrasi ini telah selesai",
        });
      }

      if (batch.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Batch migrasi yang telah dibatalkan tidak dapat dilanjutkan",
        });
      }

      const { safeAbsolutePath, isAllowed } = resolveMigrationFilePath(
        batch.filePath || "",
        baseUploadDir
      );
      if (!isAllowed || !fs.existsSync(safeAbsolutePath)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Berkas sumber migrasi di server tidak ditemukan atau telah kedaluwarsa",
        });
      }

      if (redisClient.del) {
        await redisClient
          .del(`migration:pause:${batch.id}`, `migration:cancel:${batch.id}`)
          .catch(() => {});
      }

      await db.migrationBatch.update({
        where: { id: batch.id },
        data: { status: "PROCESSING" },
      });

      await queue.add("process-bulk-import", {
        importBatchId: batch.id,
        filePath: safeAbsolutePath,
        userId: actor.id || batch.uploadedById || "admin_migration",
        startRowNumber: batch.lastProcessedRow,
      });

      await audit({
        userId: actor.id,
        action: "RESUME_MIGRATION",
        entityType: "MigrationBatch",
        entityId: batch.id,
        metadata: { resumedFromRow: batch.lastProcessedRow },
      }).catch(() => {});

      return {
        success: true,
        batchId: batch.id,
        resumedFromRow: batch.lastProcessedRow,
        message: `Migrasi dilanjutkan dari baris ke-${batch.lastProcessedRow}`,
      };
    },

    async cancel(
      actor: MigrationActor,
      batchId: string,
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db, redisClient, audit } = resolveDeps(overrideDeps);
      const batch = await db.migrationBatch.findUnique({ where: { id: batchId } });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      assertBatchAccess(batch, actor, {
        forbiddenMessage: "Anda tidak memiliki wewenang untuk membatalkan batch migrasi ini.",
      });

      try {
        await redisClient.set(`migration:cancel:${batch.id}`, "1", "EX", 3600);
      } catch (err) {
        console.warn("Failed to set Redis cancel key:", err);
      }

      await db.migrationBatch.update({
        where: { id: batch.id },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          errorMessage: `Dibatalkan oleh ${actor.name || "pengguna"}`,
        },
      });

      await audit({
        userId: actor.id,
        action: "CANCEL_MIGRATION",
        entityType: "MigrationBatch",
        entityId: batch.id,
        metadata: { lastProcessedRow: batch.lastProcessedRow },
      }).catch(() => {});

      return {
        success: true,
        batchId: batch.id,
        message: "Proses migrasi berhasil dihentikan dan dibatalkan.",
      };
    },

    async getStatus(
      actor: MigrationActor,
      batchId: string,
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db } = resolveDeps(overrideDeps);
      const batch = await db.migrationBatch.findUnique({
        where: { id: batchId },
        include: {
          errors: {
            take: 20,
            orderBy: { rowNumber: "asc" },
          },
        },
      });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      assertBatchAccess(batch, actor, {
        forbiddenMessage: "Anda tidak memiliki akses ke status batch migrasi ini.",
      });

      return batch;
    },

    async list(
      actor: MigrationActor,
      input: ListBatchesInput = {},
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db } = resolveDeps(overrideDeps);
      const isSuperAdmin = actor.role === Role.SUPER_ADMIN;
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 10;
      const status = input.status ?? "ALL";

      const whereClause: Record<string, unknown> = {};
      if (!isSuperAdmin) {
        whereClause.uploadedById = actor.id;
      }
      if (status !== "ALL") {
        whereClause.status = status;
      }

      const skip = (page - 1) * pageSize;

      const [batches, total] = await Promise.all([
        db.migrationBatch.findMany({
          where: whereClause,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
              },
            },
            _count: {
              select: { errors: true },
            },
          },
        }),
        db.migrationBatch.count({ where: whereClause }),
      ]);

      return {
        batches,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        isSuperAdmin,
      };
    },

    async listRecent(
      actor: MigrationActor,
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db } = resolveDeps(overrideDeps);
      const isSuperAdmin = actor.role === Role.SUPER_ADMIN;

      return db.migrationBatch.findMany({
        where: isSuperAdmin ? {} : { uploadedById: actor.id },
        take: 100,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { errors: true },
          },
        },
      });
    },

    async listErrors(
      actor: MigrationActor,
      input: ListBatchErrorsInput,
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db } = resolveDeps(overrideDeps);
      const batch = await db.migrationBatch.findUnique({
        where: { id: input.batchId },
        select: { id: true, uploadedById: true },
      });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      assertBatchAccess(batch, actor, {
        forbiddenMessage: "Anda tidak memiliki akses ke log galat batch migrasi ini.",
      });

      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 20;
      const skip = (page - 1) * pageSize;

      const [errors, total] = await Promise.all([
        db.migrationErrorLog.findMany({
          where: { batchId: input.batchId },
          skip,
          take: pageSize,
          orderBy: { rowNumber: "asc" },
        }),
        db.migrationErrorLog.count({
          where: { batchId: input.batchId },
        }),
      ]);

      return {
        errors,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },

    async getDetails(
      actor: MigrationActor,
      input: GetBatchDetailsInput,
      overrideDeps: MigrationBatchDeps = {}
    ) {
      const { db } = resolveDeps(overrideDeps);
      const batch = await db.migrationBatch.findUnique({
        where: { id: input.batchId },
        include: {
          uploadedBy: {
            select: { id: true, name: true, username: true, role: true },
          },
          _count: {
            select: { errors: true, reviews: true },
          },
        },
      });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      assertBatchAccess(batch, actor, {
        forbiddenMessage: "Anda tidak memiliki akses ke rincian batch ini",
      });

      const rowsPage = input.rowsPage ?? 1;
      const rowsPageSize = input.rowsPageSize ?? 10;

      const startedAtTime = batch.startedAt
        ? new Date(batch.startedAt).getTime()
        : new Date(batch.createdAt).getTime();
      const completedAtTime = batch.completedAt ? new Date(batch.completedAt).getTime() : null;
      const ingestDurationMs = completedAtTime
        ? Math.max(0, completedAtTime - startedAtTime)
        : batch.status === "PROCESSING"
        ? Math.max(0, Date.now() - startedAtTime)
        : null;

      const [
        reviewsAgg,
        ocrCompletedCount,
        ocrProcessingCount,
        ocrQueuedCount,
        ocrFailedCount,
        autoApprovedCount,
        duplicateCount,
      ] = await Promise.all([
        db.ratingReview.aggregate({
          where: { migrationBatchId: input.batchId },
          _avg: { confidenceScore: true },
        }),
        db.ratingReview.count({
          where: { migrationBatchId: input.batchId, ocrStatus: "COMPLETED" },
        }),
        db.ratingReview.count({
          where: {
            migrationBatchId: input.batchId,
            ocrStatus: { in: ["DOWNLOADING", "PROCESSING"] },
          },
        }),
        db.ratingReview.count({
          where: { migrationBatchId: input.batchId, ocrStatus: "QUEUED" },
        }),
        db.ratingReview.count({
          where: { migrationBatchId: input.batchId, ocrStatus: "FAILED" },
        }),
        db.ratingReview.count({
          where: { migrationBatchId: input.batchId, validationStatus: "APPROVED" },
        }),
        db.ratingReview.count({
          where: { migrationBatchId: input.batchId, isDuplicate: true },
        }),
      ]);

      const skip = (rowsPage - 1) * rowsPageSize;
      const [rows, totalRowsCount] = await Promise.all([
        db.ratingReview.findMany({
          where: { migrationBatchId: input.batchId },
          skip,
          take: rowsPageSize,
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            playstoreReviewerName: true,
            entryDate: true,
            timestamp: true,
            confidenceScore: true,
            ocrStatus: true,
            validationStatus: true,
            isDuplicate: true,
            reviewRemarks: true,
            createdAt: true,
            updatedAt: true,
            verifiedAt: true,
            up3: { select: { name: true } },
            ulp: { select: { name: true } },
            appVersion: { select: { version: true } },
          },
        }),
        db.ratingReview.count({
          where: { migrationBatchId: input.batchId },
        }),
      ]);

      const mappedRows = rows.map((r, idx) => {
        const ingestTime = new Date(r.createdAt).getTime();
        const ocrFinishedTime = new Date(r.updatedAt).getTime();
        const rowProcessTimeMs = Math.max(0, ocrFinishedTime - ingestTime);

        return {
          ...r,
          rowSequence: skip + idx + 1,
          rowProcessTimeMs,
        };
      });

      const completedRows = mappedRows.filter((r) => r.ocrStatus === "COMPLETED");
      const avgOcrRowMs =
        completedRows.length > 0
          ? Math.round(
              completedRows.reduce((sum, r) => sum + r.rowProcessTimeMs, 0) /
                completedRows.length
            )
          : 0;

      return {
        batch,
        timings: {
          totalDurationMs: ingestDurationMs,
          ingestDurationMs,
          ocrCompletedCount,
          ocrProcessingCount,
          ocrQueuedCount,
          ocrFailedCount,
          autoApprovedCount,
          duplicateCount,
          avgOcrRowMs,
          averageConfidence: reviewsAgg._avg.confidenceScore
            ? Math.round(reviewsAgg._avg.confidenceScore * 10) / 10
            : 0,
        },
        rows: mappedRows,
        rowsPagination: {
          page: rowsPage,
          pageSize: rowsPageSize,
          total: totalRowsCount,
          totalPages: Math.ceil(totalRowsCount / rowsPageSize),
        },
      };
    },

    async download(
      actor: MigrationActor,
      batchId: string,
      overrideDeps: MigrationBatchDeps = {}
    ): Promise<DownloadBatchResult> {
      const { db, baseUploadDir } = resolveDeps(overrideDeps);
      const batch = await db.migrationBatch.findUnique({
        where: { id: batchId },
      });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan.",
        });
      }

      assertBatchAccess(batch, actor, {
        allowManager: true,
        forbiddenMessage: "Anda tidak memiliki akses untuk mengunduh batch ini.",
      });

      if (batch.filePath) {
        const { safeAbsolutePath, isAllowed } = resolveMigrationFilePath(
          batch.filePath,
          baseUploadDir
        );
        if (isAllowed && fs.existsSync(safeAbsolutePath)) {
          const buffer = await fs.promises.readFile(safeAbsolutePath);
          return {
            kind: "file",
            buffer,
            fileName: batch.fileName,
            contentType: getDownloadContentType(batch.fileName),
          };
        }
      }

      const reviews = await db.ratingReview.findMany({
        where: { migrationBatchId: batchId },
        orderBy: { createdAt: "asc" },
        include: {
          up3: true,
          ulp: true,
          appVersion: true,
        },
      });

      if (reviews.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Berkas fisik tidak tersedia di disk dan tidak ada rekam data terkait.",
        });
      }

      const csvBuffer = serializeReviewsToCsv(reviews);
      const fallbackFileName = batch.fileName.endsWith(".csv")
        ? batch.fileName
        : `${path.parse(batch.fileName).name}.csv`;

      return {
        kind: "csv_fallback",
        buffer: csvBuffer,
        fileName: fallbackFileName,
        contentType: "text/csv; charset=utf-8",
      };
    },

    async ingest(
      input: IngestBatchInput,
      overrideDeps: MigrationBatchDeps = {}
    ): Promise<IngestBatchResult> {
      const {
        db,
        redisClient,
        baseUploadDir,
        enqueueVerify,
        recordTelemetry,
      } = resolveDeps(overrideDeps);
      const jobStartTime = Date.now();
      const { importBatchId, filePath, userId, startRowNumber } = input;

      const existingBatch = await db.migrationBatch.findUnique({
        where: { id: importBatchId },
      });

      if (!existingBatch) {
        return { success: false, reason: "Batch record not found in database" };
      }

      if (existingBatch.status === "CANCELLED") {
        return {
          success: false,
          cancelled: true,
          processedRows: existingBatch.processedRows,
          failedRows: existingBatch.failedRows,
        };
      }

      const { safeAbsolutePath, isAllowed } = resolveMigrationFilePath(
        filePath || existingBatch.filePath || "",
        baseUploadDir
      );

      if (!isAllowed || !fs.existsSync(safeAbsolutePath)) {
        await db.migrationBatch.update({
          where: { id: importBatchId },
          data: {
            status: "FAILED",
            errorMessage: `Berkas sumber tidak ditemukan atau tidak sah: ${filePath}`,
            completedAt: new Date(),
          },
        });
        return { success: false, reason: `File not found on disk: ${filePath}` };
      }

      await db.migrationBatch.update({
        where: { id: importBatchId },
        data: {
          status: "PROCESSING",
          startedAt: existingBatch.startedAt || new Date(),
        },
      });

      try {
        const [allUp3s, allUlps, allVersions] = await Promise.all([
          db.uP3.findMany({ select: { id: true, name: true, code: true } }),
          db.uLP.findMany({ select: { id: true, name: true, code: true, up3Id: true } }),
          db.appVersion.findMany({ select: { id: true, version: true } }),
        ]);

        const up3Map = new Map<string, string>();
        for (const u of allUp3s) {
          up3Map.set(u.name.toUpperCase(), u.id);
          up3Map.set(u.code.toUpperCase(), u.id);
        }

        const ulpMap = new Map<string, { id: string; up3Id: string }>();
        for (const ulp of allUlps) {
          ulpMap.set(ulp.name.toUpperCase(), { id: ulp.id, up3Id: ulp.up3Id });
          ulpMap.set(ulp.code.toUpperCase(), { id: ulp.id, up3Id: ulp.up3Id });
        }

        const versionMap = new Map<string, string>();
        for (const v of allVersions) {
          versionMap.set(v.version.toUpperCase(), v.id);
        }

        const defaultVersionId = allVersions[0]?.id || "";
        const defaultUlp = allUlps[0];
        const defaultUp3 = allUp3s[0];

        let totalProcessedRows = existingBatch.processedRows || 0;
        let totalFailedRows = existingBatch.failedRows || 0;
        let latestCheckpointRow =
          startRowNumber !== undefined && startRowNumber !== null
            ? startRowNumber
            : existingBatch.lastProcessedRow || 0;

        let validUserId: string | null = null;
        if (userId) {
          const userRecord = await db.user.findUnique({
            where: { id: userId },
            select: { id: true },
          });
          if (userRecord) validUserId = userRecord.id;
        }

        const seenRowKeys = new Set<string>();

        const checkControlSignal = async (): Promise<StopSignal> => {
          try {
            const [cancelKey, pauseKey, dbBatch] = await Promise.all([
              redisClient.get(`migration:cancel:${importBatchId}`).catch(() => null),
              redisClient.get(`migration:pause:${importBatchId}`).catch(() => null),
              db.migrationBatch.findUnique({
                where: { id: importBatchId },
                select: { status: true },
              }),
            ]);

            if (cancelKey === "1" || dbBatch?.status === "CANCELLED") {
              return "CANCEL";
            }
            if (pauseKey === "1" || dbBatch?.status === "PAUSED") {
              return "PAUSE";
            }
            return "CONTINUE";
          } catch {
            return "CONTINUE";
          }
        };

        const onBatchInsert = async (batchRows: RawReviewRow[]) => {
          const rawImagePaths = batchRows
            .map((r) => r.evidenceImagePath?.trim())
            .filter((p): p is string => Boolean(p && p !== "legacy/gdrive_import"));

          if (rawImagePaths.length > 0) {
            try {
              const existingMatches = await db.ratingReview.findMany({
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
                const normPath = driveId
                  ? `gdrive:${driveId}`
                  : em.evidenceImagePath.trim().toLowerCase();
                const normName = (em.playstoreReviewerName || "").trim().toLowerCase();
                seenRowKeys.add(`img:${normPath}|rev:${normName}`);
              }
            } catch (dbErr) {
              console.warn("[Batch Migrasi] Failed to pre-fetch existing duplicates:", dbErr);
            }
          }

          const validRows: RawReviewRow[] = [];
          const duplicateRows: RawReviewRow[] = [];

          for (const row of batchRows) {
            const dedupKey = resolveBatchRowKeys(row);
            if (seenRowKeys.has(dedupKey)) {
              duplicateRows.push(row);
            } else {
              seenRowKeys.add(dedupKey);
              validRows.push(row);
            }
          }

          if (duplicateRows.length > 0) {
            totalFailedRows += duplicateRows.length;
            await db.migrationErrorLog
              .createMany({
                data: duplicateRows.map((row) => ({
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
              })
              .catch((e) => {
                console.error("[Batch Migrasi] Failed to log duplicate rows:", e);
              });
          }

          let insertedReviews: {
            id: string;
            evidenceImagePath: string;
            playstoreReviewerName: string;
            validationStatus: ValidationStatus;
          }[] = [];

          if (validRows.length > 0) {
            const ratingData = validRows.map((row) => {
              const ulpEntry =
                ulpMap.get(row.ulpName.toUpperCase()) ||
                ulpMap.get(`ULP ${row.ulpName.toUpperCase()}`) || {
                  id: defaultUlp?.id || "",
                  up3Id: defaultUp3?.id || "",
                };

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
                originalReviewerName:
                  row.originalReviewerName || row.playstoreReviewerName,
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

            insertedReviews = await db.ratingReview.createManyAndReturn({
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

          const verificationTargets = insertedReviews
            .filter(
              (r) =>
                r.evidenceImagePath &&
                r.evidenceImagePath.trim() !== "" &&
                r.evidenceImagePath !== "legacy/gdrive_import"
            )
            .map((r) => ({
              reviewId: r.id,
              evidenceImagePath: r.evidenceImagePath,
              expectedReviewerName: r.playstoreReviewerName,
            }));

          if (verificationTargets.length > 0) {
            await enqueueVerify(verificationTargets, {
              priority: 2,
              markQueuedInDb: false,
            });
          }

          latestCheckpointRow = Math.max(
            ...batchRows.map((r) => r.rowNumber || 0),
            latestCheckpointRow
          );

          await db.migrationBatch.update({
            where: { id: importBatchId },
            data: {
              processedRows: totalProcessedRows,
              failedRows: totalFailedRows,
              lastProcessedRow: latestCheckpointRow,
            },
          });

          if (input.onProgress) {
            await input.onProgress({
              processedRows: totalProcessedRows,
              failedRows: totalFailedRows,
            });
          }
        };

        const onErrorLog = async (err: {
          rowNumber: number;
          raw: string;
          reason: string;
        }) => {
          totalFailedRows++;
          latestCheckpointRow = Math.max(err.rowNumber, latestCheckpointRow);
          try {
            await db.migrationErrorLog.create({
              data: {
                batchId: importBatchId,
                rowNumber: err.rowNumber,
                rawRowData: err.raw,
                errorReason: err.reason,
              },
            });
            await db.migrationBatch.update({
              where: { id: importBatchId },
              data: {
                failedRows: totalFailedRows,
                lastProcessedRow: latestCheckpointRow,
              },
            });
          } catch (e) {
            console.error("[Batch Migrasi] Failed to log error row:", e);
          }
        };

        const ext = path.extname(safeAbsolutePath).toLowerCase();
        if (!ALLOWED_MIGRATION_EXTENSIONS.has(ext)) {
          throw new Error(`Unsupported file extension for migration: ${ext}`);
        }

        const streamResult = await streamSpreadsheetRows(safeAbsolutePath, {
          ext: ext as ".csv" | ".xlsx" | ".xls",
          sheetName: "Form Responses 1",
          batchSize: 1000,
          startRowNumber: latestCheckpointRow,
          checkControlSignal,
          onBatch: onBatchInsert,
          onError: onErrorLog,
        });

        const finalSignal =
          streamResult.stopSignal !== "CONTINUE"
            ? streamResult.stopSignal
            : await checkControlSignal();

        if (finalSignal === "PAUSE") {
          await db.migrationBatch.update({
            where: { id: importBatchId },
            data: {
              status: "PAUSED",
              processedRows: totalProcessedRows,
              failedRows: totalFailedRows,
              lastProcessedRow: latestCheckpointRow,
            },
          });
          return {
            success: false,
            paused: true,
            processedRows: totalProcessedRows,
            failedRows: totalFailedRows,
          };
        }

        if (finalSignal === "CANCEL") {
          await db.migrationBatch.update({
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

        await db.migrationBatch.update({
          where: { id: importBatchId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            totalRows: totalProcessedRows + totalFailedRows,
            processedRows: totalProcessedRows,
            failedRows: totalFailedRows,
          },
        });

        try {
          const syncTimestamp = Date.now().toString();
          await redisClient.set("reports:last_update_timestamp", syncTimestamp);
          await redisClient.set(
            "reports:latest_completed_batch",
            JSON.stringify({
              id: importBatchId,
              fileName: existingBatch.fileName,
              completedAt: new Date().toISOString(),
              processedRows: totalProcessedRows,
            })
          );
        } catch (redisSyncErr: any) {
          console.warn(
            "[Batch Migrasi] Failed to set reports sync flag in Redis:",
            redisSyncErr?.message
          );
        }

        await recordTelemetry({
          kind: "queue_job",
          queue: IMPORT_QUEUE_NAME,
          outcome: "completed",
          durationMs: Date.now() - jobStartTime,
        }).catch(() => {});

        return {
          success: true,
          processedRows: totalProcessedRows,
          failedRows: totalFailedRows,
        };
      } catch (err: any) {
        await recordTelemetry({
          kind: "queue_job",
          queue: IMPORT_QUEUE_NAME,
          outcome: "failed",
        }).catch(() => {});

        try {
          await db.migrationBatch.update({
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
  };
}

export const migrationBatch = createMigrationBatch();
