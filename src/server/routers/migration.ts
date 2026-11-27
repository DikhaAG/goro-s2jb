import { router, operatorProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { importQueue } from "../queues/importQueue";
import { systemTelemetry } from "../services/systemTelemetry";
import { logAuditEvent } from "@/server/services/auditService";
import { migrationBatch } from "@/server/services/migrationBatch";

async function resolveAdminQueue(role: string | undefined, queueName: "import" | "ocr", forbiddenMessage: string) {
  if (role !== "SUPER_ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
  }
  if (queueName === "import") {
    return importQueue;
  }
  const { ocrQueue } = await import("../queues/ocrQueue");
  return ocrQueue;
}

const REDACTED_FAILURE_REASON = "Job gagal diproses. Detail teknis hanya tersedia untuk Super Admin.";

function batchDeps(ctx: { prisma: any; redis?: any }) {
  return {
    prisma: ctx.prisma,
    ...(ctx.redis ? { redis: ctx.redis } : {}),
  };
}

export const migrationRouter = router({
  startMigration: operatorProcedure
    .input(
      z.object({
        filePath: z.string().min(1),
        fileName: z.string().min(1),
        fileSize: z.number().int().positive(),
        targetType: z.enum(["FORM_RESPONSES_RAW", "HISTORICAL_REPORTS"]).default("FORM_RESPONSES_RAW"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return migrationBatch.start(ctx.user, input, batchDeps(ctx));
    }),

  getActiveOrInterruptedBatch: operatorProcedure.query(async ({ ctx }) => {
    return migrationBatch.getActiveOrInterrupted(ctx.user, batchDeps(ctx));
  }),

  resumeMigration: operatorProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return migrationBatch.resume(ctx.user, input.batchId, batchDeps(ctx));
    }),

  pauseMigration: operatorProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return migrationBatch.pause(ctx.user, input.batchId, batchDeps(ctx));
    }),

  cancelBatch: operatorProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return migrationBatch.cancel(ctx.user, input.batchId, batchDeps(ctx));
    }),

  getBatchStatus: operatorProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      return migrationBatch.getStatus(ctx.user, input.batchId, batchDeps(ctx));
    }),

  getMonitorBatches: operatorProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(10),
          status: z
            .enum(["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "PAUSED", "CANCELLED"])
            .default("ALL"),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      return migrationBatch.list(ctx.user, input, batchDeps(ctx));
    }),

  listBatches: operatorProcedure.query(async ({ ctx }) => {
    return migrationBatch.listRecent(ctx.user, batchDeps(ctx));
  }),

  getBatchErrorLogs: operatorProcedure
    .input(
      z.object({
        batchId: z.string().min(1),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      return migrationBatch.listErrors(ctx.user, input, batchDeps(ctx));
    }),

  getBatchDetails: operatorProcedure
    .input(
      z.object({
        batchId: z.string().min(1),
        rowsPage: z.number().int().min(1).default(1),
        rowsPageSize: z.number().int().min(1).max(100).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      return migrationBatch.getDetails(ctx.user, input, batchDeps(ctx));
    }),

  // --- Telemetri Sistem delegates ---

  getWorkerLiveMetrics: operatorProcedure.query(async ({ ctx }) => {
    const isSuperAdmin = ctx.user?.role === "SUPER_ADMIN";
    const snapshot = await systemTelemetry.getWorkerTelemetry("live");
    return {
      isSuperAdmin,
      ...snapshot,
    };
  }),

  getDetailedWorkerStatus: operatorProcedure.query(async ({ ctx }) => {
    const isSuperAdmin = ctx.user?.role === "SUPER_ADMIN";
    const status = await systemTelemetry.getWorkerTelemetry("detailed", {
      includeStalledIds: isSuperAdmin,
    });
    return {
      isSuperAdmin,
      ...status,
    };
  }),

  getNetworkTrafficHistory: operatorProcedure
    .input(
      z.object({
        timeRange: z.enum(["HOUR", "DAY", "MONTH", "YEAR"]).default("HOUR"),
      })
    )
    .query(async ({ input }) => {
      return systemTelemetry.getTrafficHistory(input.timeRange);
    }),

  // --- Cross-queue BullMQ operational controls ---

  getQueueJobs: operatorProcedure
    .input(
      z.object({
        queueName: z.enum(["import", "ocr"]),
        status: z.enum(["active", "waiting", "failed", "completed", "delayed"]).default("active"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { ocrQueue } = await import("../queues/ocrQueue");
      const targetQueue = input.queueName === "import" ? importQueue : ocrQueue;
      // Payloads hold server paths and user ids, and stack traces hold code paths: Super Admin only.
      const showInternals = ctx.user.role === "SUPER_ADMIN";

      const counts = await targetQueue.getJobCounts();
      const isWaitingQuery = input.status === "waiting";
      const totalCount = isWaitingQuery
        ? (counts.waiting || 0) + (counts.prioritized || 0)
        : counts[input.status] || 0;

      const start = (input.page - 1) * input.pageSize;
      const end = start + input.pageSize - 1;
      const statusesToQuery: any[] = isWaitingQuery ? ["waiting", "prioritized"] : [input.status];
      const rawJobs = await targetQueue.getJobs(statusesToQuery, start, end, true);

      const jobs = rawJobs.map((job) => ({
        id: job.id || "unknown",
        name: job.name,
        data: showInternals ? job.data : null,
        progress: job.progress,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason ? (showInternals ? job.failedReason : REDACTED_FAILURE_REASON) : null,
        stacktrace: showInternals && job.stacktrace ? job.stacktrace.slice(0, 3) : [],
      }));

      return {
        jobs,
        total: totalCount,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(totalCount / input.pageSize),
      };
    }),

  pauseQueue: operatorProcedure
    .input(z.object({ queueName: z.enum(["import", "ocr"]) }))
    .mutation(async ({ ctx, input }) => {
      const targetQueue = await resolveAdminQueue(
        ctx.user?.role,
        input.queueName,
        "Hanya Super Admin yang berwenang menjeda antrean worker sistem."
      );
      await targetQueue.pause();

      await logAuditEvent({
        userId: ctx.user?.id,
        action: "PAUSE_QUEUE",
        entityType: "Queue",
        entityId: input.queueName,
        metadata: {
          queueName: input.queueName,
          executor: ctx.user?.username || ctx.user?.name,
        },
      });

      return {
        success: true,
        message: `Antrean worker ${input.queueName.toUpperCase()} berhasil dijeda.`,
      };
    }),

  resumeQueue: operatorProcedure
    .input(z.object({ queueName: z.enum(["import", "ocr"]) }))
    .mutation(async ({ ctx, input }) => {
      const targetQueue = await resolveAdminQueue(
        ctx.user?.role,
        input.queueName,
        "Hanya Super Admin yang berwenang melanjutkan antrean worker sistem."
      );
      await targetQueue.resume();

      await logAuditEvent({
        userId: ctx.user?.id,
        action: "RESUME_QUEUE",
        entityType: "Queue",
        entityId: input.queueName,
        metadata: {
          queueName: input.queueName,
          executor: ctx.user?.username || ctx.user?.name,
        },
      });

      return {
        success: true,
        message: `Antrean worker ${input.queueName.toUpperCase()} berhasil dilanjutkan.`,
      };
    }),

  retryJob: operatorProcedure
    .input(
      z.object({
        queueName: z.enum(["import", "ocr"]),
        jobId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const targetQueue = await resolveAdminQueue(
        ctx.user?.role,
        input.queueName,
        "Hanya Super Admin yang berwenang mencoba ulang job worker."
      );
      const job = await targetQueue.getJob(input.jobId);

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Job dengan ID ${input.jobId} tidak ditemukan di antrean.`,
        });
      }

      await job.retry();

      await logAuditEvent({
        userId: ctx.user?.id,
        action: "RETRY_JOB",
        entityType: "Job",
        entityId: input.jobId,
        metadata: {
          queueName: input.queueName,
          jobId: input.jobId,
          executor: ctx.user?.username || ctx.user?.name,
        },
      });

      return {
        success: true,
        message: `Job ${input.jobId} berhasil dijadwalkan ulang untuk dieksekusi.`,
      };
    }),

  removeJob: operatorProcedure
    .input(
      z.object({
        queueName: z.enum(["import", "ocr"]),
        jobId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const targetQueue = await resolveAdminQueue(
        ctx.user?.role,
        input.queueName,
        "Hanya Super Admin yang berwenang menghapus job worker."
      );
      const job = await targetQueue.getJob(input.jobId);

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Job dengan ID ${input.jobId} tidak ditemukan di antrean.`,
        });
      }

      await job.remove();

      await logAuditEvent({
        userId: ctx.user?.id,
        action: "REMOVE_JOB",
        entityType: "Job",
        entityId: input.jobId,
        metadata: {
          queueName: input.queueName,
          jobId: input.jobId,
          executor: ctx.user?.username || ctx.user?.name,
        },
      });

      return {
        success: true,
        message: `Job ${input.jobId} berhasil dihapus dari antrean.`,
      };
    }),

  retryAllFailedJobs: operatorProcedure
    .input(z.object({ queueName: z.enum(["import", "ocr"]) }))
    .mutation(async ({ ctx, input }) => {
      const targetQueue = await resolveAdminQueue(
        ctx.user?.role,
        input.queueName,
        "Hanya Super Admin yang berwenang mencoba ulang seluruh job gagal."
      );
      const failedJobs = await targetQueue.getJobs(["failed"], 0, 100);

      await Promise.all(failedJobs.map((j) => j.retry().catch(() => {})));

      await logAuditEvent({
        userId: ctx.user?.id,
        action: "RETRY_ALL_FAILED_JOBS",
        entityType: "Queue",
        entityId: input.queueName,
        metadata: {
          queueName: input.queueName,
          retriedCount: failedJobs.length,
          executor: ctx.user?.username || ctx.user?.name,
        },
      });

      return {
        success: true,
        retriedCount: failedJobs.length,
        message: `${failedJobs.length} job gagal berhasil dijadwalkan ulang.`,
      };
    }),

  cleanQueue: operatorProcedure
    .input(
      z.object({
        queueName: z.enum(["import", "ocr"]),
        type: z.enum(["failed", "completed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const targetQueue = await resolveAdminQueue(
        ctx.user?.role,
        input.queueName,
        "Hanya Super Admin yang berwenang membersihkan riwayat antrean."
      );
      await targetQueue.clean(0, 1000, input.type);

      await logAuditEvent({
        userId: ctx.user?.id,
        action: "CLEAN_QUEUE",
        entityType: "Queue",
        entityId: input.queueName,
        metadata: {
          queueName: input.queueName,
          type: input.type,
          executor: ctx.user?.username || ctx.user?.name,
        },
      });

      return {
        success: true,
        message: `Riwayat job ${input.type} pada ${input.queueName.toUpperCase()} berhasil dibersihkan.`,
      };
    }),
});
