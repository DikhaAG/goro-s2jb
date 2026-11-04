import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordJobCompleted,
  recordJobFailed,
  getQueueThroughputStats,
  getQueueThroughputStatsSync,
  detectStalledJobs,
  resetQueueTelemetry,
  pruneExpiredRecords,
} from "@/server/queues/queueTelemetry";
import { migrationRouter } from "@/server/routers/migration";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

describe("BullMQ Queue Telemetry & Stall Detector Suite (Task 20.2)", () => {
  const TEST_QUEUE_NAME = "test-ocr-queue";

  beforeEach(() => {
    vi.restoreAllMocks();
    resetQueueTelemetry();
  });

  describe("1. Real-Time Throughput Tracker & Sliding Window", () => {
    it("should accurately track completions and calculate jobs/minute in 60s window", async () => {
      // Simulate 5 completed jobs with varying durations
      recordJobCompleted(TEST_QUEUE_NAME, 200);
      recordJobCompleted(TEST_QUEUE_NAME, 300);
      recordJobCompleted(TEST_QUEUE_NAME, 250);
      recordJobCompleted(TEST_QUEUE_NAME, 150);
      recordJobCompleted(TEST_QUEUE_NAME, 100);

      const stats = await getQueueThroughputStats(TEST_QUEUE_NAME);

      expect(stats.queueName).toBe(TEST_QUEUE_NAME);
      expect(stats.throughputJobsPerMinute).toBe(5);
      expect(stats.totalCompletedInWindow).toBe(5);
      expect(stats.totalFailedInWindow).toBe(0);
      expect(stats.averageExecutionDurationMs).toBe(200); // (200+300+250+150+100)/5 = 200ms
      expect(stats.lastCompletedJobAt).toBeDefined();
    });

    it("should prune records older than 60 seconds from the throughput window", () => {
      const now = Date.now();

      // Simulate a job completed 70 seconds ago
      vi.spyOn(Date, "now").mockReturnValue(now - 70000);
      recordJobCompleted(TEST_QUEUE_NAME, 500);

      // Simulate 2 jobs completed now
      vi.spyOn(Date, "now").mockReturnValue(now);
      recordJobCompleted(TEST_QUEUE_NAME, 100);
      recordJobCompleted(TEST_QUEUE_NAME, 200);

      const stats = getQueueThroughputStatsSync(TEST_QUEUE_NAME);

      // The 70-second-old job should be pruned, leaving 2 jobs in the active 60s window
      expect(stats.totalCompletedInWindow).toBe(2);
      expect(stats.throughputJobsPerMinute).toBe(2);
      expect(stats.averageExecutionDurationMs).toBe(150); // (100+200)/2 = 150ms
    });

    it("should record failed job events and maintain separate failure counters", async () => {
      recordJobCompleted(TEST_QUEUE_NAME, 150);
      recordJobFailed(TEST_QUEUE_NAME, 50);
      recordJobFailed(TEST_QUEUE_NAME, 60);

      const stats = await getQueueThroughputStats(TEST_QUEUE_NAME);

      expect(stats.totalCompletedInWindow).toBe(1);
      expect(stats.totalFailedInWindow).toBe(2);
      expect(stats.lastFailedJobAt).toBeDefined();
    });
  });

  describe("2. Stall Job Detector Sensor (>180 Seconds)", () => {
    it("should detect active jobs exceeding maxActiveDurationMs threshold", async () => {
      const now = Date.now();
      const mockQueue: any = {
        getJobs: vi.fn().mockResolvedValue([
          {
            id: "job-normal-1",
            processedOn: now - 30000, // 30 seconds ago (Normal)
          },
          {
            id: "job-stalled-1",
            processedOn: now - 240000, // 4 minutes ago (Stalled > 180s)
          },
          {
            id: "job-stalled-2",
            processedOn: now - 300000, // 5 minutes ago (Stalled > 180s)
          },
          {
            id: "job-fresh-2",
            processedOn: now - 5000, // 5 seconds ago (Normal)
          },
        ]),
      };

      const stallResult = await detectStalledJobs(mockQueue, 180000);

      expect(stallResult.stalledCount).toBe(2);
      expect(stallResult.stalledJobIds).toContain("job-stalled-1");
      expect(stallResult.stalledJobIds).toContain("job-stalled-2");
      expect(stallResult.stalledJobIds).not.toContain("job-normal-1");
      expect(stallResult.stalledJobIds).not.toContain("job-fresh-2");
    });

    it("should return zero stalled jobs if all active jobs are within safe duration", async () => {
      const now = Date.now();
      const mockQueue: any = {
        getJobs: vi.fn().mockResolvedValue([
          { id: "job-1", processedOn: now - 10000 },
          { id: "job-2", processedOn: now - 60000 },
        ]),
      };

      const stallResult = await detectStalledJobs(mockQueue, 180000);

      expect(stallResult.stalledCount).toBe(0);
      expect(stallResult.stalledJobIds).toEqual([]);
    });
  });

  describe("3. tRPC migration.getDetailedWorkerStatus Integration & RBAC", () => {
    it("should expose full throughput & stall detection with job IDs to SUPER_ADMIN", async () => {
      vi.spyOn(prisma.ratingReview, "count").mockResolvedValue(50);

      // Record telemetry for OCR queue
      recordJobCompleted("ocr-processing-queue", 250);
      recordJobCompleted("ocr-processing-queue", 350);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "superadmin-1",
          name: "Super Admin",
          username: "superadmin",
          email: "superadmin@pln.co.id",
          role: Role.SUPER_ADMIN,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const status = await caller.getDetailedWorkerStatus();

      expect(status.isSuperAdmin).toBe(true);
      expect(status.queues.ocr.throughput).toBeDefined();
      expect(status.queues.ocr.throughput.jobsPerMinute).toBe(2);
      expect(status.queues.ocr.throughput.averageDurationMs).toBe(300);
      expect(status.queues.ocr.stallDetection).toBeDefined();
      expect(typeof status.queues.ocr.stallDetection.isStalled).toBe("boolean");
      expect(Array.isArray(status.queues.ocr.stallDetection.stalledJobIds)).toBe(true);

      expect(status.queues.import.throughput).toBeDefined();
      expect(status.queues.import.stallDetection).toBeDefined();
    });

    it("should sanitize stalledJobIds to empty array for PEGAWAI operator while retaining throughput stats", async () => {
      vi.spyOn(prisma.ratingReview, "count").mockResolvedValue(50);

      recordJobCompleted("import-processing-queue", 1000);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "pegawai-operator-1",
          name: "Budi Operator",
          username: "budiop",
          email: "budi@pln.co.id",
          role: Role.PEGAWAI,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const status = await caller.getDetailedWorkerStatus();

      expect(status.isSuperAdmin).toBe(false);
      // Operator receives throughput numbers for operational visibility
      expect(status.queues.import.throughput.jobsPerMinute).toBe(1);
      expect(status.queues.import.throughput.averageDurationMs).toBe(1000);
      // RBAC protection: Operator sees isStalled status but internal Redis job IDs are stripped
      expect(status.queues.import.stallDetection.stalledJobIds).toEqual([]);
      expect(status.queues.ocr.stallDetection.stalledJobIds).toEqual([]);
    });
  });
});

