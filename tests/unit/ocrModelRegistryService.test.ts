import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getActiveModel,
  getActiveModelPath,
  listModels,
  getModelById,
  activateModel,
  rollbackModel,
  rejectModel,
  compareModels,
  REDIS_ACTIVE_MODEL_KEY,
  REDIS_ACTIVE_MODEL_PATH_KEY,
  REDIS_ACTIVE_MODEL_VERSION_KEY,
} from "@/server/services/ocrModelRegistryService";
import { OcrModelStatus } from "@prisma/client";

describe("Subtask 19.4: OCR Model Registry Service Unit Test Suite", () => {
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
      ocrModelRegistry: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };
  });

  describe("1. getActiveModel & getActiveModelPath", () => {
    it("should return cached model from Redis if available", async () => {
      const cached = {
        id: "model-active-1",
        version: "v1.1.0",
        artifactPath: "/weights/model_v1.1.0.pt",
        status: OcrModelStatus.ACTIVE,
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cached));

      const res = await getActiveModel(mockPrisma, mockRedis);

      expect(res).toEqual(cached);
      expect(mockPrisma.ocrModelRegistry.findFirst).not.toHaveBeenCalled();
    });

    it("should fall back to DB and prime Redis cache when not in Redis", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const dbModel = {
        id: "model-db-1",
        version: "v1.2.0",
        artifactPath: "/weights/model_v1.2.0.pt",
        status: OcrModelStatus.ACTIVE,
      };
      mockPrisma.ocrModelRegistry.findFirst.mockResolvedValueOnce(dbModel);

      const res = await getActiveModel(mockPrisma, mockRedis);

      expect(res).toEqual(dbModel);
      expect(mockPrisma.ocrModelRegistry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: OcrModelStatus.ACTIVE },
        })
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        REDIS_ACTIVE_MODEL_KEY,
        JSON.stringify(dbModel)
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        REDIS_ACTIVE_MODEL_PATH_KEY,
        dbModel.artifactPath
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        REDIS_ACTIVE_MODEL_VERSION_KEY,
        dbModel.version
      );
    });

    it("should return cached path directly from getActiveModelPath", async () => {
      mockRedis.get.mockResolvedValueOnce("/weights/active.pt");

      const path = await getActiveModelPath(mockPrisma, mockRedis);

      expect(path).toBe("/weights/active.pt");
      expect(mockPrisma.ocrModelRegistry.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("2. listModels & getModelById", () => {
    it("should return paginated list of models", async () => {
      mockPrisma.ocrModelRegistry.findMany.mockResolvedValueOnce([
        { id: "m-1", version: "v1.0.0", status: OcrModelStatus.ACTIVE },
        { id: "m-2", version: "v1.1.0", status: OcrModelStatus.STAGING },
      ]);
      mockPrisma.ocrModelRegistry.count.mockResolvedValueOnce(2);

      const res = await listModels({ page: 1, pageSize: 10 }, mockPrisma);

      expect(res.items).toHaveLength(2);
      expect(res.totalCount).toBe(2);
      expect(res.totalPages).toBe(1);
    });

    it("should throw error if model not found in getModelById", async () => {
      mockPrisma.ocrModelRegistry.findUnique.mockResolvedValueOnce(null);

      await expect(getModelById("non-existent", mockPrisma)).rejects.toThrow(
        'Model OCR dengan ID "non-existent" tidak ditemukan.'
      );
    });
  });

  describe("3. activateModel (Hot-Reload)", () => {
    it("should throw error if model does not exist", async () => {
      mockPrisma.ocrModelRegistry.findUnique.mockResolvedValueOnce(null);

      await expect(
        activateModel("invalid-id", "actor-1", mockPrisma, mockRedis)
      ).rejects.toThrow();
    });

    it("should return alreadyActive if model is already ACTIVE", async () => {
      mockPrisma.ocrModelRegistry.findUnique.mockResolvedValueOnce({
        id: "m-active",
        status: OcrModelStatus.ACTIVE,
      });

      const res = await activateModel("m-active", "actor-1", mockPrisma, mockRedis);

      expect(res.alreadyActive).toBe(true);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("should archive old active models and activate target model", async () => {
      const targetModel = {
        id: "m-staging",
        version: "v1.3.0",
        artifactPath: "/weights/v1.3.0.pt",
        status: OcrModelStatus.STAGING,
      };
      mockPrisma.ocrModelRegistry.findUnique.mockResolvedValueOnce(targetModel);

      const updatedModel = {
        ...targetModel,
        status: OcrModelStatus.ACTIVE,
        activatedById: "actor-1",
      };
      mockPrisma.ocrModelRegistry.update.mockResolvedValueOnce(updatedModel);

      const res = await activateModel("m-staging", "actor-1", mockPrisma, mockRedis);

      expect(res.success).toBe(true);
      expect(mockPrisma.ocrModelRegistry.updateMany).toHaveBeenCalledWith({
        where: { status: OcrModelStatus.ACTIVE },
        data: { status: OcrModelStatus.ARCHIVED },
      });
      expect(mockPrisma.ocrModelRegistry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "m-staging" },
          data: expect.objectContaining({
            status: OcrModelStatus.ACTIVE,
            activatedById: "actor-1",
          }),
        })
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        REDIS_ACTIVE_MODEL_PATH_KEY,
        updatedModel.artifactPath
      );
    });
  });

  describe("4. rollbackModel", () => {
    it("should throw error if target model is already active", async () => {
      mockPrisma.ocrModelRegistry.findUnique.mockResolvedValueOnce({
        id: "m-current",
        status: OcrModelStatus.ACTIVE,
      });

      await expect(
        rollbackModel(
          { targetModelId: "m-current", reason: "Testing rollback" },
          "actor-1",
          mockPrisma,
          mockRedis
        )
      ).rejects.toThrow("Model target saat ini sudah berstatus aktif.");
    });

    it("should archive current active model and activate target previous model", async () => {
      const targetPrevious = {
        id: "m-prev",
        version: "v1.0.0",
        artifactPath: "/weights/v1.0.0.pt",
        status: OcrModelStatus.ARCHIVED,
      };
      const currentActive = {
        id: "m-active-faulty",
        version: "v1.1.0",
        status: OcrModelStatus.ACTIVE,
        metadata: {},
      };

      mockPrisma.ocrModelRegistry.findUnique.mockResolvedValueOnce(targetPrevious);
      mockPrisma.ocrModelRegistry.findFirst.mockResolvedValueOnce(currentActive);

      const rolledBackTarget = {
        ...targetPrevious,
        status: OcrModelStatus.ACTIVE,
      };
      mockPrisma.ocrModelRegistry.update
        .mockResolvedValueOnce(currentActive) // update current active
        .mockResolvedValueOnce(rolledBackTarget); // update target

      const res = await rollbackModel(
        { targetModelId: "m-prev", reason: "Deteksi anomali false negative" },
        "actor-1",
        mockPrisma,
        mockRedis
      );

      expect(res.success).toBe(true);
      expect(res.previousModel?.id).toBe("m-active-faulty");
      expect(res.activeModel.id).toBe("m-prev");
      expect(mockRedis.set).toHaveBeenCalledWith(
        REDIS_ACTIVE_MODEL_VERSION_KEY,
        "v1.0.0"
      );
    });
  });

  describe("5. rejectModel", () => {
    it("should throw error if attempting to reject active model", async () => {
      mockPrisma.ocrModelRegistry.findUnique.mockResolvedValueOnce({
        id: "m-act",
        status: OcrModelStatus.ACTIVE,
      });

      await expect(
        rejectModel("m-act", "Low accuracy", "actor-1", mockPrisma)
      ).rejects.toThrow(
        "Tidak dapat menolak model yang sedang aktif di produksi. Lakukan rollback terlebih dahulu."
      );
    });

    it("should mark staging model as REJECTED with rejection metadata", async () => {
      mockPrisma.ocrModelRegistry.findUnique.mockResolvedValueOnce({
        id: "m-bad",
        status: OcrModelStatus.STAGING,
        metadata: {},
      });
      mockPrisma.ocrModelRegistry.update.mockResolvedValueOnce({
        id: "m-bad",
        status: OcrModelStatus.REJECTED,
      });

      const res = await rejectModel(
        "m-bad",
        "Akurasi CER terlalu tinggi (> 10%)",
        "actor-1",
        mockPrisma
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.ocrModelRegistry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "m-bad" },
          data: expect.objectContaining({
            status: OcrModelStatus.REJECTED,
          }),
        })
      );
    });
  });

  describe("6. compareModels", () => {
    it("should compute accurate metric deltas and determine winner", async () => {
      mockPrisma.ocrModelRegistry.findUnique
        .mockResolvedValueOnce({
          id: "m-a",
          version: "v1.0.0",
          cerScore: 5.0,
          werScore: 10.0,
          accuracyScore: 90.0,
          trainingSamplesCount: 100,
        })
        .mockResolvedValueOnce({
          id: "m-b",
          version: "v1.1.0",
          cerScore: 2.5, // lower is better (-2.5)
          werScore: 6.0,  // lower is better (-4.0)
          accuracyScore: 96.0, // higher is better (+6.0)
          trainingSamplesCount: 250,
        });

      const comparison = await compareModels("m-a", "m-b", mockPrisma);

      expect(comparison.delta.cer).toBe(-2.5);
      expect(comparison.delta.wer).toBe(-4.0);
      expect(comparison.delta.accuracy).toBe(6.0);
      expect(comparison.delta.samples).toBe(150);
      expect(comparison.isModelBImprovement).toBe(true);
      expect(comparison.verdict).toBe("MODEL_B_BETTER");
    });
  });
});

