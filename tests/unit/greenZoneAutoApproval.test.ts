import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/prisma";
import * as ocrBridgeModule from "@/server/services/ocrBridge";
import * as antiFraudModule from "@/server/services/antiFraudService";
import { processOcrJob } from "@/server/workers/ocrWorker";
import { ValidationStatus } from "@prisma/client";

describe("Green Zone Auto-Approval Verification Suite (Skor OCR >= 90%)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should automatically set validationStatus to APPROVED (True) when OCR score is in green zone (>= 90%)", async () => {
    const mockReviewId = "test-green-zone-review-1";

    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValue({
      id: mockReviewId,
      source: "MIGRATION",
      playstoreReviewerName: "Ahmad Dahlan",
      evidenceImagePath: "https://drive.google.com/file/d/sample/view",
      validationStatus: ValidationStatus.PENDING,
      verifiedAt: null,
      reviewRemarks: null,
    } as any);

    vi.spyOn(ocrBridgeModule, "executeOcrBridge").mockResolvedValue({
      success: true,
      extracted_text: "Ahmad Dahlan Ulasan Bintang Lima",
      phash: "1010101010101010",
      similarity_score: 95.0,
      zone: "GREEN",
      recommended_status: ValidationStatus.APPROVED,
      execution_time_ms: 120,
    });

    vi.spyOn(antiFraudModule, "checkImageDuplicate").mockResolvedValue({
      isDuplicate: false,
      duplicateOfId: null,
      minDistance: 64,
      visualSimilarity: 0,
      textSimilarity: 0,
      reviewerSimilarity: 0,
    });

    const updateSpy = vi.spyOn(prisma.ratingReview, "update").mockResolvedValue({} as any);

    // Mock fetch for image streaming
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer),
    });

    // Execute ocrWorker processor for this review
    const mockJob = {
      id: "job-green-1",
      data: {
        reviewId: mockReviewId,
        evidenceImagePath: "https://drive.google.com/file/d/sample/view",
        expectedReviewerName: "Ahmad Dahlan",
      },
      updateProgress: vi.fn(),
    } as any;

    await processOcrJob(mockJob);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockReviewId },
        data: expect.objectContaining({
          ocrStatus: "COMPLETED",
          confidenceScore: 95.0,
          validationStatus: "APPROVED",
        }),
      })
    );
  });

  it("should override initial REJECTED status to APPROVED when OCR score is 100% and not duplicate", async () => {
    const mockReviewId = "test-green-zone-override-rejected";

    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValue({
      id: mockReviewId,
      source: "MIGRATION",
      playstoreReviewerName: "Syarika Aja",
      evidenceImagePath: "https://drive.google.com/file/d/sample2/view",
      validationStatus: ValidationStatus.REJECTED, // Previously false from CSV Column 12
      verifiedAt: null,
      reviewRemarks: null,
    } as any);

    vi.spyOn(ocrBridgeModule, "executeOcrBridge").mockResolvedValue({
      success: true,
      extracted_text: "Syarika Aja PLN Mobile Terbaik",
      phash: "1111000011110000",
      similarity_score: 100.0,
      zone: "GREEN",
      recommended_status: ValidationStatus.APPROVED,
      execution_time_ms: 100,
    });

    vi.spyOn(antiFraudModule, "checkImageDuplicate").mockResolvedValue({
      isDuplicate: false,
      duplicateOfId: null,
      minDistance: 64,
      visualSimilarity: 0,
      textSimilarity: 0,
      reviewerSimilarity: 0,
    });

    const updateSpy = vi.spyOn(prisma.ratingReview, "update").mockResolvedValue({} as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer),
    });

    const mockJob = {
      id: "job-green-2",
      data: {
        reviewId: mockReviewId,
        evidenceImagePath: "https://drive.google.com/file/d/sample2/view",
        expectedReviewerName: "Syarika Aja",
      },
      updateProgress: vi.fn(),
    } as any;

    await processOcrJob(mockJob);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockReviewId },
        data: expect.objectContaining({
          ocrStatus: "COMPLETED",
          confidenceScore: 100.0,
          validationStatus: "APPROVED",
        }),
      })
    );
  });

  it("should keep status REJECTED if fraud duplicate detected even if OCR score is >= 90%", async () => {
    const mockReviewId = "test-fraud-duplicate";

    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValue({
      id: mockReviewId,
      source: "MIGRATION",
      playstoreReviewerName: "Fraud Reviewer",
      evidenceImagePath: "https://drive.google.com/file/d/fraud/view",
      validationStatus: ValidationStatus.PENDING,
      verifiedAt: null,
      reviewRemarks: null,
    } as any);

    vi.spyOn(ocrBridgeModule, "executeOcrBridge").mockResolvedValue({
      success: true,
      extracted_text: "Fraud Reviewer",
      phash: "1111111100000000",
      similarity_score: 98.0,
      zone: "GREEN",
      recommended_status: ValidationStatus.APPROVED,
      execution_time_ms: 90,
    });

    // Anti-fraud flags visual duplicate
    vi.spyOn(antiFraudModule, "checkImageDuplicate").mockResolvedValue({
      isDuplicate: true,
      duplicateOfId: "original-review-123",
      minDistance: 1,
      visualSimilarity: 99,
      textSimilarity: 98,
      reviewerSimilarity: 100,
    });

    const updateSpy = vi.spyOn(prisma.ratingReview, "update").mockResolvedValue({} as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer),
    });

    const mockJob = {
      id: "job-fraud-1",
      data: {
        reviewId: mockReviewId,
        evidenceImagePath: "https://drive.google.com/file/d/fraud/view",
        expectedReviewerName: "Fraud Reviewer",
      },
      updateProgress: vi.fn(),
    } as any;

    await processOcrJob(mockJob);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockReviewId },
        data: expect.objectContaining({
          isDuplicate: true,
          validationStatus: "REJECTED",
        }),
      })
    );
  });
});
