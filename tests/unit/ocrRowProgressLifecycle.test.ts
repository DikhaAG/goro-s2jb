import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import { OcrProcessingStatus } from "@prisma/client";
import { appRouter } from "@/server/routers/_app";

describe("Row-Level Background OCR Worker & Image Proxy Progress Tracking", () => {
  let up3Id: string;
  let ulpId: string;
  let versionId: string;
  const createdReviewIds: string[] = [];

  beforeAll(async () => {
    // 1. Ensure master UP3, ULP, and AppVersion exist
    const up3 = await prisma.uP3.upsert({
      where: { code: "UP3_TEST_OCR_PROGRESS" },
      update: {},
      create: { code: "UP3_TEST_OCR_PROGRESS", name: "UP3 OCR Progress Test" },
    });
    up3Id = up3.id;

    const ulp = await prisma.uLP.upsert({
      where: { code: "ULP_TEST_OCR_PROGRESS" },
      update: {},
      create: {
        code: "ULP_TEST_OCR_PROGRESS",
        name: "ULP OCR Progress Test",
        up3Id: up3.id,
      },
    });
    ulpId = ulp.id;

    const version = await prisma.appVersion.upsert({
      where: { version: "v5.1.0-test" },
      update: {},
      create: { version: "v5.1.0-test" },
    });
    versionId = version.id;
  });

  afterAll(async () => {
    if (createdReviewIds.length > 0) {
      await prisma.ratingReview.deleteMany({
        where: { id: { in: createdReviewIds } },
      });
    }
    await prisma.uLP.deleteMany({
      where: { code: "ULP_TEST_OCR_PROGRESS" },
    });
    await prisma.uP3.deleteMany({
      where: { code: "UP3_TEST_OCR_PROGRESS" },
    });
    await prisma.appVersion.deleteMany({
      where: { version: "v5.1.0-test" },
    });
  });

  it("should initialize newly inserted review row with QUEUED ocrStatus", async () => {
    const review = await prisma.ratingReview.create({
      data: {
        up3Id,
        ulpId,
        appVersionId: versionId,
        playstoreReviewerName: "Budi Antrean",
        entryDate: new Date("2026-07-02"),
        timestamp: new Date(),
        evidenceImagePath: "https://drive.google.com/open?id=test_queued_file",
        validationStatus: "PENDING",
        ocrStatus: OcrProcessingStatus.QUEUED,
      },
    });
    createdReviewIds.push(review.id);

    expect(review.ocrStatus).toBe("QUEUED");
    expect(review.confidenceScore).toBeNull();
    expect(review.extractedOcrText).toBeNull();
  });

  it("should track intermediate states DOWNLOADING and PROCESSING as active background progress", async () => {
    const review = await prisma.ratingReview.create({
      data: {
        up3Id,
        ulpId,
        appVersionId: versionId,
        playstoreReviewerName: "Siti Unduh",
        entryDate: new Date("2026-07-02"),
        timestamp: new Date(),
        evidenceImagePath: "https://drive.google.com/open?id=test_download_file",
        validationStatus: "PENDING",
        ocrStatus: OcrProcessingStatus.DOWNLOADING,
      },
    });
    createdReviewIds.push(review.id);

    // Verify DOWNLOADING state
    const fetchedDownloading = await prisma.ratingReview.findUnique({
      where: { id: review.id },
    });
    expect(fetchedDownloading?.ocrStatus).toBe("DOWNLOADING");

    // Transition to PROCESSING
    const updatedProcessing = await prisma.ratingReview.update({
      where: { id: review.id },
      data: { ocrStatus: OcrProcessingStatus.PROCESSING },
    });
    expect(updatedProcessing.ocrStatus).toBe("PROCESSING");
  });

  it("should transition to COMPLETED when OCR extraction and anti-fraud succeed", async () => {
    const review = await prisma.ratingReview.create({
      data: {
        up3Id,
        ulpId,
        appVersionId: versionId,
        playstoreReviewerName: "Rian Sukses",
        entryDate: new Date("2026-07-02"),
        timestamp: new Date(),
        evidenceImagePath: "evidence/2026/07/02/eviden_test.jpg",
        validationStatus: "APPROVED",
        ocrStatus: OcrProcessingStatus.COMPLETED,
        confidenceScore: 95.5,
        extractedOcrText: "Ulasan Anda Rian Sukses Aplikasi sangat membantu",
        evidenceImageHash: "1234567890abcdef",
      },
    });
    createdReviewIds.push(review.id);

    const fetched = await prisma.ratingReview.findUnique({
      where: { id: review.id },
    });
    expect(fetched?.ocrStatus).toBe("COMPLETED");
    expect(fetched?.confidenceScore).toBe(95.5);
    expect(fetched?.validationStatus).toBe("APPROVED");
  });

  it("should transition to FAILED with descriptive reviewRemarks if image link is unaccessible", async () => {
    const review = await prisma.ratingReview.create({
      data: {
        up3Id,
        ulpId,
        appVersionId: versionId,
        playstoreReviewerName: "Dewi Gagal",
        entryDate: new Date("2026-07-02"),
        timestamp: new Date(),
        evidenceImagePath: "https://drive.google.com/open?id=invalid_broken_link",
        validationStatus: "NEEDS_REVIEW",
        ocrStatus: OcrProcessingStatus.FAILED,
        reviewRemarks: "OCR Gagal: Tautan gambar tidak dapat diakses (Google Drive 404 Not Found)",
      },
    });
    createdReviewIds.push(review.id);

    const fetched = await prisma.ratingReview.findUnique({
      where: { id: review.id },
    });
    expect(fetched?.ocrStatus).toBe("FAILED");
    expect(fetched?.reviewRemarks).toContain("OCR Gagal");
    expect(fetched?.validationStatus).toBe("NEEDS_REVIEW");
  });

  it("should return inProgressOcrCount in triage metrics and allow filtering by ocrStatus", async () => {
    const caller = appRouter.createCaller({
      user: {
        id: "mock_operator_id",
        username: "operator_test",
        name: "Operator Test",
        role: "PEGAWAI",
      },
      prisma,
    } as any);

    const res = await caller.triage.getQueue({
      up3Id,
      status: "ALL",
      ocrStatus: "ALL",
    });

    expect(res.metrics).toBeDefined();
    expect(res.metrics.inProgressOcrCount).toBeGreaterThanOrEqual(1); // includes Siti Unduh (PROCESSING) or Budi Antrean (QUEUED)

    // Filter specifically for in-progress OCR rows
    const inProgressRes = await caller.triage.getQueue({
      up3Id,
      status: "ALL",
      ocrStatus: "PROCESSING",
    });

    expect(inProgressRes.items.length).toBeGreaterThanOrEqual(1);
    expect(inProgressRes.items.every((item: any) => item.ocrStatus === "PROCESSING")).toBe(true);

    // Filter specifically for failed rows
    const failedRes = await caller.triage.getQueue({
      up3Id,
      status: "ALL",
      ocrStatus: "FAILED",
    });

    expect(failedRes.items.length).toBeGreaterThanOrEqual(1);
    expect(failedRes.items.every((item: any) => item.ocrStatus === "FAILED")).toBe(true);
  });

  it("should allow operator to retry a failed OCR row, resetting ocrStatus back to QUEUED", async () => {
    const failedReview = await prisma.ratingReview.create({
      data: {
        up3Id,
        ulpId,
        appVersionId: versionId,
        playstoreReviewerName: "Rudi Retry",
        entryDate: new Date("2026-07-02"),
        timestamp: new Date(),
        evidenceImagePath: "https://drive.google.com/open?id=retry_candidate",
        validationStatus: "NEEDS_REVIEW",
        ocrStatus: OcrProcessingStatus.FAILED,
        reviewRemarks: "OCR Gagal: Timeout",
      },
    });
    createdReviewIds.push(failedReview.id);

    const caller = appRouter.createCaller({
      user: {
        id: "mock_operator_id",
        username: "operator_test",
        name: "Operator Test",
        role: "PEGAWAI",
      },
      prisma,
    } as any);

    const retryRes = await caller.triage.retryOcr({ reviewId: failedReview.id });
    expect(retryRes.success).toBe(true);

    const afterRetry = await prisma.ratingReview.findUnique({
      where: { id: failedReview.id },
    });
    expect(afterRetry?.ocrStatus).toBe("QUEUED");
    expect(afterRetry?.reviewRemarks).toContain("Dipicu ulang oleh operator");
  });
});
