import prisma from "@/lib/prisma";
import {
  calculateHammingDistance,
  calculateVisualSimilarity,
  calculateTextSimilarity,
  calculateReviewerSimilarity,
} from "@/lib/similarity";
import { extractGoogleDriveFileId } from "./evidenceDownloader";

export { calculateHammingDistance };

export interface AntiFraudCheckResult {
  isDuplicate: boolean;
  duplicateOfId: string | null;
  minDistance: number;
  visualSimilarity: number;
  textSimilarity: number;
  reviewerSimilarity: number;
  matchReason?: string;
}

export interface CheckImageDuplicateOptions {
  extractedText?: string | null;
  reviewerName?: string | null;
  evidenceImagePath?: string | null;
}

/**
 * Multimodal Hybrid Duplicate Detection:
 * Evaluates both visual image hash (pHash 64-bit) AND OCR extracted text / reviewer name
 * to prevent false positives caused by identical Google Play Store UI layout templates.
 */
export async function checkImageDuplicate(
  reviewId: string,
  imageHash: string,
  threshold: number = 5,
  options?: CheckImageDuplicateOptions
): Promise<AntiFraudCheckResult> {
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

  const currentDriveId = extractGoogleDriveFileId(options?.evidenceImagePath || "");

  // Fetch candidate reviews with visual image hashes
  const candidates = await prisma.ratingReview.findMany({
    where: {
      evidenceImageHash: { not: null },
      id: { not: reviewId },
    },
    select: {
      id: true,
      evidenceImageHash: true,
      duplicateOfId: true,
      extractedOcrText: true,
      playstoreReviewerName: true,
      evidenceImagePath: true,
      createdAt: true,
    },
    take: 1000,
    orderBy: { createdAt: "asc" },
  });

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
      // Visual match detected. Now perform multimodal text validation to verify
      // whether this is a true duplicate or merely the same Google Play Store UI template.
      const candidateDriveId = extractGoogleDriveFileId(candidate.evidenceImagePath || "");
      const isSameDriveId = Boolean(
        currentDriveId && candidateDriveId && currentDriveId === candidateDriveId
      );

      const reviewerSim = calculateReviewerSimilarity(
        options?.reviewerName,
        candidate.playstoreReviewerName
      );
      const textSim = calculateTextSimilarity(
        options?.extractedText,
        candidate.extractedOcrText
      );

      bestTextSim = Math.max(bestTextSim, textSim);
      bestReviewerSim = Math.max(bestReviewerSim, reviewerSim);

      // Check whether differentiating metadata (reviewer name or OCR text) is available to compare
      const hasReviewerInfo = Boolean(options?.reviewerName && candidate.playstoreReviewerName);
      const hasTextInfo = Boolean(options?.extractedText && candidate.extractedOcrText);
      const hasDifferentiatingInfo = hasReviewerInfo || hasTextInfo;

      let isTrueDuplicate = false;
      let matchReason = "Citra Visual Identik";

      if (isSameDriveId) {
        isTrueDuplicate = true;
        matchReason = "Berkas Eviden Identik";
      } else if (hasDifferentiatingInfo) {
        // Differentiating metadata available: verify if text or reviewer name matches
        if (hasReviewerInfo && reviewerSim >= 75) {
          isTrueDuplicate = true;
          matchReason = "Nama Pengulas & Visual Identik";
        } else if (hasTextInfo && textSim >= 70) {
          isTrueDuplicate = true;
          matchReason = "Teks Ulasan & Visual Identik";
        } else {
          // Proven different content despite similar visual layout: template collision dismissed
          isTrueDuplicate = false;
        }
      } else {
        // No textual metadata available to refute visual match: rely on perceptual hash
        isTrueDuplicate = true;
        matchReason = "Citra Visual Identik";
      }

      if (isTrueDuplicate) {
        const rootMasterId = candidate.duplicateOfId || candidate.id;
        return {
          isDuplicate: true,
          duplicateOfId: rootMasterId,
          minDistance: distance,
          visualSimilarity: visualSim,
          textSimilarity: textSim,
          reviewerSimilarity: reviewerSim,
          matchReason,
        };
      } else {
        // Visual collision dismissed due to different reviewer name and different review text
        console.log(
          `[Anti-Fraud] Template collision dismissed between review ${reviewId} and candidate ${candidate.id}: Visual=${visualSim}%, Text=${textSim}%, Reviewer=${reviewerSim}%`
        );
      }
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
