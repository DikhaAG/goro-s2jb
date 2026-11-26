import path from "path";
import { ValidationStatus } from "@prisma/client";
import { BASE_UPLOAD_DIR } from "@/lib/storage";
import {
  calculateHammingDistance,
  calculateVisualSimilarity,
  calculateTextSimilarity,
  calculateReviewerSimilarity,
} from "@/lib/similarity";
import { extractGoogleDriveFileId, isExternalUrl } from "../evidenceAcquisition";
import { OcrResultPayload } from "@/types";
import { AntiFraudCheckResult, BatchDuplicateQuery } from "./types";

export const GREEN_ZONE_THRESHOLD = 90.0;
export const YELLOW_ZONE_THRESHOLD = 70.0;
export const DEFAULT_DUPLICATE_HASH_THRESHOLD = 5;
export const MAX_DUPLICATE_CANDIDATES = 50000;

/**
 * Normalizes an evidence path so queue payloads never leak host-specific BASE_UPLOAD_DIR.
 * External HTTP(S) URLs are preserved verbatim; local paths are stored relative to BASE_UPLOAD_DIR.
 */
export function normalizeEvidenceQueuePath(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed || isExternalUrl(trimmed)) {
    return trimmed;
  }

  if (path.isAbsolute(trimmed)) {
    const relative = path.relative(BASE_UPLOAD_DIR, trimmed);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      return relative.replace(/\\/g, "/");
    }
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
  const { reviewId, imageHash, threshold, candidates, evidenceImagePath, reviewerName, extractedText } = query;

  if (!imageHash || imageHash.length !== 16) {
    return {
      isDuplicate: false,
      duplicateOfId: null,
      minDistance: 64,
      visualSimilarity: 0,
      textSimilarity: 0,
      reviewerSimilarity: 0,
    };
  }

  const currentDriveId = extractGoogleDriveFileId(evidenceImagePath || "");
  let closestMatchId: string | null = null;
  let minDistance = 64;
  let bestVisualSim = 0;
  let bestTextSim = 0;
  let bestReviewerSim = 0;

  for (const candidate of candidates) {
    if (!candidate.evidenceImageHash) continue;
    const distance = calculateHammingDistance(imageHash, candidate.evidenceImageHash);
    const visualSim = calculateVisualSimilarity(imageHash, candidate.evidenceImageHash);

    if (distance < minDistance) {
      minDistance = distance;
      closestMatchId = candidate.id;
      bestVisualSim = visualSim;
    }

    if (distance <= threshold) {
      const candidateDriveId = extractGoogleDriveFileId(candidate.evidenceImagePath || "");
      const isSameDriveId = Boolean(
        currentDriveId && candidateDriveId && currentDriveId === candidateDriveId
      );

      const reviewerSim = calculateReviewerSimilarity(reviewerName, candidate.playstoreReviewerName);
      const textSim = calculateTextSimilarity(extractedText, candidate.extractedOcrText);

      bestTextSim = Math.max(bestTextSim, textSim);
      bestReviewerSim = Math.max(bestReviewerSim, reviewerSim);

      const hasReviewerInfo = Boolean(reviewerName && candidate.playstoreReviewerName);
      const hasTextInfo = Boolean(extractedText && candidate.extractedOcrText);
      const hasDifferentiatingInfo = hasReviewerInfo || hasTextInfo;

      let isTrueDuplicate = false;
      let matchReason = "Citra Visual Identik";

      if (isSameDriveId) {
        isTrueDuplicate = true;
        matchReason = "Berkas Eviden Identik";
      } else if (hasDifferentiatingInfo) {
        if (hasReviewerInfo && reviewerSim >= 75) {
          isTrueDuplicate = true;
          matchReason = "Nama Pengulas & Visual Identik";
        } else if (hasTextInfo && textSim >= 70) {
          isTrueDuplicate = true;
          matchReason = "Teks Ulasan & Visual Identik";
        }
      } else {
        isTrueDuplicate = true;
      }

      if (isTrueDuplicate) {
        return {
          isDuplicate: true,
          duplicateOfId: candidate.duplicateOfId || candidate.id,
          minDistance: distance,
          visualSimilarity: visualSim,
          textSimilarity: textSim,
          reviewerSimilarity: reviewerSim,
          matchReason,
        };
      }

      console.log(
        `[Verifikasi Eviden] Template collision dismissed between review ${reviewId} and candidate ${candidate.id}: Visual=${visualSim}%, Text=${textSim}%, Reviewer=${reviewerSim}%`
      );
    }
  }

  return {
    isDuplicate: false,
    duplicateOfId: null,
    minDistance,
    visualSimilarity: bestVisualSim,
    textSimilarity: bestTextSim,
    reviewerSimilarity: bestReviewerSim,
  };
}
