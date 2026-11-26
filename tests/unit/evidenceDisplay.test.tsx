import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getValidationStatusMeta,
  hasConfirmedDuplicate,
  resolveEvidenceImageUrl,
} from "@/lib/evidenceDisplay";
import { EvidenceLightbox } from "@/components/operator/EvidenceLightbox";
import { ReviewsTable, type ReviewItem } from "@/components/operator/reviews/ReviewsTable";

describe("Eviden Ulasan Display Helpers & UI Consistency", () => {
  it("normalizes remote and local evidence image paths consistently", () => {
    expect(resolveEvidenceImageUrl(null, "rev-1")).toBe("");
    expect(
      resolveEvidenceImageUrl("https://drive.google.com/file/d/123/view", "rev-1")
    ).toBe("/api/evidence/proxy/rev-1");
    expect(resolveEvidenceImageUrl("uploads/2026/img.png", "rev-1")).toBe(
      "/api/uploads/2026/img.png"
    );
    expect(resolveEvidenceImageUrl("/uploads/2026/img.png", "rev-1")).toBe(
      "/api/uploads/2026/img.png"
    );
    expect(resolveEvidenceImageUrl("/2026/img.png", "rev-1")).toBe(
      "/api/uploads/2026/img.png"
    );
    expect(resolveEvidenceImageUrl("2026/img.png", "rev-1")).toBe(
      "/api/uploads/2026/img.png"
    );
  });

  it("suppresses duplicate badge in EvidenceLightbox when ocrStatus is FAILED", () => {
    expect(hasConfirmedDuplicate({ isDuplicate: true, ocrStatus: "FAILED" })).toBe(
      false
    );
    expect(hasConfirmedDuplicate({ isDuplicate: true, ocrStatus: "COMPLETED" })).toBe(
      true
    );

    const html = renderToStaticMarkup(
      <EvidenceLightbox
        isOpen={true}
        onClose={vi.fn()}
        item={{
          id: "rev-failed",
          playstoreReviewerName: "NOFRIAN",
          evidenceImagePath: "uploads/test/img.png",
          confidenceScore: null,
          ocrStatus: "FAILED",
          validationStatus: "NEEDS_REVIEW",
          extractedOcrText: null,
          isDuplicate: true,
          duplicateOf: {
            id: "orig-1",
            playstoreReviewerName: "ASLI",
            entryDate: "2026-10-26T10:00:00.000Z",
            evidenceImagePath: "uploads/test/orig.png",
          },
          entryDate: "2026-10-26T10:00:00.000Z",
        }}
      />
    );

    expect(html).not.toContain("DUPLIKAT VISUAL");
    expect(html).not.toContain("Terindikasi Duplikasi Visual");
    expect(html).toContain("/api/uploads/test/img.png");
  });

  it("renders NEEDS_REVIEW status badge as Perlu Triase in ReviewsTable", () => {
    expect(getValidationStatusMeta("NEEDS_REVIEW").shortLabel).toBe("Perlu Triase");

    const row: ReviewItem = {
      id: "rev-nr",
      source: "INTAKE",
      playstoreReviewerName: "SITI",
      originalReviewerName: "SITI",
      entryDate: "2026-10-26T10:00:00.000Z",
      up3: { id: "up3-1", code: "11", name: "UP3 PLG" },
      ulp: { id: "ulp-1", code: "111", name: "ULP RIVAI" },
      appVersion: { id: "ver-1", version: "6.0.0" },
      confidenceScore: 81.2,
      ocrStatus: "COMPLETED",
      validationStatus: "NEEDS_REVIEW",
      isDuplicate: false,
      duplicateOfId: null,
      duplicateOf: null,
      evidenceImagePath: "uploads/test/siti.png",
      extractedOcrText: "SITI",
      fieldNotes: null,
      reviewRemarks: null,
    };

    const html = renderToStaticMarkup(
      <ReviewsTable
        items={[row]}
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
        totalCount={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onOpenDetail={vi.fn()}
        onRetryOcr={vi.fn()}
        onOpenDelete={vi.fn()}
      />
    );

    expect(html).toContain("Perlu Triase");
    expect(html).toContain("/api/uploads/test/siti.png");
  });
});
