import type { Prisma, PrismaClient, Role, ValidationStatus } from "@prisma/client";
import type { ImportJobData } from "@/server/queues/importQueue";
import type { TelemetryEvent } from "../systemTelemetry";

export interface MigrationActor {
  id: string;
  name?: string | null;
  username?: string | null;
  role: Role;
}

export interface RawReviewRow {
  rowNumber: number;
  timestamp: Date;
  up3Name: string;
  ulpName: string;
  playstoreReviewerName: string;
  entryDate: Date;
  evidenceImagePath: string;
  versionName: string;
  originalReviewerName: string;
  reviewerCategory: string;
  fieldNotes: string;
  isDuplicate: boolean;
  validationStatus: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  reviewRemarks: string;
}

export type StopSignal = "CONTINUE" | "PAUSE" | "CANCEL";

export interface ImportQueuePort {
  add: (name: string, data: ImportJobData) => Promise<unknown>;
}

export interface AuditEventPayload {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface EnqueueVerificationItem {
  reviewId: string;
  evidenceImagePath: string;
  expectedReviewerName: string;
}

export interface MigrationBatchDeps {
  prisma?: PrismaClient;
  redis?: {
    get: (key: string) => Promise<string | null>;
    set: (...args: any[]) => Promise<unknown>;
    del?: (...keys: string[]) => Promise<unknown>;
  };
  baseUploadDir?: string;
  importQueue?: ImportQueuePort;
  enqueueVerification?: (
    targets: EnqueueVerificationItem[],
    options: { priority?: number; markQueuedInDb?: boolean }
  ) => Promise<unknown>;
  recordTelemetry?: (event: TelemetryEvent) => Promise<void>;
  audit?: (payload: AuditEventPayload) => Promise<unknown>;
}

export interface StartMigrationInput {
  filePath: string;
  fileName: string;
  fileSize: number;
  targetType?: "FORM_RESPONSES_RAW" | "HISTORICAL_REPORTS";
}

export interface ListBatchesInput {
  page?: number;
  pageSize?: number;
  status?: "ALL" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PAUSED" | "CANCELLED";
}

export interface ListBatchErrorsInput {
  batchId: string;
  page?: number;
  pageSize?: number;
}

export interface GetBatchDetailsInput {
  batchId: string;
  rowsPage?: number;
  rowsPageSize?: number;
}

export interface IngestBatchInput {
  importBatchId: string;
  filePath: string;
  userId?: string;
  startRowNumber?: number;
  onProgress?: (progress: { processedRows: number; failedRows: number }) => Promise<void>;
}

export interface IngestBatchResult {
  success: boolean;
  paused?: boolean;
  cancelled?: boolean;
  processedRows?: number;
  failedRows?: number;
  reason?: string;
}

export type DownloadBatchResult =
  | {
      kind: "file";
      buffer: Buffer;
      fileName: string;
      contentType: string;
    }
  | {
      kind: "csv_fallback";
      buffer: Buffer;
      fileName: string;
      contentType: "text/csv; charset=utf-8";
    };

export interface CsvExportReviewRow {
  timestamp: Date | null;
  up3?: { name: string } | null;
  ulp?: { name: string } | null;
  playstoreReviewerName: string;
  entryDate: Date | null;
  evidenceImagePath: string;
  appVersion?: { version: string } | null;
  originalReviewerName: string | null;
  reviewerCategory: string;
  fieldNotes: string | null;
  isDuplicate: boolean;
  validationStatus: ValidationStatus | string;
  reviewRemarks: string | null;
}
