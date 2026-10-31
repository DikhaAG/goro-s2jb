import { describe, it, expect, vi, beforeEach } from "vitest";
import { ocrTrainingRouter } from "@/server/routers/ocrTraining";
import { Role, OcrSampleSource, OcrSampleInclusion } from "@prisma/client";

vi.mock("@/server/services/ocrTrainerService", () => ({
  runOcrTrainingPipeline: vi.fn().mockResolvedValue({
    success: true,
    jobId: "job-123",
    modelRegistryId: "model-123",
    metrics: { cer: 3.2, wer: 6.5, accuracy: 94.0 },
    durationSeconds: 15.0,
  }),
}));

vi.mock("@/server/services/ocrTrainingTriggerService", () => ({
  REDIS_TRAINING_ACTIVE_KEY: "ocr:training:active",
  getTriggerStatus: vi.fn().mockResolvedValue({
    isTrainingActive: false,
    activeJobData: null,
    totalApprovedSamples: 145,
    lastModelSamplesCount: 100,
    newSamplesCount: 45,
    threshold: 100,
    canAutoTrain: false,
    isCooldownActive: false,
    cooldownRemainingSeconds: 0,
    lastTrainedAt: new Date("2026-10-31T12:00:00.000Z"),
  }),
  enqueueManualTraining: vi.fn().mockResolvedValue({
    success: true,
    jobId: "job-queued-1",
    targetVersion: "v1.2345.0",
    datasetSize: 145,
  }),
  cancelTrainingJob: vi.fn().mockResolvedValue({
    id: "job-1",
    status: "FAILED",
    logs: ["Cancelled by user"],
  }),
}));

describe("Subtask 19.1, 19.2 & 19.3: OCR Training Router Unit Test Suite", () => {
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    mockPrisma = {
      ocrTrainingSample: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        update: vi.fn(),
      },
      ocrTrainingJob: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            status: "COMPLETED",
            modelTargetVersion: "v1.1.0",
          },
        ]),
      },
      ratingReview: {
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
  });

  const createCaller = (role: Role = Role.PEGAWAI) => {
    return ocrTrainingRouter.createCaller({
      prisma: mockPrisma,
      redis: mockRedis,
      user: {
        id: "usr-operator-1",
        name: "Operator Budi",
        username: "budi",
        role,
        up3Id: "up3-1",
        ulpId: "ulp-1",
      },
      req: {} as any,
    });
  };

  describe("1. getDatasetStats Procedure", () => {
    it("should return aggregated counts for training samples", async () => {
      mockPrisma.ocrTrainingSample.count
        .mockResolvedValueOnce(200) // total
        .mockResolvedValueOnce(180) // approved
        .mockResolvedValueOnce(15)  // pending
        .mockResolvedValueOnce(5);  // excluded

      mockPrisma.ocrTrainingSample.groupBy.mockResolvedValueOnce([
        { source: OcrSampleSource.IMPORT_SPREADSHEET, _count: { id: 120 } },
        { source: OcrSampleSource.TRIAGE_VALIDATION, _count: { id: 80 } },
      ]);

      const caller = createCaller();
      const stats = await caller.getDatasetStats();

      expect(stats.totalSamples).toBe(200);
      expect(stats.approvedCount).toBe(180);
      expect(stats.bySource[OcrSampleSource.IMPORT_SPREADSHEET]).toBe(120);
    });
  });

  describe("2. getSamples Procedure", () => {
    it("should return paginated list of samples with total count", async () => {
      mockPrisma.ocrTrainingSample.findMany.mockResolvedValueOnce([
        {
          id: "s-1",
          groundTruthText: "Ahmad Rizky",
          reviewerName: "Ahmad Rizky",
          inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
          source: OcrSampleSource.TRIAGE_VALIDATION,
        },
      ]);
      mockPrisma.ocrTrainingSample.count.mockResolvedValueOnce(1);

      const caller = createCaller();
      const res = await caller.getSamples({
        page: 1,
        pageSize: 10,
        inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
      });

      expect(res.items).toHaveLength(1);
      expect(res.totalCount).toBe(1);
      expect(res.totalPages).toBe(1);
    });
  });

  describe("3. updateSampleInclusion Procedure", () => {
    it("should update inclusion status and record audit log", async () => {
      mockPrisma.ocrTrainingSample.update.mockResolvedValueOnce({
        id: "s-1",
        inclusion: OcrSampleInclusion.EXCLUDED,
        exclusionReason: "Tangkapan layar buram",
      });

      const caller = createCaller();
      const res = await caller.updateSampleInclusion({
        sampleId: "s-1",
        inclusion: OcrSampleInclusion.EXCLUDED,
        exclusionReason: "Tangkapan layar buram",
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.ocrTrainingSample.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "UPDATE_OCR_SAMPLE_INCLUSION",
            entityId: "s-1",
          }),
        })
      );
    });
  });

  describe("4. triggerColdStartHarvest Procedure", () => {
    it("should harvest approved reviews from spreadsheet and log audit trail", async () => {
      mockPrisma.ratingReview.findMany.mockResolvedValueOnce([
        {
          id: "rev-1",
          evidenceImagePath: "uploads/1.jpg",
          evidenceImageHash: "hash1",
          playstoreReviewerName: "Budi",
          extractedOcrText: "Budi",
          confidenceScore: 90,
          verifiedById: "user-1",
        },
      ]);
      mockPrisma.ocrTrainingSample.findFirst.mockResolvedValue(null);
      mockPrisma.ocrTrainingSample.create.mockResolvedValue({ id: "s-new" });

      const caller = createCaller(Role.SUPER_ADMIN);
      const res = await caller.triggerColdStartHarvest({ batchSize: 100 });

      expect(res.success).toBe(true);
      expect(res.totalImported).toBe(1);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "COLD_START_HARVEST_OCR_DATASET",
          }),
        })
      );
    });
  });

  describe("5. triggerTraining Procedure", () => {
    it("should execute training pipeline and log audit trail", async () => {
      const caller = createCaller(Role.SUPER_ADMIN);
      const res = await caller.triggerTraining({
        epochs: 5,
        batchSize: 8,
      });

      expect(res.success).toBe(true);
      expect(res.jobId).toBe("job-123");
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "TRIGGER_MANUAL_OCR_TRAINING",
            entityId: "job-123",
          }),
        })
      );
    });
  });

  describe("6. getJobs Procedure", () => {
    it("should return list of training jobs", async () => {
      const caller = createCaller();
      const jobs = await caller.getJobs({ limit: 5 });

      expect(jobs).toHaveLength(1);
      expect(jobs[0].modelTargetVersion).toBe("v1.1.0");
    });
  });

  describe("7. RBAC Protection", () => {
    it("should reject PETUGAS_LAPANGAN from accessing dataset procedures", async () => {
      const caller = ocrTrainingRouter.createCaller({
        prisma: mockPrisma,
        redis: mockRedis,
        user: {
          id: "field-1",
          name: "Petugas",
          username: "field1",
          role: Role.PETUGAS_LAPANGAN,
        },
        req: {} as any,
      });

      await expect(caller.getDatasetStats()).rejects.toThrow();
    });
  });

  describe("8. getTriggerStatus Procedure (Subtask 19.3)", () => {
    it("should return trigger status from trigger service", async () => {
      const caller = createCaller();
      const status = await caller.getTriggerStatus();

      expect(status.threshold).toBe(100);
      expect(status.newSamplesCount).toBe(45);
      expect(status.canAutoTrain).toBe(false);
    });
  });

  describe("9. enqueueManualTraining Procedure (Subtask 19.3)", () => {
    it("should enqueue manual training job and record audit log", async () => {
      const caller = createCaller(Role.SUPER_ADMIN);
      const res = await caller.enqueueManualTraining({
        epochs: 10,
        batchSize: 16,
      });

      expect(res.jobId).toBe("job-queued-1");
      expect(res.success).toBe(true);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "ENQUEUE_MANUAL_OCR_TRAINING",
            entityId: "job-queued-1",
          }),
        })
      );
    });
  });

  describe("10. getActiveJobStatus Procedure (Subtask 19.3)", () => {
    it("should return parsed active job from redis if present", async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          jobId: "job-active-1",
          progressPercent: 60,
          currentEpoch: 3,
          totalEpochs: 5,
        })
      );

      const caller = createCaller();
      const active = await caller.getActiveJobStatus();

      expect(active).not.toBeNull();
      expect(active.jobId).toBe("job-active-1");
      expect(active.progressPercent).toBe(60);
    });

    it("should return null if no active job in redis", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const caller = createCaller();
      const active = await caller.getActiveJobStatus();

      expect(active).toBeNull();
    });
  });

  describe("11. cancelJob Procedure (Subtask 19.3)", () => {
    it("should cancel job via trigger service and create audit log", async () => {
      const caller = createCaller(Role.SUPER_ADMIN);
      const res = await caller.cancelJob({
        jobId: "job-1",
        reason: "Salah konfigurasi parameter",
      });

      expect(res.success).toBe(true);
      expect(res.job.status).toBe("FAILED");
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "CANCEL_OCR_TRAINING_JOB",
            entityId: "job-1",
          }),
        })
      );
    });
  });
});
