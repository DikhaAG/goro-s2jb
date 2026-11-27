import { Worker, type Job, type JobProgress, type Queue } from "bullmq";
import redis from "@/lib/redis";
import { IMPORT_QUEUE_NAME, importQueue } from "@/server/queues/importQueue";
import { OCR_QUEUE_NAME } from "@/server/queues/ocrQueue";
import type {
  CleanQueueType,
  QueueBackendPort,
  QueueJobRecord,
  QueueName,
  QueueRawStatus,
  QueueWorkerHandle,
  QueueWorkerOptions,
} from "./types";

export interface BullMqBackendDeps {
  queues?: {
    import?: Queue<any>;
    ocr?: Queue<any>;
  };
}

function toQueueJobRecord<TData = unknown>(job: Job<TData>): QueueJobRecord<TData> {
  return {
    id: job.id || "unknown",
    name: job.name,
    data: job.data,
    progress: job.progress,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    attemptsMade: job.attemptsMade,
    maxAttempts: typeof job.opts?.attempts === "number" ? job.opts.attempts : 1,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace ?? undefined,
    retry: () => job.retry(),
    remove: () => job.remove(),
    updateProgress: (progress) => job.updateProgress(progress as JobProgress),
  };
}

export function resolveBullMqQueueName(queue: QueueName | string): string {
  if (queue === "import") return IMPORT_QUEUE_NAME;
  if (queue === "ocr") return OCR_QUEUE_NAME;
  return queue;
}

/**
 * BullMQ implementation of QueueBackendPort backed by the application Redis queues and Workers.
 */
export function createBullMqQueueBackend(deps: BullMqBackendDeps = {}): QueueBackendPort {
  async function getQueue(queue: QueueName | string): Promise<Queue<any>> {
    if (queue === "import" || queue === IMPORT_QUEUE_NAME) {
      return deps.queues?.import ?? importQueue;
    }
    if (queue === "ocr" || queue === OCR_QUEUE_NAME) {
      if (deps.queues?.ocr) return deps.queues.ocr;
      const { ocrQueue } = await import("@/server/queues/ocrQueue");
      return ocrQueue;
    }
    throw new Error(`Unknown BullMQ queue target: ${queue}`);
  }

  return {
    resolveQueueName: resolveBullMqQueueName,

    async getJobCounts(queue) {
      const target = await getQueue(queue);
      return target.getJobCounts();
    },

    async getJobs(queue, statuses: QueueRawStatus[], start, end, asc = true) {
      const target = await getQueue(queue);
      const rawJobs = await target.getJobs(statuses as any[], start, end, asc);
      return rawJobs.map((job) => toQueueJobRecord(job));
    },

    async getJob(queue, jobId) {
      const target = await getQueue(queue);
      const job = await target.getJob(jobId);
      return job ? toQueueJobRecord(job) : null;
    },

    async pause(queue) {
      const target = await getQueue(queue);
      await target.pause();
    },

    async resume(queue) {
      const target = await getQueue(queue);
      await target.resume();
    },

    async isPaused(queue) {
      const target = await getQueue(queue);
      return target.isPaused();
    },

    async clean(queue, graceMs, limit, type: CleanQueueType) {
      const target = await getQueue(queue);
      await target.clean(graceMs, limit, type);
    },

    createWorker<TData, TResult>(
      options: QueueWorkerOptions<TData, TResult>
    ): QueueWorkerHandle<TData, TResult> {
      const worker = new Worker<TData, TResult>(
        options.queueName,
        async (job: Job<TData>) => options.processor(toQueueJobRecord(job)),
        {
          connection: redis,
          concurrency: options.concurrency,
        }
      );
      return worker as unknown as QueueWorkerHandle<TData, TResult>;
    },
  };
}
