import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processOcrJob } from "@/server/workers/ocrWorker";
import * as ocrBridgeModule from "@/server/services/ocrBridge";
import * as evidenceDownloaderModule from "@/server/services/evidenceDownloader";
import { prisma } from "@/lib/prisma";
import { ValidationStatus } from "@prisma/client";

describe("processOcrJob failure cleanup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resets isDuplicate and duplicateOfId when evidence image streaming fails", async () => {
    const mockReviewId = "rev-stream-fail-1";

    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValue({
      id: mockReviewId,
      source: "MIGRATION",
      playstoreReviewerName: "Nofran",
      evidenceImagePath: "https://drive.google.com/file/d/missing/view",
      validationStatus: ValidationStatus.PENDING,
      isDuplicate: true,
      duplicateOfId: null,
      verifiedAt: null,
      reviewRemarks: null,
    } as any);

    vi.spyOn(evidenceDownloaderModule, "streamEvidenceImageBuffer").mockResolvedValue({
      success: false,
      error: "Drive HTTP 403 Forbidden",
    } as any);

    const updateSpy = vi
      .spyOn(prisma.ratingReview, "update")
      .mockResolvedValue({} as any);

    const result = await processOcrJob({
      id: "job-stream-fail",
      data: {
        reviewId: mockReviewId,
        evidenceImagePath: "https://drive.google.com/file/d/missing/view",
        expectedReviewerName: "Nofran",
      },
      updateProgress: vi.fn(),
    } as any);

    expect(result.success).toBe(false);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockReviewId },
        data: expect.objectContaining({
          ocrStatus: "FAILED",
          validationStatus: "NEEDS_REVIEW",
          isDuplicate: false,
          duplicateOfId: null,
        }),
      })
    );
  });

  it("resets isDuplicate and duplicateOfId when executeOcrBridge fails", async () => {
    const mockReviewId = "rev-ocr-fail-1";

    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValue({
      id: mockReviewId,
      source: "MIGRATION",
      playstoreReviewerName: "Kintala puji",
      evidenceImagePath: "https://drive.google.com/file/d/sample/view",
      validationStatus: ValidationStatus.PENDING,
      isDuplicate: true,
      duplicateOfId: null,
      verifiedAt: null,
      reviewRemarks: null,
    } as any);

    vi.spyOn(evidenceDownloaderModule, "streamEvidenceImageBuffer").mockResolvedValue({
      success: true,
      buffer: Buffer.from("fake-image-bytes"),
      contentType: "image/jpeg",
    } as any);

    vi.spyOn(ocrBridgeModule, "executeOcrBridge").mockResolvedValue({
      success: false,
      extracted_text: "",
      phash: "",
      similarity_score: 0,
      zone: "RED",
      recommended_status: ValidationStatus.REJECTED,
      execution_time_ms: 50,
      error: "Layanan OCR tidak dapat dihubungi",
    });

    const updateSpy = vi
      .spyOn(prisma.ratingReview, "update")
      .mockResolvedValue({} as any);

    const result = await processOcrJob({
      id: "job-ocr-fail",
      data: {
        reviewId: mockReviewId,
        evidenceImagePath: "https://drive.google.com/file/d/sample/view",
        expectedReviewerName: "Kintala puji",
      },
      updateProgress: vi.fn(),
    } as any);

    expect(result.success).toBe(false);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockReviewId },
        data: expect.objectContaining({
          ocrStatus: "FAILED",
          validationStatus: "NEEDS_REVIEW",
          isDuplicate: false,
          duplicateOfId: null,
        }),
      })
    );
  });
});
