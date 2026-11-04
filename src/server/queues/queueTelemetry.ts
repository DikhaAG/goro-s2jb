import { Queue } from "bullmq";

export interface QueueThroughputStats {
  queueName: string;
  throughputJobsPerMinute: number;
  averageExecutionDurationMs: number;
  totalCompletedInWindow: number;
  totalFailedInWindow: number;
  stalledJobsCount: number;
  stalledJobIds: string[];
  lastCompletedJobAt?: string;
  lastFailedJobAt?: string;
}

interface CompletedJobRecord {
  timestamp: number;
  durationMs: number;
}

interface FailedJobRecord {
  timestamp: number;
  durationMs?: number;
}

const WINDOW_MS = 60 * 1000; // 60-second sliding window

// In-memory sliding windows per queue
const completedJobsMap = new Map<string, CompletedJobRecord[]>();
const failedJobsMap = new Map<string, FailedJobRecord[]>();
const lastCompletedAtMap = new Map<string, string>();
const lastFailedAtMap = new Map<string, string>();

/**
 * Records a completed job execution duration into the circular sliding window.
 */
export function recordJobCompleted(queueName: string, durationMs: number = 0): void {
  const now = Date.now();
  const list = completedJobsMap.get(queueName) || [];
  list.push({ timestamp: now, durationMs: Math.max(0, durationMs) });
  completedJobsMap.set(queueName, list);
  lastCompletedAtMap.set(queueName, new Date(now).toISOString());
}

/**
 * Records a failed job execution into the sliding window.
 */
export function recordJobFailed(queueName: string, durationMs: number = 0): void {
  const now = Date.now();
  const list = failedJobsMap.get(queueName) || [];
  list.push({ timestamp: now, durationMs: Math.max(0, durationMs) });
  failedJobsMap.set(queueName, list);
  lastFailedAtMap.set(queueName, new Date(now).toISOString());
}

/**
 * Resets recorded queue telemetry (useful for unit tests and clean restarts).
 */
export function resetQueueTelemetry(queueName?: string): void {
  if (queueName) {
    completedJobsMap.delete(queueName);
    failedJobsMap.delete(queueName);
    lastCompletedAtMap.delete(queueName);
    lastFailedAtMap.delete(queueName);
  } else {
    completedJobsMap.clear();
    failedJobsMap.clear();
    lastCompletedAtMap.clear();
    lastFailedAtMap.clear();
  }
}

/**
 * Prunes expired records outside the sliding window.
 */
export function pruneExpiredRecords(queueName: string, now: number = Date.now()): void {
  const cutoff = now - WINDOW_MS;

  const completed = completedJobsMap.get(queueName);
  if (completed) {
    completedJobsMap.set(
      queueName,
      completed.filter((r) => r.timestamp >= cutoff)
    );
  }

  const failed = failedJobsMap.get(queueName);
  if (failed) {
    failedJobsMap.set(
      queueName,
      failed.filter((r) => r.timestamp >= cutoff)
    );
  }
}

/**
 * Inspects active jobs in a BullMQ queue to detect stalled/hung jobs.
 * Flags jobs that have been processing for more than maxActiveDurationMs (default 180s = 3 minutes).
 */
export async function detectStalledJobs(
  queue: Queue,
  maxActiveDurationMs: number = 180000
): Promise<{ stalledCount: number; stalledJobIds: string[] }> {
  try {
    const activeJobs = await queue.getJobs(["active"]);
    const now = Date.now();
    const stalledJobIds: string[] = [];

    for (const job of activeJobs) {
      if (job.processedOn && now - job.processedOn > maxActiveDurationMs) {
        if (job.id) stalledJobIds.push(String(job.id));
      }
    }

    return {
      stalledCount: stalledJobIds.length,
      stalledJobIds,
    };
  } catch {
    return { stalledCount: 0, stalledJobIds: [] };
  }
}

/**
 * Calculates real-time throughput metrics (jobs/minute) and stall status for a given queue.
 */
export async function getQueueThroughputStats(
  queueName: string,
  queue?: Queue,
  maxActiveDurationMs: number = 180000
): Promise<QueueThroughputStats> {
  const now = Date.now();
  pruneExpiredRecords(queueName, now);

  const completed = completedJobsMap.get(queueName) || [];
  const failed = failedJobsMap.get(queueName) || [];

  const totalCompletedInWindow = completed.length;
  const totalFailedInWindow = failed.length;

  let averageExecutionDurationMs = 0;
  if (totalCompletedInWindow > 0) {
    const totalDuration = completed.reduce((sum, item) => sum + item.durationMs, 0);
    averageExecutionDurationMs = Math.round(totalDuration / totalCompletedInWindow);
  }

  const throughputJobsPerMinute = totalCompletedInWindow;

  let stalledJobsCount = 0;
  let stalledJobIds: string[] = [];

  if (queue) {
    const stallInfo = await detectStalledJobs(queue, maxActiveDurationMs);
    stalledJobsCount = stallInfo.stalledCount;
    stalledJobIds = stallInfo.stalledJobIds;
  }

  return {
    queueName,
    throughputJobsPerMinute,
    averageExecutionDurationMs,
    totalCompletedInWindow,
    totalFailedInWindow,
    stalledJobsCount,
    stalledJobIds,
    lastCompletedJobAt: lastCompletedAtMap.get(queueName),
    lastFailedJobAt: lastFailedAtMap.get(queueName),
  };
}

/**
 * Synchronous variant returning in-memory throughput stats without queue network call.
 */
export function getQueueThroughputStatsSync(queueName: string): QueueThroughputStats {
  const now = Date.now();
  pruneExpiredRecords(queueName, now);

  const completed = completedJobsMap.get(queueName) || [];
  const failed = failedJobsMap.get(queueName) || [];

  const totalCompletedInWindow = completed.length;
  const totalFailedInWindow = failed.length;

  let averageExecutionDurationMs = 0;
  if (totalCompletedInWindow > 0) {
    const totalDuration = completed.reduce((sum, item) => sum + item.durationMs, 0);
    averageExecutionDurationMs = Math.round(totalDuration / totalCompletedInWindow);
  }

  return {
    queueName,
    throughputJobsPerMinute: totalCompletedInWindow,
    averageExecutionDurationMs,
    totalCompletedInWindow,
    totalFailedInWindow,
    stalledJobsCount: 0,
    stalledJobIds: [],
    lastCompletedJobAt: lastCompletedAtMap.get(queueName),
    lastFailedJobAt: lastFailedAtMap.get(queueName),
  };
}

