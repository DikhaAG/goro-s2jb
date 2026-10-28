import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { ocrQueue } from "@/server/queues/ocrQueue";
import { createOcrWorker } from "@/server/workers/ocrWorker";
import path from "path";

describe("BullMQ Worker End-to-End Processing", () => {
  let worker: ReturnType<typeof createOcrWorker>;
  let testReviewId: string;
  let testUlpId: string;
  let testUp3Id: string;
  let testVersionId: string;

  beforeAll(async () => {
    // Clean up any lingering test reviews
    await prisma.ratingReview.deleteMany({
      where: {
        evidenceImagePath: "uploads/test/sample_budi.png",
      },
    });

    // Fetch master records
    const ulp = await prisma.uLP.findFirst({
      where: { code: "ULP_RIV" },
      include: { up3: true },
    });
    const version = await prisma.appVersion.findFirst({
      where: { version: "V5.2.79" },
    });

    testUlpId = ulp!.id;
    testUp3Id = ulp!.up3Id;
    testVersionId = version!.id;

    // Create test review
    const review = await prisma.ratingReview.create({
      data: {
        up3Id: testUp3Id,
        ulpId: testUlpId,
        appVersionId: testVersionId,
        playstoreReviewerName: "Budi Santoso",
        originalReviewerName: "Budi Santoso",
        evidenceImagePath: "uploads/test/sample_budi.png",
        validationStatus: "PENDING",
        entryDate: new Date("2026-05-15"),
        timestamp: new Date("2026-05-15T08:30:00Z"),
      },
    });

    testReviewId = review.id;
    worker = createOcrWorker();
  });

  afterAll(async () => {
    if (testReviewId) {
      await prisma.ratingReview.delete({ where: { id: testReviewId } }).catch(() => {});
    }
    await worker.close();
    await ocrQueue.close();
    await prisma.$disconnect();
    redis.disconnect();
  });

  it("should process job through BullMQ worker, calculate pHash, and update DB validationStatus", async () => {
    const jobCompletedPromise = new Promise<{ returnvalue: any }>((resolve) => {
      worker.on("completed", (job) => {
        if (job.data.reviewId === testReviewId) {
          resolve({ returnvalue: job.returnvalue });
        }
      });
    });

    await ocrQueue.add("test-e2e-worker", {
      reviewId: testReviewId,
      evidenceImagePath: path.resolve(process.cwd(), "uploads/test/sample_budi.png"),
      expectedReviewerName: "Budi Santoso",
    });

    const completion = await jobCompletedPromise;

    expect(completion.returnvalue.success).toBe(true);
    expect(completion.returnvalue.zone).toBe("GREEN");

    // Verify DB update
    const updatedReview = await prisma.ratingReview.findUnique({
      where: { id: testReviewId },
    });

    expect(updatedReview).toBeDefined();
    expect(updatedReview?.evidenceImageHash).toBeDefined();
    expect(updatedReview?.evidenceImageHash?.length).toBe(16);
    expect(updatedReview?.confidenceScore).toBeGreaterThanOrEqual(80.0);
    expect(updatedReview?.validationStatus).toBe("APPROVED");
    expect(updatedReview?.extractedOcrText?.toLowerCase()).toContain("budi");
  });
});
