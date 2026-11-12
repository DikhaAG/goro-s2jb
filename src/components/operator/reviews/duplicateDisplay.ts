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

