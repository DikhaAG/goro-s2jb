import { OcrProcessingStatus, ValidationStatus } from "@prisma/client";
import { OcrResultPayload, OcrZone } from "@/types";

export interface AntiFraudCheckResult {
  isDuplicate: boolean;
  duplicateOfId: string | null;
  minDistance: number;
  visualSimilarity: number;
  textSimilarity: number;
  reviewerSimilarity: number;
  matchReason?: string;
}

export interface DuplicateCandidate {
  id: string;
  evidenceImageHash: string | null;
  duplicateOfId: string | null;
  extractedOcrText: string | null;
  playstoreReviewerName: string | null;
  evidenceImagePath: string | null;
}

export interface BatchDuplicateQuery {
  reviewId: string;
  imageHash: string;
  threshold: number;
  extractedText?: string | null;
  reviewerName?: string | null;
  evidenceImagePath?: string | null;
  candidates: DuplicateCandidate[];
}

export interface EngineBridgeMetrics {
  totalRequests: number;
  httpSuccessCount: number;
  cliFallbackCount: number;
  cliSuccessCount: number;
  cliFailureCount: number;
  lastFallbackAt?: string;
  averageExecutionMs: number;
}

export interface VisionEnginePort {
  extractAndMatch(
    imageInput: string | Buffer,
    expectedReviewerName: string
  ): Promise<OcrResultPayload>;
  checkBatchDuplicates(query: BatchDuplicateQuery): Promise<AntiFraudCheckResult>;
}

export interface EnqueueVerificationTarget {
  reviewId: string;
  evidenceImagePath: string;
  expectedReviewerName: string;
}

export interface EnqueueVerificationOptions {
  priority?: number;
  attempts?: number;
  markQueuedInDb?: boolean;
  prismaClient?: any;
}

export interface EnqueueVerificationResult {
  enqueuedCount: number;
  jobIds: string[];
}

export interface VerifyEvidenceInput {
  reviewId: string;
  evidenceImagePath: string;
  expectedReviewerName: string;
  isFinalAttempt?: boolean;
}

export interface EvidenceStreamResult {
  success: boolean;
  buffer?: Buffer;
  contentType?: string;
  error?: string;
}

export interface VerifyEvidenceDeps {
  visionEngine?: VisionEnginePort;
  prismaClient?: any;
  streamExternalEvidence?: (url: string) => Promise<EvidenceStreamResult>;
  onReportApproved?: () => Promise<void>;
}

export interface VerifyEvidenceResult {
  success: boolean;
  reviewId: string;
  ocrStatus?: OcrProcessingStatus;
  score?: number;
  zone?: OcrZone;
  status?: ValidationStatus;
  isDuplicate?: boolean;
  duplicateOfId?: string | null;
  error?: string;
  skipped?: boolean;
  permanentFailure?: boolean;
}

export class TransientVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientVerificationError";
  }
}
