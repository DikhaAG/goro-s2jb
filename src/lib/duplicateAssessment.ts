/**
 * Multimodal Duplicate Assessment Module
 *
 * Evaluates visual perceptual hashes (pHash), filtered OCR text, reviewer identity,
 * and Google Drive file references behind one interface shared by Verifikasi Eviden
 * and Triase Ulasan UI. Thresholds mirror rust-services/goro-engine/src/duplicate_matcher.rs.
 */

export const DEFAULT_DUPLICATE_HASH_THRESHOLD = 5;

const VISUAL_MATCH_THRESHOLD = 90;
const TEXT_MATCH_THRESHOLD = 70;
const REVIEWER_MATCH_THRESHOLD = 75;
const PHASH_HEX_LENGTH = 16;
const MAX_HAMMING_DISTANCE = 64;

// Common Indonesian Google Play Store UI boilerplate excluded from review text comparison
const PLAYSTORE_STOPWORDS = new Set([
  "pln",
  "mobile",
  "aplikasi",
  "ulasan",
  "anda",
  "yang",
  "baru",
  "terakhir",
  "diupdate",
  "energikan",
  "harimu",
  "dengan",
  "wajah",
  "tampilan",
  "lebih",
  "modern",
  "navigasi",
  "mudah",
  "digunakan",
  "edit",
  "dukungan",
  "ganti",
  "akun",
  "untuk",
  "menjadi",
  "penguji",
  "beta",
  "dikaitkan",
  "lain",
  "mendapatkan",
  "update",
  "dahulu",
  "play",
  "store",
  "gabung",
  "selengkapnya",
  "tentang",
  "sinergi",
  "layanan",
  "kepada",
  "pelanggan",
  "melalui",
  "berbasis",
  "gratis",
  "populer",
  "bisnis",
  "rumah",
  "griya",
  "penyedia",
  "utilitas",
  "dating",
  "game",
  "telusuri",
  "buku",
  "uninstal",
  "buka",
  "rating",
  "bintang",
  "versi",
]);

export type DuplicateVerdict =
  | "CONFIRMED_DUPLICATE"
  | "TEMPLATE_COLLISION"
  | "DISTINCT";

export interface DuplicateComparableRecord {
  evidenceImageHash?: string | null;
  extractedOcrText?: string | null;
  playstoreReviewerName?: string | null;
  evidenceImagePath?: string | null;
}

export interface DuplicatePairAssessment {
  hammingDistance: number;
  visualSimilarity: number;
  textSimilarity: number;
  reviewerSimilarity: number;
  isVisualMatch: boolean;
  isTextMatch: boolean;
  isReviewerMatch: boolean;
  isSameDriveFile: boolean;
  verdict: DuplicateVerdict;
  matchReason: string | null;
}

export interface DuplicateBatchCandidate {
  id: string;
  evidenceImageHash: string | null;
  duplicateOfId: string | null;
  extractedOcrText: string | null;
  playstoreReviewerName: string | null;
  evidenceImagePath: string | null;
}

export interface DuplicateBatchInput {
  reviewId: string;
  imageHash: string;
  threshold?: number;
  extractedText?: string | null;
  reviewerName?: string | null;
  evidenceImagePath?: string | null;
  candidates: DuplicateBatchCandidate[];
}

export interface DuplicateBatchResult {
  isDuplicate: boolean;
  duplicateOfId: string | null;
  minDistance: number;
  visualSimilarity: number;
  textSimilarity: number;
  reviewerSimilarity: number;
  matchReason?: string;
}

export interface AssessDuplicateBatchOptions {
  onTemplateCollisionDismissed?: (info: {
    reviewId: string;
    candidateId: string;
    visualSimilarity: number;
    textSimilarity: number;
    reviewerSimilarity: number;
  }) => void;
}

export interface DuplicateSourceUnit {
  id: string;
  code: string;
  name: string;
}

export interface DuplicateSourceAppVersion {
  id: string;
  version: string;
}

export interface DuplicateSourceInput {
  id: string;
  source?: string | null;
  timestamp?: string | Date | null;
  createdAt?: string | Date | null;
  playstoreReviewerName: string;
  originalReviewerName?: string | null;
  entryDate: string | Date;
  evidenceImagePath: string;
  evidenceImageHash?: string | null;
  extractedOcrText?: string | null;
  confidenceScore?: number | null;
  ocrStatus?: string | null;
  validationStatus?: string | null;
  isDuplicate?: boolean | null;
  fieldNotes?: string | null;
  reviewRemarks?: string | null;
  up3?: { id?: string; code?: string; name?: string } | null;
  ulp?: { id?: string; code?: string; name?: string } | null;
  appVersion?: { id?: string; version?: string } | null;
}

export interface DuplicateSourcePreview {
  id: string;
  source: string;
  timestamp: string | Date | null;
  createdAt: string | Date | null;
  playstoreReviewerName: string;
  originalReviewerName: string | null;
  entryDate: string | Date;
  evidenceImagePath: string;
  evidenceImageHash: string | null;
  extractedOcrText: string | null;
  confidenceScore: number | null;
  ocrStatus: "QUEUED" | "DOWNLOADING" | "PROCESSING" | "COMPLETED" | "FAILED";
  validationStatus: "PENDING" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  isDuplicate: boolean;
  fieldNotes: string | null;
  reviewRemarks: string | null;
  up3: DuplicateSourceUnit;
  ulp: DuplicateSourceUnit;
  appVersion: DuplicateSourceAppVersion;
}

const VALID_OCR_STATUSES = new Set<DuplicateSourcePreview["ocrStatus"]>([
  "QUEUED",
  "DOWNLOADING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

const VALID_VALIDATION_STATUSES = new Set<DuplicateSourcePreview["validationStatus"]>([
  "PENDING",
  "NEEDS_REVIEW",
  "APPROVED",
  "REJECTED",
]);

/**
 * Extracts Google Drive file ID from open?id=, /file/d/, /d/, or uc?id= URLs.
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];

  const fileDMatch = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch?.[1]) return fileDMatch[1];

  return null;
}

function isValidPhash(hex?: string | null): hex is string {
  return Boolean(hex && hex.length === PHASH_HEX_LENGTH);
}

function calculateHammingDistance(hexA?: string | null, hexB?: string | null): number {
  if (!isValidPhash(hexA) || !isValidPhash(hexB)) {
    return MAX_HAMMING_DISTANCE;
  }

  try {
    let xorVal = BigInt("0x" + hexA) ^ BigInt("0x" + hexB);
    let distance = 0;
    while (xorVal > 0n) {
      if (xorVal & 1n) distance++;
      xorVal >>= 1n;
    }
    return distance;
  } catch {
    return MAX_HAMMING_DISTANCE;
  }
}

function visualSimilarityFromDistance(distance: number): number {
  return Math.max(0, Math.round((1 - distance / MAX_HAMMING_DISTANCE) * 100));
}

function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function calculateTextSimilarity(textA?: string | null, textB?: string | null): number {
  if (!textA || !textB) return 0;

  const rawTokensA = tokenizeText(textA);
  const rawTokensB = tokenizeText(textB);

  const tokensA = rawTokensA.filter((w) => !PLAYSTORE_STOPWORDS.has(w));
  const tokensB = rawTokensB.filter((w) => !PLAYSTORE_STOPWORDS.has(w));

  // Fallback to raw tokens when filtering strips every word
  const setA = new Set(tokensA.length > 0 ? tokensA : rawTokensA);
  const setB = new Set(tokensB.length > 0 ? tokensB : rawTokensB);

  if (setA.size === 0 && setB.size === 0) return 100;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return Math.round((intersection / union) * 100);
}

function calculateReviewerSimilarity(nameA?: string | null, nameB?: string | null): number {
  const s1 = (nameA || "").trim().toLowerCase();
  const s2 = (nameB || "").trim().toLowerCase();

  if (s1 === s2 && s1.length > 0) return 100;
  if (!s1 || !s2) return 0;

  const l1 = s1.length;
  const l2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= l1; i++) matrix[i] = [i];
  for (let j = 0; j <= l2; j++) matrix[0][j] = j;

  for (let i = 1; i <= l1; i++) {
    for (let j = 1; j <= l2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[l1][l2];
  const maxLen = Math.max(l1, l2);
  return Math.max(0, Math.round((1 - distance / maxLen) * 100));
}

function hasMatchingDriveFileId(pathA?: string | null, pathB?: string | null): boolean {
  const driveIdA = extractGoogleDriveFileId(pathA || "");
  const driveIdB = extractGoogleDriveFileId(pathB || "");
  return Boolean(driveIdA && driveIdB && driveIdA === driveIdB);
}

function hasNonEmptyText(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

function evaluateCollisionVerdict(params: {
  isSameDriveFile: boolean;
  isVisualMatch: boolean;
  hasReviewerInfo: boolean;
  hasTextInfo: boolean;
  isReviewerMatch: boolean;
  isTextMatch: boolean;
}): { verdict: DuplicateVerdict; matchReason: string | null } {
  const {
    isSameDriveFile,
    isVisualMatch,
    hasReviewerInfo,
    hasTextInfo,
    isReviewerMatch,
    isTextMatch,
  } = params;

  if (isSameDriveFile) {
    return { verdict: "CONFIRMED_DUPLICATE", matchReason: "Berkas Eviden Identik" };
  }

  if (!isVisualMatch) {
    return { verdict: "DISTINCT", matchReason: null };
  }

  if (hasReviewerInfo || hasTextInfo) {
    if (hasReviewerInfo && isReviewerMatch) {
      return {
        verdict: "CONFIRMED_DUPLICATE",
        matchReason: "Nama Pengulas & Visual Identik",
      };
    }
    if (hasTextInfo && isTextMatch) {
      return {
        verdict: "CONFIRMED_DUPLICATE",
        matchReason: "Teks Ulasan & Visual Identik",
      };
    }
    return {
      verdict: "TEMPLATE_COLLISION",
      matchReason: "Indikasi Template Play Store",
    };
  }

  return { verdict: "CONFIRMED_DUPLICATE", matchReason: "Citra Visual Identik" };
}

/**
 * Assesses multimodal similarity and template-collision verdict between two reviews.
 */
export function assessDuplicatePair(
  source?: DuplicateComparableRecord | null,
  target?: DuplicateComparableRecord | null,
  options?: { hashThreshold?: number }
): DuplicatePairAssessment {
  if (!source || !target) {
    return {
      hammingDistance: MAX_HAMMING_DISTANCE,
      visualSimilarity: 0,
      textSimilarity: 0,
      reviewerSimilarity: 0,
      isVisualMatch: false,
      isTextMatch: false,
      isReviewerMatch: false,
      isSameDriveFile: false,
      verdict: "DISTINCT",
      matchReason: null,
    };
  }

  const hasValidHashes =
    isValidPhash(source.evidenceImageHash) && isValidPhash(target.evidenceImageHash);
  const hammingDistance = calculateHammingDistance(
    source.evidenceImageHash,
    target.evidenceImageHash
  );
  const visualSimilarity = hasValidHashes
    ? visualSimilarityFromDistance(hammingDistance)
    : 0;
  const textSimilarity = calculateTextSimilarity(
    source.extractedOcrText,
    target.extractedOcrText
  );
  const reviewerSimilarity = calculateReviewerSimilarity(
    source.playstoreReviewerName,
    target.playstoreReviewerName
  );

  const isVisualMatch =
    options?.hashThreshold !== undefined
      ? hasValidHashes && hammingDistance <= options.hashThreshold
      : visualSimilarity >= VISUAL_MATCH_THRESHOLD;
  const isTextMatch = textSimilarity >= TEXT_MATCH_THRESHOLD;
  const isReviewerMatch = reviewerSimilarity >= REVIEWER_MATCH_THRESHOLD;
  const isSameDriveFile = hasMatchingDriveFileId(
    source.evidenceImagePath,
    target.evidenceImagePath
  );

  const { verdict, matchReason } = evaluateCollisionVerdict({
    isSameDriveFile,
    isVisualMatch,
    hasReviewerInfo:
      hasNonEmptyText(source.playstoreReviewerName) &&
      hasNonEmptyText(target.playstoreReviewerName),
    hasTextInfo:
      hasNonEmptyText(source.extractedOcrText) &&
      hasNonEmptyText(target.extractedOcrText),
    isReviewerMatch,
    isTextMatch,
  });

  return {
    hammingDistance,
    visualSimilarity,
    textSimilarity,
    reviewerSimilarity,
    isVisualMatch,
    isTextMatch,
    isReviewerMatch,
    isSameDriveFile,
    verdict,
    matchReason,
  };
}

/**
 * Evaluates a target review against candidate hashes for multimodal duplicate detection.
 * Used as the in-process fallback when the Rust HTTP engine is unreachable.
 */
export function assessDuplicateBatch(
  query: DuplicateBatchInput,
  options: AssessDuplicateBatchOptions = {}
): DuplicateBatchResult {
  const threshold = query.threshold ?? DEFAULT_DUPLICATE_HASH_THRESHOLD;

  if (!isValidPhash(query.imageHash)) {
    return {
      isDuplicate: false,
      duplicateOfId: null,
      minDistance: MAX_HAMMING_DISTANCE,
      visualSimilarity: 0,
      textSimilarity: 0,
      reviewerSimilarity: 0,
    };
  }

  let minDistance = MAX_HAMMING_DISTANCE;
  let bestVisualSim = 0;
  let bestTextSim = 0;
  let bestReviewerSim = 0;

  const targetRecord: DuplicateComparableRecord = {
    evidenceImageHash: query.imageHash,
    extractedOcrText: query.extractedText,
    playstoreReviewerName: query.reviewerName,
    evidenceImagePath: query.evidenceImagePath,
  };

  for (const candidate of query.candidates) {
    if (!isValidPhash(candidate.evidenceImageHash)) continue;

    const pair = assessDuplicatePair(targetRecord, candidate, {
      hashThreshold: threshold,
    });

    if (pair.hammingDistance < minDistance) {
      minDistance = pair.hammingDistance;
      bestVisualSim = pair.visualSimilarity;
    }

    if (pair.hammingDistance <= threshold) {
      bestTextSim = Math.max(bestTextSim, pair.textSimilarity);
      bestReviewerSim = Math.max(bestReviewerSim, pair.reviewerSimilarity);

      if (pair.verdict === "CONFIRMED_DUPLICATE") {
        return {
          isDuplicate: true,
          duplicateOfId: candidate.duplicateOfId || candidate.id,
          minDistance: pair.hammingDistance,
          visualSimilarity: pair.visualSimilarity,
          textSimilarity: pair.textSimilarity,
          reviewerSimilarity: pair.reviewerSimilarity,
          matchReason: pair.matchReason || "Citra Visual Identik",
        };
      }

      if (pair.verdict === "TEMPLATE_COLLISION") {
        options.onTemplateCollisionDismissed?.({
          reviewId: query.reviewId,
          candidateId: candidate.id,
          visualSimilarity: pair.visualSimilarity,
          textSimilarity: pair.textSimilarity,
          reviewerSimilarity: pair.reviewerSimilarity,
        });
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

/**
 * Normalizes a partial `duplicateOf` summary or full detail record into one consistent
 * preview structure consumed by table links, split-view comparison, and lightbox modals.
 */
export function normalizeDuplicateSourcePreview(
  source?: DuplicateSourceInput | null
): DuplicateSourcePreview | null {
  if (!source) return null;

  const ocrStatus =
    source.ocrStatus &&
    VALID_OCR_STATUSES.has(source.ocrStatus as DuplicateSourcePreview["ocrStatus"])
      ? (source.ocrStatus as DuplicateSourcePreview["ocrStatus"])
      : "COMPLETED";

  const validationStatus =
    source.validationStatus &&
    VALID_VALIDATION_STATUSES.has(
      source.validationStatus as DuplicateSourcePreview["validationStatus"]
    )
      ? (source.validationStatus as DuplicateSourcePreview["validationStatus"])
      : "PENDING";

  return {
    id: source.id,
    source: source.source || "MIGRATION",
    timestamp: source.timestamp ?? null,
    createdAt: source.createdAt ?? null,
    playstoreReviewerName: source.playstoreReviewerName,
    originalReviewerName: source.originalReviewerName ?? null,
    entryDate: source.entryDate,
    evidenceImagePath: source.evidenceImagePath,
    evidenceImageHash: source.evidenceImageHash ?? null,
    extractedOcrText: source.extractedOcrText ?? null,
    confidenceScore: source.confidenceScore ?? null,
    ocrStatus,
    validationStatus,
    isDuplicate: Boolean(source.isDuplicate),
    fieldNotes: source.fieldNotes ?? null,
    reviewRemarks: source.reviewRemarks ?? null,
    up3: {
      id: source.up3?.id || "",
      code: source.up3?.code || "",
      name: source.up3?.name || "-",
    },
    ulp: {
      id: source.ulp?.id || "",
      code: source.ulp?.code || "",
      name: source.ulp?.name || "-",
    },
    appVersion: {
      id: source.appVersion?.id || "",
      version: source.appVersion?.version || "-",
    },
  };
}
