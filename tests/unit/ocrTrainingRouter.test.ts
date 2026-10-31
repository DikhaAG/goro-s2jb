import { describe, it, expect, vi, beforeEach } from "vitest";
import { ocrTrainingRouter } from "@/server/routers/ocrTraining";
import { Role, OcrSampleSource, OcrSampleInclusion } from "@prisma/client";

describe("Subtask 19.1: OCR Training Router Unit Test Suite", () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      ocrTrainingSample: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        update: vi.fn(),
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
      redis: {} as any,
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

  describe("5. RBAC Protection", () => {
    it("should reject PETUGAS_LAPANGAN from accessing dataset procedures", async () => {
      const caller = ocrTrainingRouter.createCaller({
        prisma: mockPrisma,
        redis: {} as any,
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
});
