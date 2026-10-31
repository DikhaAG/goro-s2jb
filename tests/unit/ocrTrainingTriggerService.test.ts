import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkAndTriggerThresholdTraining,
  checkAndTriggerNightlyCron,
  getTriggerStatus,
  enqueueManualTraining,
  MIN_SAMPLES_THRESHOLD,
} from "@/server/services/ocrTrainingTriggerService";

describe("Subtask 19.3: OCR Training Trigger Service Unit Test Suite", () => {
  let mockPrisma: any;
  let mockRedis: any;
  let mockQueue: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      ocrTrainingSample: {
        count: vi.fn().mockResolvedValue(150),
      },
      ocrModelRegistry: {
        findFirst: vi.fn().mockResolvedValue({
          id: "m-1",
          version: "v1.0.0",
          trainingSamplesCount: 20, // 150 - 20 = 130 new samples (> 100 threshold)
          createdAt: new Date(Date.now() - 10 * 3600 * 1000), // 10 hours ago
        }),
      },
      ocrTrainingJob: {
        create: vi.fn().mockResolvedValue({ id: "job-created-123" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };

    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
    };

    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: "bull-job-1" }),
    };
  });

  describe("1. getTriggerStatus", () => {
    it("should compute new samples and cooldown status accurately", async () => {
      const status = await getTriggerStatus(mockPrisma, mockRedis);

      expect(status.totalApprovedSamples).toBe(150);
      expect(status.lastModelSamplesCount).toBe(20);
      expect(status.newSamplesCount).toBe(130);
      expect(status.canAutoTrain).toBe(true);
      expect(status.isCooldownActive).toBe(false);
    });

    it("should report cooldown as active if last run was within 6 hours", async () => {
      // 2 hours ago
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key === "ocr:training:last_run_timestamp") {
          return (Date.now() - 2 * 3600 * 1000).toString();
        }
        return null;
      });

      const status = await getTriggerStatus(mockPrisma, mockRedis);
      expect(status.isCooldownActive).toBe(true);
      expect(status.canAutoTrain).toBe(false);
      expect(status.cooldownRemainingSeconds).toBeGreaterThan(0);
    });
  });

  describe("2. checkAndTriggerThresholdTraining", () => {
    it("should trigger auto training when new samples exceed threshold and cooldown is clear", async () => {
      const res = await checkAndTriggerThresholdTraining(
        undefined,
        mockPrisma,
        mockRedis,
        mockQueue
      );

      expect(res.triggered).toBe(true);
      expect(res.reason).toBe("THRESHOLD_MET");
      expect(mockPrisma.ocrTrainingJob.create).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "run-training",
        expect.objectContaining({
          triggerType: "THRESHOLD",
        })
      );
    });

    it("should NOT trigger if new samples are below threshold", async () => {
      // Only 10 approved samples vs 0 trained = 10 (< 100)
      mockPrisma.ocrTrainingSample.count.mockResolvedValueOnce(10);
      mockPrisma.ocrModelRegistry.findFirst.mockResolvedValueOnce(null);

      const res = await checkAndTriggerThresholdTraining(
        undefined,
        mockPrisma,
        mockRedis,
        mockQueue
      );

      expect(res.triggered).toBe(false);
      expect(res.reason).toBe("BELOW_THRESHOLD");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should NOT trigger if cooldown is active", async () => {
      // 1 hour ago
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key === "ocr:training:last_run_timestamp") {
          return (Date.now() - 1 * 3600 * 1000).toString();
        }
        return null;
      });

      const res = await checkAndTriggerThresholdTraining(
        undefined,
        mockPrisma,
        mockRedis,
        mockQueue
      );

      expect(res.triggered).toBe(false);
      expect(res.reason).toBe("COOLDOWN_ACTIVE");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("3. enqueueManualTraining", () => {
    it("should enqueue a manual training job and bypass cooldown", async () => {
      const res = await enqueueManualTraining(
        { epochs: 5, batchSize: 8 },
        "usr-operator-1",
        mockPrisma,
        mockRedis,
        mockQueue
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.ocrTrainingJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          triggerType: "MANUAL",
          totalEpochs: 5,
        }),
      });
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it("should reject manual training if another training is already active", async () => {
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key === "ocr:training:active") {
          return JSON.stringify({ jobId: "active-1" });
        }
        return null;
      });

      await expect(
        enqueueManualTraining({}, "usr-1", mockPrisma, mockRedis, mockQueue)
      ).rejects.toThrow("Sedang ada proses training");
    });
  });
});

