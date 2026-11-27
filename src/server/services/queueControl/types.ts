import type { Prisma, Role } from "@prisma/client";
import type { TelemetryEvent } from "@/server/services/systemTelemetry";

export type QueueName = "import" | "ocr";
export type QueueJobStatus = "active" | "waiting" | "failed" | "completed" | "delayed";
export type QueueRawStatus = QueueJobStatus | "prioritized";
export type CleanQueueType = "failed" | "completed";
export type WorkerJobOutcome = "completed" | "failed" | "skipped";

export interface QueueActor {
  id?: string | null;
  name?: string | null;
  username?: string | null;
  role?: Role | string | null;
}

export interface ListQueueJobsInput {
  queueName: QueueName;
  status?: QueueJobStatus;
  page?: number;
  pageSize?: number;
}

export type QueueJobProgress = string | number | boolean | object;

export interface RedactedQueueJobItem {
  id: string;
  name: string;
  data: object | null;
  progress: QueueJobProgress;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
  failedReason: string | null;
  stacktrace: string[];
}

export interface ListQueueJobsResult {
  jobs: RedactedQueueJobItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QueueActionResult {
  success: boolean;
  message: string;
}

export interface RetryAllFailedResult extends QueueActionResult {
  retriedCount: number;
}

export interface QueueJobRecord<TData = object> {
  id: string;
  name: string;
  data: TData;
  progress: QueueJobProgress;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
  maxAttempts: number;
  failedReason?: string | null;
  stacktrace?: string[];
  retry(): Promise<void>;
  remove(): Promise<void>;
  updateProgress(progress: QueueJobProgress): Promise<void>;
}

export interface WorkerJobContext<TData = object> {
  id: string;
  name: string;
  data: TData;
  attemptsMade: number;
  maxAttempts: number;
  isFinalAttempt: boolean;
  updateProgress(progress: QueueJobProgress): Promise<void>;
}

export interface QueueWorkerHandle<TData = unknown, TResult = unknown> {
  on(
    event: "completed",
    listener: (job: { id?: string; data: TData; returnvalue: TResult }) => void
  ): this;
  on(
    event: "failed",
    listener: (job: { id?: string; data?: TData } | undefined, err: Error) => void
  ): this;
  on(event: "error", listener: (err: Error) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  close(): Promise<void>;
}

export interface QueueWorkerOptions<TData = unknown, TResult = unknown> {
  queueName: string;
  concurrency: number;
  processor: (job: QueueJobRecord<TData>) => Promise<TResult>;
}

export interface CreateWorkerSpec<TData = unknown, TResult = unknown> {
  queue: QueueName | string;
  concurrency: number;
  label?: string;
  processor: (job: WorkerJobContext<TData>) => Promise<TResult>;
  classifyResult?: (result: TResult) => WorkerJobOutcome;
}

export interface QueueBackendPort {
  resolveQueueName(queue: QueueName | string): string;
  getJobCounts(queue: QueueName | string): Promise<Record<string, number>>;
  getJobs(
    queue: QueueName | string,
    statuses: QueueRawStatus[],
    start: number,
    end: number,
    asc?: boolean
  ): Promise<QueueJobRecord[]>;
  getJob(queue: QueueName | string, jobId: string): Promise<QueueJobRecord | null>;
  pause(queue: QueueName | string): Promise<void>;
  resume(queue: QueueName | string): Promise<void>;
  isPaused(queue: QueueName | string): Promise<boolean>;
  clean(
    queue: QueueName | string,
    graceMs: number,
    limit: number,
    type: CleanQueueType
  ): Promise<void>;
  createWorker<TData = unknown, TResult = unknown>(
    options: QueueWorkerOptions<TData, TResult>
  ): QueueWorkerHandle<TData, TResult>;
}

export interface QueueAuditPayload {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface QueueControlDeps {
  backend?: QueueBackendPort;
  audit?: (payload: QueueAuditPayload) => Promise<unknown>;
  recordTelemetry?: (event: TelemetryEvent) => Promise<void>;
  now?: () => number;
}

export interface QueueControl {
  listJobs(actor: QueueActor | null | undefined, input: ListQueueJobsInput): Promise<ListQueueJobsResult>;
  pauseQueue(actor: QueueActor | null | undefined, queueName: QueueName): Promise<QueueActionResult>;
  resumeQueue(actor: QueueActor | null | undefined, queueName: QueueName): Promise<QueueActionResult>;
  retryJob(
    actor: QueueActor | null | undefined,
    queueName: QueueName,
    jobId: string
  ): Promise<QueueActionResult>;
  removeJob(
    actor: QueueActor | null | undefined,
    queueName: QueueName,
    jobId: string
  ): Promise<QueueActionResult>;
  retryAllFailedJobs(
    actor: QueueActor | null | undefined,
    queueName: QueueName
  ): Promise<RetryAllFailedResult>;
  cleanQueue(
    actor: QueueActor | null | undefined,
    queueName: QueueName,
    type: CleanQueueType
  ): Promise<QueueActionResult>;
  createWorker<TData = unknown, TResult = unknown>(
    spec: CreateWorkerSpec<TData, TResult>
  ): QueueWorkerHandle<TData, TResult>;
}
