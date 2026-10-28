import { describe, it, expect, afterAll } from "vitest";
import { ocrQueue, OCR_QUEUE_NAME } from "@/server/queues/ocrQueue";
import redis from "@/lib/redis";

describe("BullMQ & Redis Queue Connection", () => {
  afterAll(async () => {
    await ocrQueue.close();
    redis.disconnect();
  });

  it("should connect to Redis and add a job to ocrQueue", async () => {
    const jobData = {
      reviewId: "test_rev_123",
      evidenceImagePath: "evidence/test/sample.jpg",
      expectedReviewerName: "Ahmad Dani",
    };

    const job = await ocrQueue.add("test-ocr-job", jobData);

    expect(job.id).toBeDefined();
    expect(job.name).toBe("test-ocr-job");
    expect(job.data.reviewId).toBe("test_rev_123");

    // Retrieve job from queue
    const fetchedJob = await ocrQueue.getJob(job.id!);
    expect(fetchedJob).toBeDefined();
    expect(fetchedJob?.data.expectedReviewerName).toBe("Ahmad Dani");

    // Clean up
    await job.remove();
  });
});
