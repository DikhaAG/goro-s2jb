import prisma from "@/lib/prisma";
import { OcrProcessingStatus, ValidationStatus } from "@prisma/client";
import { ocrQueue } from "@/server/queues/ocrQueue";
import { acquireForVerification, isExternalUrl } from "../evidenceAcquisition";
import {
  classifyVerificationOutcome,
  DEFAULT_DUPLICATE_HASH_THRESHOLD,
  MAX_DUPLICATE_CANDIDATES,
  normalizeEvidenceQueuePath,
} from "./classification";
import {
  rustVisionEngineAdapter,
  buildRustBatchDuplicatePayload,
} from "./rustEngineAdapter";
import {
  EnqueueVerificationOptions,
  EnqueueVerificationResult,
  EnqueueVerificationTarget,
  TransientVerificationError,
  VerifyEvidenceDeps,
  VerifyEvidenceInput,
  VerifyEvidenceResult,
} from "./types";

export {
  rustVisionEngineAdapter,
  buildRustBatchDuplicatePayload,
  normalizeEvidenceQueuePath,
  classifyVerificationOutcome,
  TransientVerificationError,
};
export { createInMemoryVisionEngineAdapter } from "./inMemoryEngineAdapter";
export type {
  AntiFraudCheckResult,
  BatchDuplicateQuery,
  DuplicateCandidate,
  EngineBridgeMetrics,
  EnqueueVerificationOptions,
  EnqueueVerificationResult,
  EnqueueVerificationTarget,
  VerifyEvidenceDeps,
  VerifyEvidenceInput,
  VerifyEvidenceResult,
  VisionEnginePort,
} from "./types";

const DEFAULT_QUEUE_ATTEMPTS = 3;
const DEFAULT_QUEUE_PRIORITY = 1;

function isTransientOcrFailure(errorMessage?: string): boolean {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("tidak dapat dihubungi") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("econnreset") ||
    lower.includes("timeout") ||
    lower.includes("abort") ||
    lower.includes("http 5")
  );
}

async function defaultNotifyReportsUpdated(): Promise<void> {
  try {
    const redisClient = (await import("@/lib/redis")).default;
    await redisClient.set("reports:last_update_timestamp", Date.now().toString());
  } catch {
    // Non-critical cache stamp
  }
}

async function markReviewVerificationFailed(
  db: any,
  reviewId: string,
  remark: string
): Promise<void> {
  await db.ratingReview
    .update({
      where: { id: reviewId },
      data: {
        ocrStatus: OcrProcessingStatus.FAILED,
        validationStatus: ValidationStatus.NEEDS_REVIEW,
        isDuplicate: false,
        duplicateOfId: null,
        reviewRemarks: remark,
      },
    })
    .catch(() => {});
}

/**
 * Single enqueue seam for Eviden Ulasan verification (intake, operator retry, and migration import).
 * Normalizes local paths so host BASE_UPLOAD_DIR never leaks across container queues.
 */
export async function enqueueEvidenceVerification(
  targets: EnqueueVerificationTarget | EnqueueVerificationTarget[],
  options: EnqueueVerificationOptions = {}
): Promise<EnqueueVerificationResult> {
  const targetList = Array.isArray(targets) ? targets : [targets];
  if (targetList.length === 0) {
    return { enqueuedCount: 0, jobIds: [] };
  }

  const db = options.prismaClient ?? prisma;
  const priority = options.priority ?? DEFAULT_QUEUE_PRIORITY;
  const attempts = options.attempts ?? DEFAULT_QUEUE_ATTEMPTS;
  const markQueuedInDb = options.markQueuedInDb ?? true;

  const normalizedTargets = targetList.map((target) => ({
    reviewId: target.reviewId,
    evidenceImagePath: normalizeEvidenceQueuePath(target.evidenceImagePath),
    expectedReviewerName: target.expectedReviewerName,
  }));

  if (markQueuedInDb) {
    if (normalizedTargets.length === 1) {
      await db.ratingReview.update({
        where: { id: normalizedTargets[0].reviewId },
        data: { ocrStatus: OcrProcessingStatus.QUEUED },
      });
    } else {
      await db.ratingReview.updateMany({
        where: { id: { in: normalizedTargets.map((t) => t.reviewId) } },
        data: { ocrStatus: OcrProcessingStatus.QUEUED },
      });
    }
  }

  if (normalizedTargets.length === 1) {
    const job = await ocrQueue.add("process-ocr", normalizedTargets[0], {
      priority,
      attempts,
    });
    return {
      enqueuedCount: 1,
      jobIds: job?.id ? [String(job.id)] : [],
    };
  }

  const jobs = normalizedTargets.map((data) => ({
    name: "process-ocr",
    data,
    opts: { priority, attempts },
  }));
  const createdJobs = await ocrQueue.addBulk(jobs);
  return {
    enqueuedCount: normalizedTargets.length,
    jobIds: Array.isArray(createdJobs)
      ? createdJobs.map((j) => (j?.id ? String(j.id) : "")).filter(Boolean)
      : [],
  };
}

/**
 * Deep module entry point executing the full Verifikasi Eviden lifecycle:
 * evidence acquisition -> OCR & pHash -> multimodal duplicate check -> tri-zone + manual override rules -> DB persistence.
 */
export async function verifyEvidence(
  input: VerifyEvidenceInput,
  deps: VerifyEvidenceDeps = {}
): Promise<VerifyEvidenceResult> {
  const db = deps.prismaClient ?? prisma;
  const visionEngine = deps.visionEngine ?? rustVisionEngineAdapter;
  const notifyReports = deps.onReportApproved ?? defaultNotifyReportsUpdated;
  const isFinalAttempt = input.isFinalAttempt ?? true;

  const existingReview = await db.ratingReview.findUnique({
    where: { id: input.reviewId },
    select: {
      id: true,
      source: true,
      validationStatus: true,
      verifiedAt: true,
      reviewRemarks: true,
      entryDate: true,
      evidenceImagePath: true,
      playstoreReviewerName: true,
    },
  });

  if (!existingReview) {
    return {
      success: false,
      reviewId: input.reviewId,
      skipped: true,
      permanentFailure: true,
      error: "Review record not found in database",
    };
  }

  const normalizedPath = normalizeEvidenceQueuePath(input.evidenceImagePath);
  const usesExternalStream =
    existingReview.source === "MIGRATION" || isExternalUrl(normalizedPath);

  if (usesExternalStream) {
    await db.ratingReview
      .update({
        where: { id: input.reviewId },
        data: { ocrStatus: OcrProcessingStatus.DOWNLOADING },
      })
      .catch(() => {});
  }

  const acquired = await acquireForVerification(normalizedPath, {
    streamExternal: deps.streamExternalEvidence,
  });

  if (!acquired.ok) {
    if (acquired.kind === "external_error") {
      if (!isFinalAttempt) {
        throw new TransientVerificationError(
          `Streaming Eviden Ulasan gagal sementara: ${acquired.error}`
        );
      }

      await markReviewVerificationFailed(
        db,
        input.reviewId,
        `OCR Gagal: Tautan gambar Google Drive tidak dapat dialirkan (${acquired.error})`
      );
      return {
        success: false,
        reviewId: input.reviewId,
        ocrStatus: OcrProcessingStatus.FAILED,
        error: acquired.error,
      };
    }

    await markReviewVerificationFailed(db, input.reviewId, `OCR Gagal: ${acquired.error}`);
    return {
      success: false,
      reviewId: input.reviewId,
      ocrStatus: OcrProcessingStatus.FAILED,
      permanentFailure: true,
      error: acquired.error,
    };
  }

  const ocrInput: string | Buffer =
    acquired.kind === "buffer" ? acquired.buffer : acquired.absolutePath;

  await db.ratingReview
    .update({
      where: { id: input.reviewId },
      data: { ocrStatus: OcrProcessingStatus.PROCESSING },
    })
    .catch(() => {});

  const ocrResult = await visionEngine.extractAndMatch(
    ocrInput,
    input.expectedReviewerName
  );

  if (!ocrResult.success) {
    if (!isFinalAttempt && isTransientOcrFailure(ocrResult.error)) {
      throw new TransientVerificationError(
        ocrResult.error || "Layanan OCR gagal sementara"
      );
    }

    await markReviewVerificationFailed(
      db,
      input.reviewId,
      `OCR Gagal: ${ocrResult.error || "Citra tidak dapat diproses"}`
    );
    return {
      success: false,
      reviewId: input.reviewId,
      ocrStatus: OcrProcessingStatus.FAILED,
      error: ocrResult.error,
    };
  }

  const candidates =
    ocrResult.phash && ocrResult.phash.length === 16
      ? await db.ratingReview.findMany({
          where: {
            evidenceImageHash: { not: null },
            id: { not: input.reviewId },
          },
          select: {
            id: true,
            evidenceImageHash: true,
            duplicateOfId: true,
            extractedOcrText: true,
            playstoreReviewerName: true,
            evidenceImagePath: true,
          },
          take: MAX_DUPLICATE_CANDIDATES,
          orderBy: { createdAt: "desc" },
        })
      : [];

  const antiFraudResult = await visionEngine.checkBatchDuplicates({
    reviewId: input.reviewId,
    imageHash: ocrResult.phash,
    threshold: DEFAULT_DUPLICATE_HASH_THRESHOLD,
    extractedText: ocrResult.extracted_text,
    reviewerName: input.expectedReviewerName || existingReview.playstoreReviewerName,
    evidenceImagePath: existingReview.evidenceImagePath,
    candidates,
  });

  const { finalStatus, reviewRemarks } = classifyVerificationOutcome({
    ocrResult,
    antiFraudResult,
    existingValidationStatus: existingReview.validationStatus,
    existingReviewRemarks: existingReview.reviewRemarks,
  });

  await db.ratingReview
    .update({
      where: { id: input.reviewId },
      data: {
        ocrStatus: OcrProcessingStatus.COMPLETED,
        extractedOcrText: ocrResult.extracted_text,
        evidenceImageHash: ocrResult.phash,
        confidenceScore: ocrResult.similarity_score,
        isDuplicate: antiFraudResult.isDuplicate,
        duplicateOfId: antiFraudResult.duplicateOfId,
        validationStatus: finalStatus,
        verifiedAt:
          finalStatus === ValidationStatus.APPROVED
            ? existingReview.verifiedAt || new Date()
            : null,
        reviewRemarks,
      },
    })
    .catch((updateErr: any) => {
      console.warn(
        `[Verifikasi Eviden] Failed to update review ${input.reviewId}:`,
        updateErr?.message
      );
    });

  if (finalStatus === ValidationStatus.APPROVED) {
    await notifyReports();
  }

  return {
    success: true,
    reviewId: input.reviewId,
    ocrStatus: OcrProcessingStatus.COMPLETED,
    score: ocrResult.similarity_score,
    zone: ocrResult.zone,
    status: finalStatus,
    isDuplicate: antiFraudResult.isDuplicate,
    duplicateOfId: antiFraudResult.duplicateOfId,
  };
}
