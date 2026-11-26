/**
 * Shared display helpers for Eviden Ulasan URLs, confirmed duplicate guards,
 * and validation status presentation across operator UI modules.
 */

export type ReviewValidationStatusValue =
  | "PENDING"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "REJECTED";

/**
 * Determines whether a review should display visual duplicate indicators.
 * Failed OCR runs never produce a verified pHash comparison, so stale
 * import-time duplicate flags are suppressed whenever `ocrStatus === "FAILED"`.
 */
export function hasConfirmedDuplicate(
  item?: { isDuplicate?: boolean | null; ocrStatus?: string | null } | null
): boolean {
  return Boolean(item?.isDuplicate && item.ocrStatus !== "FAILED");
}

/**
 * Resolves a stored Eviden Ulasan path (remote Drive URL or local relative path)
 * into a safe application URL, normalizing any leading slash or `uploads/` prefix.
 */
export function resolveEvidenceImageUrl(
  evidenceImagePath?: string | null,
  reviewId?: string | null
): string {
  if (!evidenceImagePath) return "";
  if (evidenceImagePath.startsWith("http")) {
    return reviewId ? `/api/evidence/proxy/${reviewId}` : evidenceImagePath;
  }

  let cleanPath = evidenceImagePath.startsWith("/")
    ? evidenceImagePath.slice(1)
    : evidenceImagePath;

  if (cleanPath.startsWith("uploads/")) {
    cleanPath = cleanPath.slice("uploads/".length);
  }

  return `/api/uploads/${cleanPath}`;
}

export interface ValidationStatusDisplayMeta {
  status: ReviewValidationStatusValue;
  label: string;
  shortLabel: string;
  badgeClass: string;
}

const VALIDATION_STATUS_META_MAP: Record<
  ReviewValidationStatusValue,
  ValidationStatusDisplayMeta
> = {
  APPROVED: {
    status: "APPROVED",
    label: "Disetujui",
    shortLabel: "Disetujui",
    badgeClass: "bg-[#ecfdf5] text-[#15803d] border-[#a7f3d0]",
  },
  REJECTED: {
    status: "REJECTED",
    label: "Ditolak",
    shortLabel: "Ditolak",
    badgeClass: "bg-[#fef2f2] text-[#b91c1c] border-[#fee2e2]",
  },
  NEEDS_REVIEW: {
    status: "NEEDS_REVIEW",
    label: "Perlu Triase",
    shortLabel: "Perlu Triase",
    badgeClass: "bg-[#fefce8] text-[#a16207] border-[#fde047]",
  },
  PENDING: {
    status: "PENDING",
    label: "Menunggu Verifikasi",
    shortLabel: "Menunggu",
    badgeClass: "bg-[#fff7ed] text-[#b45309] border-[#fed7aa]",
  },
};

export function getValidationStatusMeta(
  status?: string | null
): ValidationStatusDisplayMeta {
  if (
    status === "APPROVED" ||
    status === "REJECTED" ||
    status === "NEEDS_REVIEW" ||
    status === "PENDING"
  ) {
    return VALIDATION_STATUS_META_MAP[status];
  }
  return VALIDATION_STATUS_META_MAP.PENDING;
}
