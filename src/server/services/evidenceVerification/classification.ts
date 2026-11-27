import { ValidationStatus } from "@prisma/client";
import { confineToRoot, resolveStorageRoot } from "@/lib/storage";
import {
  assessDuplicateBatch,
  DEFAULT_DUPLICATE_HASH_THRESHOLD,
} from "@/lib/duplicateAssessment";
import { isExternalUrl } from "../evidenceAcquisition";
import { OcrResultPayload } from "@/types";
import { AntiFraudCheckResult, BatchDuplicateQuery } from "./types";

export const GREEN_ZONE_THRESHOLD = 90.0;
export const YELLOW_ZONE_THRESHOLD = 70.0;
export { DEFAULT_DUPLICATE_HASH_THRESHOLD };
export const MAX_DUPLICATE_CANDIDATES = 50000;

/**
 * Normalizes an evidence path so queue payloads never leak host-specific storage roots.
 * External HTTP(S) URLs are preserved verbatim; local paths are stored relative to storageRoot.
 */
export function normalizeEvidenceQueuePath(pathOrUrl: string, storageRoot?: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed || isExternalUrl(trimmed)) {
    return trimmed;
  }

  const confined = confineToRoot(resolveStorageRoot(storageRoot), trimmed);
  if (confined.isAllowed) {
    return confined.relativePath;
  }

  return trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
}

export interface VerificationClassification {
  finalStatus: ValidationStatus;
  reviewRemarks: string;
  preservesManualDecision: boolean;
}

/**
 * Single source of truth for tri-zone OCR triage, duplicate override, and manual decision protection.
 */
export function classifyVerificationOutcome(params: {
  ocrResult: OcrResultPayload;
  antiFraudResult: AntiFraudCheckResult;
  existingValidationStatus: ValidationStatus;
  existingReviewRemarks?: string | null;
}): VerificationClassification {
  const { ocrResult, antiFraudResult, existingValidationStatus, existingReviewRemarks } = params;
  const isManualDecision =
    existingValidationStatus === ValidationStatus.APPROVED ||
    existingValidationStatus === ValidationStatus.REJECTED;

  if (isManualDecision) {
    const manualStatusLabel = existingValidationStatus === ValidationStatus.APPROVED ? "APPROVED" : "REJECTED";
    return {
      finalStatus: existingValidationStatus,
      reviewRemarks:
        existingReviewRemarks ||
        `Keputusan manual ${manualStatusLabel} dipertahankan (Skor OCR: ${ocrResult.similarity_score}%, Zona: ${ocrResult.zone})`,
      preservesManualDecision: true,
    };
  }

  if (antiFraudResult.isDuplicate) {
    return {
      finalStatus: ValidationStatus.REJECTED,
      reviewRemarks: `Terindikasi duplikasi visual dengan ID: ${antiFraudResult.duplicateOfId} (Visual: ${antiFraudResult.visualSimilarity}%, Teks OCR: ${antiFraudResult.textSimilarity}%, Pengulas: ${antiFraudResult.reviewerSimilarity}%)`,
      preservesManualDecision: false,
    };
  }

  const isGreenZone =
    ocrResult.similarity_score >= GREEN_ZONE_THRESHOLD || ocrResult.zone === "GREEN";

  if (isGreenZone) {
    return {
      finalStatus: ValidationStatus.APPROVED,
      reviewRemarks: `Verifikasi Otomatis AI (Skor: ${ocrResult.similarity_score}%, Zona Hijau Valid)`,
      preservesManualDecision: false,
    };
  }

  return {
    finalStatus: ocrResult.recommended_status,
    reviewRemarks: `Verifikasi Otomatis AI (Skor: ${ocrResult.similarity_score}%, Zona: ${ocrResult.zone})`,
    preservesManualDecision: false,
  };
}

/**
 * Local JS multimodal duplicate check used only when the Rust HTTP engine is unreachable.
 */
export function evaluateLocalDuplicates(query: BatchDuplicateQuery): AntiFraudCheckResult {
  return assessDuplicateBatch(query, {
    onTemplateCollisionDismissed: ({
      reviewId,
      candidateId,
      visualSimilarity,
      textSimilarity,
      reviewerSimilarity,
    }) => {
      console.log(
        `[Verifikasi Eviden] Template collision dismissed between review ${reviewId} and candidate ${candidateId}: Visual=${visualSimilarity}%, Text=${textSimilarity}%, Reviewer=${reviewerSimilarity}%`
      );
    },
  });
}
