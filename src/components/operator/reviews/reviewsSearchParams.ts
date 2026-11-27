import {
  parseAsBoolean,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";

// These lists mirror the reviews.getList input schema in src/server/routers/reviews.ts.
export const VALIDATION_STATUS_FILTERS = ["ALL", "PENDING", "NEEDS_REVIEW", "APPROVED", "REJECTED"] as const;
export const OCR_STATUS_FILTERS = ["ALL", "QUEUED", "DOWNLOADING", "PROCESSING", "COMPLETED", "FAILED"] as const;
export const VALIDATION_ZONE_FILTERS = ["ALL", "GREEN", "YELLOW", "RED"] as const;
export const REVIEW_SORT_COLUMNS = ["entryDate", "timestamp", "confidenceScore", "playstoreReviewerName"] as const;
export const REVIEW_PAGE_SIZES = [10, 25, 50, 100] as const;

export type ValidationStatusFilter = (typeof VALIDATION_STATUS_FILTERS)[number];
export type OcrStatusFilter = (typeof OCR_STATUS_FILTERS)[number];
export type ValidationZoneFilter = (typeof VALIDATION_ZONE_FILTERS)[number];
export type ReviewSortColumn = (typeof REVIEW_SORT_COLUMNS)[number];
export type ReviewPageSize = (typeof REVIEW_PAGE_SIZES)[number];

export function isReviewSortColumn(value: string): value is ReviewSortColumn {
  return (REVIEW_SORT_COLUMNS as readonly string[]).includes(value);
}

export function isReviewPageSize(value: number): value is ReviewPageSize {
  return (REVIEW_PAGE_SIZES as readonly number[]).includes(value);
}

export const reviewsSearchParams = {
  search: parseAsString.withDefault(""),
  validationStatus: parseAsStringLiteral(VALIDATION_STATUS_FILTERS).withDefault("ALL"),
  ocrStatus: parseAsStringLiteral(OCR_STATUS_FILTERS).withDefault("ALL"),
  validationZone: parseAsStringLiteral(VALIDATION_ZONE_FILTERS).withDefault("ALL"),
  up3Id: parseAsString.withDefault(""),
  ulpId: parseAsString.withDefault(""),
  isDuplicate: parseAsBoolean,
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsNumberLiteral(REVIEW_PAGE_SIZES).withDefault(25),
  sortBy: parseAsStringLiteral(REVIEW_SORT_COLUMNS).withDefault("entryDate"),
  sortOrder: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
};

/** Clears every filter and returns to page 1, leaving sort order and page size alone. */
export const CLEARED_FILTERS = {
  search: null,
  validationStatus: null,
  ocrStatus: null,
  validationZone: null,
  up3Id: null,
  ulpId: null,
  isDuplicate: null,
  page: null,
};
