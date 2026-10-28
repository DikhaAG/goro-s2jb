import { describe, it, expect, afterAll } from "vitest";
import { Queue } from "bullmq";
import redis from "@/lib/redis";

describe("BullMQ & Redis Queue Connection", () => {
  const testQueue = new Queue("test-connectivity-queue", {
    connection: redis,
  });

  afterAll(async () => {
    await testQueue.close();
    redis.disconnect();
  });

  it("should connect to Redis and add a job to BullMQ queue", async () => {
    const jobData = {
      testId: "test_job_123",
      payload: "connectivity_check",
    };

    const job = await testQueue.add("ping-job", jobData);

    expect(job.id).toBeDefined();
    expect(job.name).toBe("ping-job");
    expect(job.data.testId).toBe("test_job_123");

    // Retrieve job from queue
    const fetchedJob = await testQueue.getJob(job.id!);
    expect(fetchedJob).toBeDefined();
    expect(fetchedJob?.data.payload).toBe("connectivity_check");

    // Clean up
    await job.remove().catch(() => {});
  });
});
