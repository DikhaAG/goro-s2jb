import { EventEmitter } from "events";
import { IMPORT_QUEUE_NAME } from "@/server/queues/importQueue";
import { OCR_QUEUE_NAME } from "@/server/queues/ocrQueue";
import type {
  CleanQueueType,
  QueueBackendPort,
  QueueJobProgress,
  QueueJobRecord,
  QueueName,
  QueueRawStatus,
  QueueWorkerHandle,
  QueueWorkerOptions,
} from "./types";

export interface InMemorySeedJobInput<TData = object> {
  id?: string;
  name: string;
  data: TData;
  status?: QueueRawStatus;
  progress?: QueueJobProgress;
  timestamp?: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade?: number;
  maxAttempts?: number;
  failedReason?: string | null;
  stacktrace?: string[];
  priority?: number;
}

interface StoredJob<TData = object> {
  id: string;
  name: string;
  data: TData;
  status: QueueRawStatus;
  progress: QueueJobProgress;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
  maxAttempts: number;
  failedReason: string | null;
  stacktrace: string[];
  priority: number;
  order: number;
}

interface InMemoryQueueBucket {
  paused: boolean;
  jobs: Map<string, StoredJob>;
  workers: Set<{
    closed: boolean;
    emitter: EventEmitter;
    processor: (job: QueueJobRecord<any>) => Promise<any>;
  }>;
}

export interface InMemoryQueueAdapter extends QueueBackendPort {
  addJob<TData extends object = object>(
    queue: QueueName | string,
    name: string,
    data: TData,
    opts?: { id?: string; attempts?: number; priority?: number }
  ): Promise<QueueJobRecord<TData>>;
  seedJob<TData extends object = object>(
    queue: QueueName | string,
    input: InMemorySeedJobInput<TData>
  ): QueueJobRecord<TData>;
  drain(
    queue: QueueName | string,
    opts?: { maxJobs?: number }
  ): Promise<{ processed: number; completed: number; failed: number }>;
}

function resolveName(queue: QueueName | string): string {
  if (queue === "import") return IMPORT_QUEUE_NAME;
  if (queue === "ocr") return OCR_QUEUE_NAME;
  return queue;
}

/**
 * In-memory QueueBackendPort adapter supporting queue inspection/control, job lifecycle,
 * and deterministic worker execution for tests without Redis or BullMQ.
 */
export function createInMemoryQueueAdapter(now: () => number = () => Date.now()): InMemoryQueueAdapter {
  const buckets = new Map<string, InMemoryQueueBucket>();
  let nextSeq = 1;

  function getBucket(queue: QueueName | string): InMemoryQueueBucket {
    const key = resolveName(queue);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { paused: false, jobs: new Map(), workers: new Set() };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  function toRecord<TData extends object = object>(
    bucket: InMemoryQueueBucket,
    stored: StoredJob<TData>
  ): QueueJobRecord<TData> {
    return {
      id: stored.id,
      name: stored.name,
      data: stored.data,
      progress: stored.progress,
      timestamp: stored.timestamp,
      processedOn: stored.processedOn,
      finishedOn: stored.finishedOn,
      attemptsMade: stored.attemptsMade,
      maxAttempts: stored.maxAttempts,
      failedReason: stored.failedReason,
      stacktrace: [...stored.stacktrace],
      async retry() {
        stored.status = stored.priority > 0 ? "prioritized" : "waiting";
        stored.failedReason = null;
        stored.stacktrace = [];
        stored.finishedOn = undefined;
        stored.processedOn = undefined;
      },
      async remove() {
        bucket.jobs.delete(stored.id);
      },
      async updateProgress(progress) {
        stored.progress = progress;
      },
    };
  }

  function insertJob<TData extends object = object>(
    queue: QueueName | string,
    input: InMemorySeedJobInput<TData>
  ): QueueJobRecord<TData> {
    const bucket = getBucket(queue);
    const seq = nextSeq++;
    const id = input.id ?? `mem-job-${seq}`;
    const priority = input.priority ?? 0;
    const status: QueueRawStatus =
      input.status ?? (priority > 0 ? "prioritized" : "waiting");

    const stored: StoredJob<TData> = {
      id,
      name: input.name,
      data: input.data,
      status,
      progress: input.progress ?? 0,
      timestamp: input.timestamp ?? now(),
      processedOn: input.processedOn,
      finishedOn: input.finishedOn,
      attemptsMade: input.attemptsMade ?? 0,
      maxAttempts: input.maxAttempts ?? 1,
      failedReason: input.failedReason ?? null,
      stacktrace: input.stacktrace ? [...input.stacktrace] : [],
      priority,
      order: seq,
    };
    bucket.jobs.set(id, stored);
    return toRecord(bucket, stored);
  }

  return {
    resolveQueueName: resolveName,

    async addJob(queue, name, data, opts = {}) {
      return insertJob(queue, {
        id: opts.id,
        name,
        data,
        maxAttempts: opts.attempts ?? 1,
        priority: opts.priority ?? 0,
      });
    },

    seedJob(queue, input) {
      return insertJob(queue, input);
    },

    async getJobCounts(queue) {
      const bucket = getBucket(queue);
      const counts: Record<string, number> = {
        active: 0,
        waiting: 0,
        prioritized: 0,
        failed: 0,
        completed: 0,
        delayed: 0,
        paused: 0,
      };
      for (const job of bucket.jobs.values()) {
        counts[job.status] = (counts[job.status] ?? 0) + 1;
      }
      return counts;
    },

    async getJobs(queue, statuses, start, end, asc = true) {
      const bucket = getBucket(queue);
      const statusSet = new Set<QueueRawStatus>(statuses);
      const matched = Array.from(bucket.jobs.values()).filter((j) => statusSet.has(j.status));
      matched.sort((a, b) => (asc ? a.order - b.order : b.order - a.order));
      return matched.slice(start, end + 1).map((job) => toRecord(bucket, job));
    },

    async getJob(queue, jobId) {
      const bucket = getBucket(queue);
      const found = bucket.jobs.get(jobId);
      return found ? toRecord(bucket, found) : null;
    },

    async pause(queue) {
      getBucket(queue).paused = true;
    },

    async resume(queue) {
      getBucket(queue).paused = false;
    },

    async isPaused(queue) {
      return getBucket(queue).paused;
    },

    async clean(queue, graceMs, limit, type: CleanQueueType) {
      const bucket = getBucket(queue);
      const cutoff = now() - graceMs;
      let removed = 0;
      for (const [id, job] of bucket.jobs.entries()) {
        if (removed >= limit) break;
        if (job.status !== type) continue;
        const jobTime = job.finishedOn ?? job.timestamp;
        if (graceMs <= 0 || jobTime <= cutoff) {
          bucket.jobs.delete(id);
          removed++;
        }
      }
    },

    createWorker<TData, TResult>(
      options: QueueWorkerOptions<TData, TResult>
    ): QueueWorkerHandle<TData, TResult> {
      const bucket = getBucket(options.queueName);
      const emitter = new EventEmitter();
      const entry = {
        closed: false,
        emitter,
        processor: options.processor,
      };
      bucket.workers.add(entry);

      const handle: QueueWorkerHandle<TData, TResult> = {
        on(event: any, listener: any) {
          emitter.on(event, listener);
          return handle;
        },
        off(event: string, listener: (...args: any[]) => void) {
          emitter.off(event, listener);
          return handle;
        },
        async close() {
          entry.closed = true;
          bucket.workers.delete(entry);
          emitter.removeAllListeners();
        },
      };

      return handle;
    },

    async drain(queue, opts = {}) {
      const bucket = getBucket(queue);
      if (bucket.paused) {
        return { processed: 0, completed: 0, failed: 0 };
      }

      const activeWorker = Array.from(bucket.workers).find((w) => !w.closed);
      if (!activeWorker) {
        return { processed: 0, completed: 0, failed: 0 };
      }

      const maxJobs = opts.maxJobs ?? Infinity;
      let processed = 0;
      let completed = 0;
      let failed = 0;

      while (!bucket.paused && !activeWorker.closed && processed < maxJobs) {
        const runnable = Array.from(bucket.jobs.values())
          .filter((j) => j.status === "prioritized" || j.status === "waiting")
          .sort((a, b) => {
            if (a.status !== b.status) return a.status === "prioritized" ? -1 : 1;
            return a.order - b.order;
          });

        const nextJob = runnable[0];
        if (!nextJob) break;

        nextJob.status = "active";
        nextJob.processedOn = now();
        processed++;

        try {
          const returnvalue = await activeWorker.processor(toRecord(bucket, nextJob));
          nextJob.status = "completed";
          nextJob.finishedOn = now();
          completed++;
          activeWorker.emitter.emit("completed", {
            id: nextJob.id,
            data: nextJob.data,
            returnvalue,
          });
        } catch (err: any) {
          const error = err instanceof Error ? err : new Error(String(err));
          nextJob.attemptsMade += 1;
          nextJob.failedReason = error.message;
          nextJob.stacktrace = error.stack ? error.stack.split("\n") : [];

          if (nextJob.attemptsMade >= nextJob.maxAttempts) {
            nextJob.status = "failed";
            nextJob.finishedOn = now();
          } else {
            nextJob.status = nextJob.priority > 0 ? "prioritized" : "waiting";
          }
          failed++;
          activeWorker.emitter.emit(
            "failed",
            { id: nextJob.id, data: nextJob.data },
            error
          );
        }
      }

      return { processed, completed, failed };
    },
  };
}
