import { router, operatorProcedure } from "../trpc";
import { z } from "zod";
import { systemTelemetry, type SystemTelemetry } from "../services/systemTelemetry";
import { migrationBatch } from "@/server/services/migrationBatch";
import { queueControl, type QueueControl } from "@/server/services/queueControl";

export interface MigrationRouterDeps {
  queueControl?: QueueControl;
  telemetry?: SystemTelemetry;
  batch?: typeof migrationBatch;
}

function batchDeps(ctx: { prisma: any; redis?: any }) {
  return {
    prisma: ctx.prisma,
    ...(ctx.redis ? { redis: ctx.redis } : {}),
  };
}

export function createMigrationRouter(deps: MigrationRouterDeps = {}) {
  const queues = deps.queueControl ?? queueControl;
  const telemetry = deps.telemetry ?? systemTelemetry;
  const batch = deps.batch ?? migrationBatch;

  return router({
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
        return batch.start(ctx.user, input, batchDeps(ctx));
      }),

    getActiveOrInterruptedBatch: operatorProcedure.query(async ({ ctx }) => {
      return batch.getActiveOrInterrupted(ctx.user, batchDeps(ctx));
    }),

    resumeMigration: operatorProcedure
      .input(z.object({ batchId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return batch.resume(ctx.user, input.batchId, batchDeps(ctx));
      }),

    pauseMigration: operatorProcedure
      .input(z.object({ batchId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return batch.pause(ctx.user, input.batchId, batchDeps(ctx));
      }),

    cancelBatch: operatorProcedure
      .input(z.object({ batchId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        return batch.cancel(ctx.user, input.batchId, batchDeps(ctx));
      }),

    getBatchStatus: operatorProcedure
      .input(z.object({ batchId: z.string() }))
      .query(async ({ ctx, input }) => {
        return batch.getStatus(ctx.user, input.batchId, batchDeps(ctx));
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
        return batch.list(ctx.user, input, batchDeps(ctx));
      }),

    listBatches: operatorProcedure.query(async ({ ctx }) => {
      return batch.listRecent(ctx.user, batchDeps(ctx));
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
        return batch.listErrors(ctx.user, input, batchDeps(ctx));
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
        return batch.getDetails(ctx.user, input, batchDeps(ctx));
      }),

    // --- Telemetri Sistem delegates ---

    getWorkerLiveMetrics: operatorProcedure.query(async ({ ctx }) => {
      const isSuperAdmin = ctx.user?.role === "SUPER_ADMIN";
      const snapshot = await telemetry.getWorkerTelemetry("live");
      return {
        isSuperAdmin,
        ...snapshot,
      };
    }),

    getDetailedWorkerStatus: operatorProcedure.query(async ({ ctx }) => {
      const isSuperAdmin = ctx.user?.role === "SUPER_ADMIN";
      const status = await telemetry.getWorkerTelemetry("detailed", {
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
        return telemetry.getTrafficHistory(input.timeRange);
      }),

    // --- Cross-queue operational controls ---

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
        return queues.listJobs(ctx.user, input);
      }),

    pauseQueue: operatorProcedure
      .input(z.object({ queueName: z.enum(["import", "ocr"]) }))
      .mutation(async ({ ctx, input }) => {
        return queues.pauseQueue(ctx.user, input.queueName);
      }),

    resumeQueue: operatorProcedure
      .input(z.object({ queueName: z.enum(["import", "ocr"]) }))
      .mutation(async ({ ctx, input }) => {
        return queues.resumeQueue(ctx.user, input.queueName);
      }),

    retryJob: operatorProcedure
      .input(
        z.object({
          queueName: z.enum(["import", "ocr"]),
          jobId: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return queues.retryJob(ctx.user, input.queueName, input.jobId);
      }),

    removeJob: operatorProcedure
      .input(
        z.object({
          queueName: z.enum(["import", "ocr"]),
          jobId: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return queues.removeJob(ctx.user, input.queueName, input.jobId);
      }),

    retryAllFailedJobs: operatorProcedure
      .input(z.object({ queueName: z.enum(["import", "ocr"]) }))
      .mutation(async ({ ctx, input }) => {
        return queues.retryAllFailedJobs(ctx.user, input.queueName);
      }),

    cleanQueue: operatorProcedure
      .input(
        z.object({
          queueName: z.enum(["import", "ocr"]),
          type: z.enum(["failed", "completed"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return queues.cleanQueue(ctx.user, input.queueName, input.type);
      }),
  });
}

export const migrationRouter = createMigrationRouter();
export type MigrationRouter = typeof migrationRouter;
