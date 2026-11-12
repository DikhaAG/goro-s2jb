import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewsTable, type ReviewItem } from "@/components/operator/reviews/ReviewsTable";

function buildReviewItem(overrides: Partial<ReviewItem>): ReviewItem {
  return {
    id: "rev-1",
    source: "MIGRATION",
    playstoreReviewerName: "NOFRIAN",
    originalReviewerName: "NOFRIAN",
    entryDate: "2026-10-26T10:00:00.000Z",
    up3: { id: "up3-1", code: "11", name: "UP3 BENGKULU" },
    ulp: { id: "ulp-1", code: "111", name: "ULP ARGA MAKMUR" },
    appVersion: { id: "ver-1", version: "5.2.79" },
    confidenceScore: null,
    ocrStatus: "FAILED",
    validationStatus: "PENDING",
    isDuplicate: false,
    duplicateOfId: null,
    duplicateOf: null,
    evidenceImagePath: "https://drive.google.com/file/d/sample/view",
    extractedOcrText: null,
    fieldNotes: null,
    reviewRemarks: null,
    ...overrides,
  };
}

function renderTable(items: ReviewItem[]) {
  return renderToStaticMarkup(
    <ReviewsTable
      items={items}
      isLoading={false}
      selectedIds={[]}
      onToggleSelect={vi.fn()}
      onToggleSelectAll={vi.fn()}
      isAllSelected={false}
      sortBy="entryDate"
      sortOrder="desc"
      onSortChange={vi.fn()}
      page={1}
      pageSize={25}
      totalPages={1}
      totalCount={items.length}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
      onOpenDetail={vi.fn()}
      onRetryOcr={vi.fn()}
      onOpenDelete={vi.fn()}
      onOpenDuplicateSplitView={vi.fn()}
    />
  );
}

describe("ReviewsTable duplicate guard for FAILED OCR rows", () => {
  it("suppresses DUP badge, Duplikat Visual card, and Split View actions when ocrStatus is FAILED even if isDuplicate is true", () => {
    const failedRow = buildReviewItem({
      id: "rev-failed-dup",
      ocrStatus: "FAILED",
      isDuplicate: true,
      duplicateOfId: null,
      reviewRemarks: "OCR Gagal: Layanan OCR tidak dapat dihubungi",
    });

    const html = renderTable([failedRow]);

    expect(html).not.toContain(">DUP<");
    expect(html).not.toContain("Duplikat Visual");
    expect(html).not.toContain("Bandingkan (Split View)");
    expect(html).not.toContain('aria-label="Split view perbandingan duplikat"');
    expect(html).toContain("OCR Gagal: Layanan OCR tidak dapat dihubungi");
    expect(html).toContain("Gagal");
  });

  it("renders DUP badge, Duplikat Visual card, and Split View actions for genuine COMPLETED duplicate rows", () => {
    const duplicateRow = buildReviewItem({
      id: "rev-completed-dup",
      ocrStatus: "COMPLETED",
      confidenceScore: 95,
      validationStatus: "REJECTED",
      isDuplicate: true,
      duplicateOfId: "rev-original-1",
      reviewRemarks: "Duplikat visual terdeteksi",
    });

    const html = renderTable([duplicateRow]);

    expect(html).toContain(">DUP<");
    expect(html).toContain("Duplikat Visual");
    expect(html).toContain("Bandingkan (Split View)");
    expect(html).toContain('aria-label="Split view perbandingan duplikat"');
  });
});
