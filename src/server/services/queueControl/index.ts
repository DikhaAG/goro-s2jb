import { Role } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { logAuditEvent } from "@/server/services/auditService";
import { systemTelemetry } from "@/server/services/systemTelemetry";
import { createBullMqQueueBackend } from "./bullmqAdapter";
import type {
  CleanQueueType,
  CreateWorkerSpec,
  ListQueueJobsInput,
  ListQueueJobsResult,
  QueueActionResult,
  QueueActor,
  QueueControl,
  QueueControlDeps,
  QueueJobRecord,
  QueueName,
  QueueRawStatus,
  QueueWorkerHandle,
  RetryAllFailedResult,
  WorkerJobContext,
} from "./types";

export { createBullMqQueueBackend, resolveBullMqQueueName } from "./bullmqAdapter";
export { createInMemoryQueueAdapter } from "./inMemoryAdapter";
export type * from "./types";

export const REDACTED_FAILURE_REASON =
  "Job gagal diproses. Detail teknis hanya tersedia untuk Super Admin.";

function assertSuperAdmin(actor: QueueActor | null | undefined, forbiddenMessage: string): QueueActor {
  if (actor?.role !== Role.SUPER_ADMIN) {
    throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
  }
  return actor;
}

function resolveExecutor(actor: QueueActor | null | undefined): string | undefined {
  return actor?.username || actor?.name || undefined;
}

function toWorkerJobContext<TData>(job: QueueJobRecord<TData>): WorkerJobContext<TData> {
  const maxAttempts = job.maxAttempts > 0 ? job.maxAttempts : 1;
  const attemptsMade = job.attemptsMade >= 0 ? job.attemptsMade : 0;
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    attemptsMade,
    maxAttempts,
    isFinalAttempt: attemptsMade + 1 >= maxAttempts,
    updateProgress: (progress) => job.updateProgress(progress),
  };
}

/**
 * Deep module owning BullMQ queue operations, SUPER_ADMIN RBAC & payload redaction,
 * audit logging, and worker outcome telemetry behind one seam.
 */
export function createQueueControl(deps: QueueControlDeps = {}): QueueControl {
  const backend = deps.backend ?? createBullMqQueueBackend();
  const audit = deps.audit ?? ((payload) => logAuditEvent(payload));
  const recordTelemetry = deps.recordTelemetry ?? ((event) => systemTelemetry.record(event));
  const now = deps.now ?? (() => Date.now());

  async function safeRecordJobOutcome(
    queue: string,
    outcome: "completed" | "failed",
    durationMs?: number
  ) {
    try {
      await recordTelemetry({
        kind: "queue_job",
        queue,
        outcome,
        ...(durationMs !== undefined ? { durationMs } : {}),
      });
    } catch {
      // Telemetry failures must never crash queue workers.
    }
  }

  return {
    async listJobs(
      actor: QueueActor | null | undefined,
      input: ListQueueJobsInput
    ): Promise<ListQueueJobsResult> {
      const status = input.status ?? "active";
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 10;

      // Payloads hold server paths and user ids, and stack traces hold code paths: Super Admin only.
      const showInternals = actor?.role === Role.SUPER_ADMIN;

      const counts = await backend.getJobCounts(input.queueName);
      const isWaitingQuery = status === "waiting";
      const total = isWaitingQuery
        ? (counts.waiting || 0) + (counts.prioritized || 0)
        : counts[status] || 0;

      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      const statusesToQuery: QueueRawStatus[] = isWaitingQuery
        ? ["waiting", "prioritized"]
        : [status];
      const rawJobs = await backend.getJobs(input.queueName, statusesToQuery, start, end, true);

      const jobs = rawJobs.map((job) => ({
        id: job.id || "unknown",
        name: job.name,
        data: showInternals ? job.data : null,
        progress: job.progress,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason
          ? showInternals
            ? job.failedReason
            : REDACTED_FAILURE_REASON
          : null,
        stacktrace: showInternals && job.stacktrace ? job.stacktrace.slice(0, 3) : [],
      }));

      return {
        jobs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },

    async pauseQueue(
      actor: QueueActor | null | undefined,
      queueName: QueueName
    ): Promise<QueueActionResult> {
      const admin = assertSuperAdmin(
        actor,
        "Hanya Super Admin yang berwenang menjeda antrean worker sistem."
      );
      await backend.pause(queueName);

      await audit({
        userId: admin.id,
        action: "PAUSE_QUEUE",
        entityType: "Queue",
        entityId: queueName,
        metadata: {
          queueName,
          executor: resolveExecutor(admin),
        },
      });

      return {
        success: true,
        message: `Antrean worker ${queueName.toUpperCase()} berhasil dijeda.`,
      };
    },

    async resumeQueue(
      actor: QueueActor | null | undefined,
      queueName: QueueName
    ): Promise<QueueActionResult> {
      const admin = assertSuperAdmin(
        actor,
        "Hanya Super Admin yang berwenang melanjutkan antrean worker sistem."
      );
      await backend.resume(queueName);

      await audit({
        userId: admin.id,
        action: "RESUME_QUEUE",
        entityType: "Queue",
        entityId: queueName,
        metadata: {
          queueName,
          executor: resolveExecutor(admin),
        },
      });

      return {
        success: true,
        message: `Antrean worker ${queueName.toUpperCase()} berhasil dilanjutkan.`,
      };
    },

    async retryJob(
      actor: QueueActor | null | undefined,
      queueName: QueueName,
      jobId: string
    ): Promise<QueueActionResult> {
      const admin = assertSuperAdmin(
        actor,
        "Hanya Super Admin yang berwenang mencoba ulang job worker."
      );
      const job = await backend.getJob(queueName, jobId);

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Job dengan ID ${jobId} tidak ditemukan di antrean.`,
        });
      }

      await job.retry();

      await audit({
        userId: admin.id,
        action: "RETRY_JOB",
        entityType: "Job",
        entityId: jobId,
        metadata: {
          queueName,
          jobId,
          executor: resolveExecutor(admin),
        },
      });

      return {
        success: true,
        message: `Job ${jobId} berhasil dijadwalkan ulang untuk dieksekusi.`,
      };
    },

    async removeJob(
      actor: QueueActor | null | undefined,
      queueName: QueueName,
      jobId: string
    ): Promise<QueueActionResult> {
      const admin = assertSuperAdmin(
        actor,
        "Hanya Super Admin yang berwenang menghapus job worker."
      );
      const job = await backend.getJob(queueName, jobId);

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Job dengan ID ${jobId} tidak ditemukan di antrean.`,
        });
      }

      await job.remove();

      await audit({
        userId: admin.id,
        action: "REMOVE_JOB",
        entityType: "Job",
        entityId: jobId,
        metadata: {
          queueName,
          jobId,
          executor: resolveExecutor(admin),
        },
      });

      return {
        success: true,
        message: `Job ${jobId} berhasil dihapus dari antrean.`,
      };
    },

    async retryAllFailedJobs(
      actor: QueueActor | null | undefined,
      queueName: QueueName
    ): Promise<RetryAllFailedResult> {
      const admin = assertSuperAdmin(
        actor,
        "Hanya Super Admin yang berwenang mencoba ulang seluruh job gagal."
      );
      const failedJobs = await backend.getJobs(queueName, ["failed"], 0, 100);

      await Promise.all(failedJobs.map((j) => j.retry().catch(() => {})));

      await audit({
        userId: admin.id,
        action: "RETRY_ALL_FAILED_JOBS",
        entityType: "Queue",
        entityId: queueName,
        metadata: {
          queueName,
          retriedCount: failedJobs.length,
          executor: resolveExecutor(admin),
        },
      });

      return {
        success: true,
        retriedCount: failedJobs.length,
        message: `${failedJobs.length} job gagal berhasil dijadwalkan ulang.`,
      };
    },

    async cleanQueue(
      actor: QueueActor | null | undefined,
      queueName: QueueName,
      type: CleanQueueType
    ): Promise<QueueActionResult> {
      const admin = assertSuperAdmin(
        actor,
        "Hanya Super Admin yang berwenang membersihkan riwayat antrean."
      );
      await backend.clean(queueName, 0, 1000, type);

      await audit({
        userId: admin.id,
        action: "CLEAN_QUEUE",
        entityType: "Queue",
        entityId: queueName,
        metadata: {
          queueName,
          type,
          executor: resolveExecutor(admin),
        },
      });

      return {
        success: true,
        message: `Riwayat job ${type} pada ${queueName.toUpperCase()} berhasil dibersihkan.`,
      };
    },

    createWorker<TData, TResult>(
      spec: CreateWorkerSpec<TData, TResult>
    ): QueueWorkerHandle<TData, TResult> {
      const queueName = backend.resolveQueueName(spec.queue);
      const label = spec.label ?? queueName;

      const worker = backend.createWorker<TData, TResult>({
        queueName,
        concurrency: spec.concurrency,
        processor: async (job) => {
          const startedAt = now();
          const result = await spec.processor(toWorkerJobContext(job));
          const outcome = spec.classifyResult ? spec.classifyResult(result) : "completed";

          if (outcome === "completed") {
            await safeRecordJobOutcome(queueName, "completed", Math.max(0, now() - startedAt));
          } else if (outcome === "failed") {
            await safeRecordJobOutcome(queueName, "failed");
          }

          return result;
        },
      });

      worker.on("failed", (job, err) => {
        void safeRecordJobOutcome(queueName, "failed");
        console.error(`[${label}] Job ${job?.id} failed with error:`, err);
      });

      worker.on("error", (err) => {
        console.error(`[${label}] BullMQ worker internal error:`, err);
      });

      return worker;
    },
  };
}

export const queueControl = createQueueControl();
