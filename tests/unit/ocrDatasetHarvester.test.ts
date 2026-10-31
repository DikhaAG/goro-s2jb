import { describe, it, expect, vi, beforeEach } from "vitest";
import { OcrSampleSource, OcrSampleInclusion, ValidationStatus } from "@prisma/client";
import {
  harvestFromApprovedReview,
  coldStartHarvestFromHistoricalSpreadsheet,
  updateSampleInclusion,
  getTrainingDatasetStats,
} from "@/server/services/ocrDatasetHarvester";

describe("Subtask 19.1: OCR Dataset Harvester Unit Test Suite", () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      ratingReview: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      ocrTrainingSample: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
    };
  });

  describe("1. harvestFromApprovedReview", () => {
    it("should return null if review is not found", async () => {
      mockPrisma.ratingReview.findUnique.mockResolvedValueOnce(null);

      const res = await harvestFromApprovedReview("non-existent-id", {}, mockPrisma);
      expect(res).toBeNull();
      expect(mockPrisma.ocrTrainingSample.create).not.toHaveBeenCalled();
    });

    it("should return null if review validationStatus is not APPROVED", async () => {
      mockPrisma.ratingReview.findUnique.mockResolvedValueOnce({
        id: "rev-1",
        validationStatus: ValidationStatus.PENDING,
        evidenceImagePath: "uploads/test.jpg",
        playstoreReviewerName: "Ahmad",
      });

      const res = await harvestFromApprovedReview("rev-1", {}, mockPrisma);
      expect(res).toBeNull();
      expect(mockPrisma.ocrTrainingSample.create).not.toHaveBeenCalled();
    });

    it("should return null if review has no evidenceImagePath", async () => {
      mockPrisma.ratingReview.findUnique.mockResolvedValueOnce({
        id: "rev-1",
        validationStatus: ValidationStatus.APPROVED,
        evidenceImagePath: "",
        playstoreReviewerName: "Ahmad",
      });

      const res = await harvestFromApprovedReview("rev-1", {}, mockPrisma);
      expect(res).toBeNull();
      expect(mockPrisma.ocrTrainingSample.create).not.toHaveBeenCalled();
    });

    it("should harvest and create OcrTrainingSample when review is approved", async () => {
      mockPrisma.ratingReview.findUnique.mockResolvedValueOnce({
        id: "rev-approved",
        validationStatus: ValidationStatus.APPROVED,
        evidenceImagePath: "uploads/eviden1.jpg",
        evidenceImageHash: "a1b2c3d4e5f60718",
        playstoreReviewerName: "Ahmad Rizky",
        extractedOcrText: "Ahmad Rizky ulasan sangat memuaskan bintang lima",
        confidenceScore: 95.0,
      });

      mockPrisma.ocrTrainingSample.findFirst.mockResolvedValueOnce(null);
      mockPrisma.ocrTrainingSample.create.mockResolvedValueOnce({
        id: "sample-1",
        reviewId: "rev-approved",
        imagePath: "uploads/eviden1.jpg",
        imageHash: "a1b2c3d4e5f60718",
        groundTruthText: "Ahmad Rizky",
        reviewerName: "Ahmad Rizky",
        source: OcrSampleSource.TRIAGE_VALIDATION,
        inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
      });

      const res = await harvestFromApprovedReview(
        "rev-approved",
        {
          source: OcrSampleSource.TRIAGE_VALIDATION,
          actorId: "user-operator-1",
        },
        mockPrisma
      );

      expect(res).toBeDefined();
      expect(res?.id).toBe("sample-1");
      expect(mockPrisma.ocrTrainingSample.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reviewId: "rev-approved",
          imagePath: "uploads/eviden1.jpg",
          imageHash: "a1b2c3d4e5f60718",
          reviewerName: "Ahmad Rizky",
          source: OcrSampleSource.TRIAGE_VALIDATION,
          inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
          verifiedById: "user-operator-1",
        }),
      });
    });

    it("should avoid duplicate creation if sample already exists for review", async () => {
      mockPrisma.ratingReview.findUnique.mockResolvedValueOnce({
        id: "rev-approved",
        validationStatus: ValidationStatus.APPROVED,
        evidenceImagePath: "uploads/eviden1.jpg",
        playstoreReviewerName: "Ahmad Rizky",
      });

      mockPrisma.ocrTrainingSample.findFirst.mockResolvedValueOnce({
        id: "existing-sample",
        reviewId: "rev-approved",
      });

      const res = await harvestFromApprovedReview("rev-approved", {}, mockPrisma);
      expect(res?.id).toBe("existing-sample");
      expect(mockPrisma.ocrTrainingSample.create).not.toHaveBeenCalled();
    });
  });

  describe("2. coldStartHarvestFromHistoricalSpreadsheet", () => {
    it("should query approved reviews without training samples and harvest in batch", async () => {
      mockPrisma.ratingReview.findMany.mockResolvedValueOnce([
        {
          id: "hist-1",
          evidenceImagePath: "uploads/hist1.jpg",
          evidenceImageHash: "1111222233334444",
          playstoreReviewerName: "Budi Santoso",
          extractedOcrText: "Budi Santoso mantap",
          confidenceScore: 92.0,
          trainingSamples: [],
        },
        {
          id: "hist-2",
          evidenceImagePath: "uploads/hist2.jpg",
          evidenceImageHash: "5555666677778888",
          playstoreReviewerName: "Siti Rahma",
          extractedOcrText: "Siti Rahma cepat respon",
          confidenceScore: 94.0,
          trainingSamples: [],
        },
      ]);

      mockPrisma.ocrTrainingSample.findFirst.mockResolvedValue(null);
      mockPrisma.ocrTrainingSample.create.mockResolvedValue({ id: "sample-created" });

      const stats = await coldStartHarvestFromHistoricalSpreadsheet(
        { batchSize: 50, actorId: "admin-1" },
        mockPrisma
      );

      expect(stats.totalFound).toBe(2);
      expect(stats.totalImported).toBe(2);
      expect(stats.skippedExisting).toBe(0);
      expect(mockPrisma.ocrTrainingSample.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("3. updateSampleInclusion", () => {
    it("should update inclusion status and exclusion reason", async () => {
      mockPrisma.ocrTrainingSample.update.mockResolvedValueOnce({
        id: "sample-1",
        inclusion: OcrSampleInclusion.EXCLUDED,
        exclusionReason: "Tangkapan layar resolusi terlalu rendah",
      });

      const res = await updateSampleInclusion(
        "sample-1",
        OcrSampleInclusion.EXCLUDED,
        "Tangkapan layar resolusi terlalu rendah",
        "operator-1",
        mockPrisma
      );

      expect(res.inclusion).toBe(OcrSampleInclusion.EXCLUDED);
      expect(mockPrisma.ocrTrainingSample.update).toHaveBeenCalledWith({
        where: { id: "sample-1" },
        data: {
          inclusion: OcrSampleInclusion.EXCLUDED,
          exclusionReason: "Tangkapan layar resolusi terlalu rendah",
        },
      });
    });
  });

  describe("4. getTrainingDatasetStats", () => {
    it("should aggregate dataset counts by inclusion and source", async () => {
      mockPrisma.ocrTrainingSample.count
        .mockResolvedValueOnce(150) // total
        .mockResolvedValueOnce(120) // approved
        .mockResolvedValueOnce(20)  // pending
        .mockResolvedValueOnce(10); // excluded

      mockPrisma.ocrTrainingSample.groupBy.mockResolvedValueOnce([
        { source: OcrSampleSource.IMPORT_SPREADSHEET, _count: { id: 100 } },
        { source: OcrSampleSource.TRIAGE_VALIDATION, _count: { id: 50 } },
      ]);

      const stats = await getTrainingDatasetStats(mockPrisma);

      expect(stats.totalSamples).toBe(150);
      expect(stats.approvedCount).toBe(120);
      expect(stats.pendingCount).toBe(20);
      expect(stats.excludedCount).toBe(10);
      expect(stats.bySource[OcrSampleSource.IMPORT_SPREADSHEET]).toBe(100);
      expect(stats.bySource[OcrSampleSource.TRIAGE_VALIDATION]).toBe(50);
    });
  });
});

