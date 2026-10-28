import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { Queue } from "bullmq";
import { OcrJobData } from "@/server/queues/ocrQueue";
import { createOcrWorker } from "@/server/workers/ocrWorker";
import path from "path";

describe("Task 3: OCR Worker Pipeline & Anti-Fraud Soft-Flagging Integration", () => {
  const TEST_QUEUE_NAME = "ocr-pipeline-test-queue";
  let testQueue: Queue<OcrJobData>;
  let worker: ReturnType<typeof createOcrWorker>;
  let firstReviewId: string;
  let secondReviewId: string;
  let up3Id: string;
  let ulpId: string;
  let versionId: string;

  const sampleImagePath = path.resolve(process.cwd(), "uploads/test/sample_budi.png");

  beforeAll(async () => {
    testQueue = new Queue<OcrJobData>(TEST_QUEUE_NAME, { connection: redis });

    // 1. Clean up existing reviews with this test image
    await prisma.ratingReview.deleteMany({
      where: {
        evidenceImagePath: sampleImagePath,
      },
    });

    const ulp = await prisma.uLP.findFirst({
      where: { code: "ULP_RIV" },
      include: { up3: true },
    });
    const version = await prisma.appVersion.findFirst({
      where: { version: "V5.2.79" },
    });

    ulpId = ulp!.id;
    up3Id = ulp!.up3Id;
    versionId = version!.id;

    await testQueue.drain();
    await testQueue.clean(0, 1000, "wait");
    await testQueue.clean(0, 1000, "active");

    worker = createOcrWorker(TEST_QUEUE_NAME);
  });

  afterAll(async () => {
    await prisma.ratingReview.deleteMany({
      where: {
        id: { in: [firstReviewId, secondReviewId].filter(Boolean) },
      },
    });

    await worker.close();
    await testQueue.close();
    await prisma.$disconnect();
    redis.disconnect();
  });

  it("should process first submission, approve via OCR, and store 64-bit pHash", async () => {
    const rev1 = await prisma.ratingReview.create({
      data: {
        up3Id,
        ulpId,
        appVersionId: versionId,
        playstoreReviewerName: "Budi Santoso",
        evidenceImagePath: sampleImagePath,
        validationStatus: "PENDING",
        entryDate: new Date("2026-05-15"),
        timestamp: new Date(),
      },
    });
    firstReviewId = rev1.id;

    const jobCompletedPromise = new Promise<{ returnvalue: any }>((resolve) => {
      worker.on("completed", (job) => {
        if (job.data.reviewId === firstReviewId) {
          resolve({ returnvalue: job.returnvalue });
        }
      });
    });

    await testQueue.add("pipeline-first-sub", {
      reviewId: firstReviewId,
      evidenceImagePath: sampleImagePath,
      expectedReviewerName: "Budi Santoso",
    });

    const completion = await jobCompletedPromise;
    expect(completion.returnvalue.success).toBe(true);
    expect(completion.returnvalue.isDuplicate).toBe(false);

    const updatedRev1 = await prisma.ratingReview.findUnique({
      where: { id: firstReviewId },
    });

    expect(updatedRev1?.validationStatus).toBe("APPROVED");
    expect(updatedRev1?.isDuplicate).toBe(false);
    expect(updatedRev1?.evidenceImageHash).toHaveLength(16);
    expect(updatedRev1?.confidenceScore).toBeGreaterThanOrEqual(90.0);
  });

  it("should soft-flag second submission using the same image as duplicate without deleting either record", async () => {
    const rev2 = await prisma.ratingReview.create({
      data: {
        up3Id,
        ulpId,
        appVersionId: versionId,
        playstoreReviewerName: "Budi Santoso",
        evidenceImagePath: sampleImagePath,
        validationStatus: "PENDING",
        entryDate: new Date("2026-05-16"), // Different entry date (fraud attempt)
        timestamp: new Date(),
      },
    });
    secondReviewId = rev2.id;

    const jobCompletedPromise = new Promise<{ returnvalue: any }>((resolve) => {
      worker.on("completed", (job) => {
        if (job.data.reviewId === secondReviewId) {
          resolve({ returnvalue: job.returnvalue });
        }
      });
    });

    await testQueue.add("pipeline-second-sub", {
      reviewId: secondReviewId,
      evidenceImagePath: sampleImagePath,
      expectedReviewerName: "Budi Santoso",
    });

    const completion = await jobCompletedPromise;
    expect(completion.returnvalue.isDuplicate).toBe(true);
    expect(completion.returnvalue.duplicateOfId).toBe(firstReviewId);

    // Verify second review was soft-flagged with REJECTED status
    const updatedRev2 = await prisma.ratingReview.findUnique({
      where: { id: secondReviewId },
    });

    expect(updatedRev2?.isDuplicate).toBe(true);
    expect(updatedRev2?.duplicateOfId).toBe(firstReviewId);
    expect(updatedRev2?.validationStatus).toBe("REJECTED");
    expect(updatedRev2?.reviewRemarks).toContain("Terindikasi duplikasi visual");

    // CRITICAL: Zero data loss - Verify first review is still intact
    const originalStillExists = await prisma.ratingReview.findUnique({
      where: { id: firstReviewId },
    });
    expect(originalStillExists).toBeDefined();
    expect(originalStillExists?.validationStatus).toBe("APPROVED");
  });
});
