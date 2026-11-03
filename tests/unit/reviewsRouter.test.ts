import { describe, it, expect, vi, beforeEach } from "vitest";
import { reviewsRouter } from "@/server/routers/reviews";
import { Role, ValidationStatus, OcrProcessingStatus } from "@prisma/client";
import { ocrQueue } from "@/server/queues/ocrQueue";

vi.mock("@/server/queues/ocrQueue", () => ({
  ocrQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-mock-123" }),
    addBulk: vi.fn().mockResolvedValue([{ id: "job-bulk-1" }]),
  },
}));

describe("Task 18: Reviews Router Unit Test Suite", () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      ratingReview: {
        count: vi.fn().mockResolvedValue(100),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "rev-1",
            playstoreReviewerName: "Ahmad Rizky",
            originalReviewerName: "Ahmad",
            validationStatus: ValidationStatus.APPROVED,
            ocrStatus: OcrProcessingStatus.COMPLETED,
            confidenceScore: 95.0,
            entryDate: new Date("2026-10-28"),
            up3: { id: "up3-1", code: "PLG", name: "Palembang" },
            ulp: { id: "ulp-1", code: "RIV", name: "Rivai" },
            appVersion: { id: "v1", version: "6.0.0" },
            verifiedBy: { id: "u-1", name: "Operator Budi", role: Role.PEGAWAI },
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: "rev-1",
          playstoreReviewerName: "Ahmad Rizky",
          originalReviewerName: "Ahmad",
          validationStatus: ValidationStatus.PENDING,
          ocrStatus: OcrProcessingStatus.FAILED,
          confidenceScore: 45.0,
          evidenceImagePath: "https://drive.google.com/test.jpg",
          entryDate: new Date("2026-10-28"),
          up3Id: "up3-1",
          ulpId: "ulp-1",
        }),
        update: vi.fn().mockResolvedValue({
          id: "rev-1",
          playstoreReviewerName: "Ahmad Rizky Edited",
          validationStatus: ValidationStatus.APPROVED,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 5 }),
        delete: vi.fn().mockResolvedValue({ id: "rev-1" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      uLP: {
        findFirst: vi.fn().mockResolvedValue({ id: "ulp-1", up3Id: "up3-1" }),
        findMany: vi.fn().mockResolvedValue([{ id: "ulp-1", name: "Rivai", up3Id: "up3-1" }]),
      },
      uP3: {
        findMany: vi.fn().mockResolvedValue([{ id: "up3-1", name: "Palembang" }]),
      },
      appVersion: {
        findMany: vi.fn().mockResolvedValue([{ id: "v1", version: "6.0.0" }]),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "log-1" }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
    };
  });

  const createCaller = (role: Role = Role.PEGAWAI) => {
    return reviewsRouter.createCaller({
      prisma: mockPrisma,
      redis: {} as any,
      user: {
        id: "usr-operator-1",
        name: "Operator Budi",
        username: "budi_triase",
        role,
        up3Id: "up3-1",
        ulpId: null,
      },
      req: {} as any,
    });
  };

  describe("1. getList Procedure", () => {
    it("should return paginated list and calculated KPI metrics", async () => {
      const caller = createCaller();
      const res = await caller.getList({
        page: 1,
        pageSize: 25,
        search: "Ahmad",
        validationStatus: "ALL",
      });

      expect(res.items).toHaveLength(1);
      expect(res.totalCount).toBe(100);
      expect(res.totalPages).toBe(4);
      expect(res.kpi).toBeDefined();
      expect(mockPrisma.ratingReview.findMany).toHaveBeenCalled();
      expect(mockPrisma.ratingReview.count).toHaveBeenCalled();
    });

    it("should correctly apply validation zone filters", async () => {
      const caller = createCaller();
      await caller.getList({ validationZone: "GREEN" });
      expect(mockPrisma.ratingReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            confidenceScore: { gte: 90.0 },
          }),
        })
      );
    });
  });

  describe("2. getDetail Procedure", () => {
    it("should return full review with relations and audit trail", async () => {
      const caller = createCaller();
      const res = await caller.getDetail({ id: "rev-1" });

      expect(res.review).toBeDefined();
      expect(res.review.id).toBe("rev-1");
      expect(res.auditLogs).toBeDefined();
      expect(mockPrisma.ratingReview.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "rev-1" } })
      );
    });

    it("should throw NOT_FOUND when review does not exist", async () => {
      mockPrisma.ratingReview.findUnique.mockResolvedValueOnce(null);
      const caller = createCaller();
      await expect(caller.getDetail({ id: "non-existent" })).rejects.toThrow("tidak ditemukan");
    });
  });

  describe("3. update Procedure (Curative Edit)", () => {
    it("should update review and record audit log", async () => {
      const caller = createCaller();
      const res = await caller.update({
        id: "rev-1",
        playstoreReviewerName: "Ahmad Rizky Edited",
        validationStatus: ValidationStatus.APPROVED,
      });

      expect(res.id).toBe("rev-1");
      expect(mockPrisma.ratingReview.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "UPDATE_REVIEW_CURATIVE",
            entityType: "RatingReview",
            entityId: "rev-1",
          }),
        })
      );
    });

    it("should reject invalid ULP if it does not belong to UP3", async () => {
      mockPrisma.uLP.findFirst.mockResolvedValueOnce(null);
      const caller = createCaller();
      await expect(
        caller.update({
          id: "rev-1",
          up3Id: "up3-1",
          ulpId: "ulp-foreign",
        })
      ).rejects.toThrow("ULP yang dipilih tidak berada di bawah UP3");
    });
  });

  describe("4. bulkUpdate Procedure", () => {
    it("should perform bulk update across multiple review IDs and record audit log", async () => {
      const caller = createCaller();
      const res = await caller.bulkUpdate({
        ids: ["rev-1", "rev-2", "rev-3"],
        validationStatus: ValidationStatus.APPROVED,
        isDuplicate: false,
      });

      expect(res.success).toBe(true);
      expect(res.count).toBe(5);
      expect(mockPrisma.ratingReview.updateMany).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "BULK_UPDATE_REVIEWS",
            metadata: expect.objectContaining({
              targetCount: 3,
            }),
          }),
        })
      );
    });
  });

  describe("5. retryOcr and bulkRetryOcr Procedures", () => {
    it("should enqueue single review to BullMQ ocrQueue and update ocrStatus to QUEUED", async () => {
      const caller = createCaller();
      const res = await caller.retryOcr({ reviewId: "rev-1" });

      expect(res.success).toBe(true);
      expect(res.jobId).toBe("job-mock-123");
      expect(mockPrisma.ratingReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rev-1" },
          data: { ocrStatus: OcrProcessingStatus.QUEUED },
        })
      );
      expect(ocrQueue.add).toHaveBeenCalled();
    });

    it("should bulk enqueue multiple reviews to BullMQ ocrQueue", async () => {
      mockPrisma.ratingReview.findMany.mockResolvedValueOnce([
        { id: "rev-1", evidenceImagePath: "http://img1.jpg", playstoreReviewerName: "A" },
        { id: "rev-2", evidenceImagePath: "http://img2.jpg", playstoreReviewerName: "B" },
      ]);
      const caller = createCaller();
      const res = await caller.bulkRetryOcr({ reviewIds: ["rev-1", "rev-2"] });

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
      expect(mockPrisma.ratingReview.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ["rev-1", "rev-2"] } },
          data: { ocrStatus: OcrProcessingStatus.QUEUED },
        })
      );
      expect(ocrQueue.addBulk).toHaveBeenCalled();
    });
  });

  describe("6. delete Procedure (Curative)", () => {
    it("should permit soft reject for role PEGAWAI", async () => {
      const caller = createCaller(Role.PEGAWAI);
      const res = await caller.delete({
        id: "rev-1",
        mode: "SOFT_REJECT",
        reason: "Data tidak valid / salah ketik",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("SOFT_REJECT");
      expect(mockPrisma.ratingReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validationStatus: ValidationStatus.REJECTED,
          }),
        })
      );
    });

    it("should reject permanent delete if caller is role PEGAWAI", async () => {
      const caller = createCaller(Role.PEGAWAI);
      await expect(
        caller.delete({
          id: "rev-1",
          mode: "PERMANENT",
          reason: "Hapus permanen",
        })
      ).rejects.toThrow("Hanya Super Admin yang berhak");
    });

    it("should permit permanent delete if caller is SUPER_ADMIN", async () => {
      const caller = createCaller(Role.SUPER_ADMIN);
      const res = await caller.delete({
        id: "rev-1",
        mode: "PERMANENT",
        reason: "Pembersihan data sampah pengujian",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("PERMANENT");
      expect(mockPrisma.ratingReview.delete).toHaveBeenCalledWith({
        where: { id: "rev-1" },
      });
    });
  });

  describe("7. bulkDelete Procedure", () => {
    it("should permit bulk soft reject for role PEGAWAI", async () => {
      const caller = createCaller(Role.PEGAWAI);
      const res = await caller.bulkDelete({
        ids: ["rev-1", "rev-2", "rev-3"],
        mode: "SOFT_REJECT",
        reason: "Tolak massal eviden duplikat",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("SOFT_REJECT");
      expect(res.count).toBe(5);
      expect(mockPrisma.ratingReview.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ["rev-1", "rev-2", "rev-3"] } },
          data: expect.objectContaining({
            validationStatus: ValidationStatus.REJECTED,
          }),
        })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "BULK_SOFT_REJECT_REVIEWS",
          }),
        })
      );
    });

    it("should reject bulk permanent delete if caller is role PEGAWAI", async () => {
      const caller = createCaller(Role.PEGAWAI);
      await expect(
        caller.bulkDelete({
          ids: ["rev-1", "rev-2"],
          mode: "PERMANENT",
          reason: "Hapus permanen tanpa izin",
        })
      ).rejects.toThrow("Hanya Super Admin");
    });

    it("should permit bulk permanent delete if caller is SUPER_ADMIN", async () => {
      const caller = createCaller(Role.SUPER_ADMIN);
      const res = await caller.bulkDelete({
        ids: ["rev-1", "rev-2"],
        mode: "PERMANENT",
        reason: "Pembersihan batch data uji coba",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("PERMANENT");
      expect(res.count).toBe(5);
      expect(mockPrisma.ratingReview.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["rev-1", "rev-2"] } },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "BULK_PERMANENT_DELETE_REVIEWS",
          }),
        })
      );
    });
  });

  describe("8. deleteAll Procedure", () => {
    it("should reject if confirmText is invalid", async () => {
      const caller = createCaller(Role.SUPER_ADMIN);
      await expect(
        caller.deleteAll({
          mode: "PERMANENT",
          reason: "Pembersihan total",
          confirmText: "HAPUS",
        })
      ).rejects.toThrow("Konfirmasi teks harus tepat 'HAPUS SEMUA'");
    });

    it("should permit permanent purge all if caller is role PEGAWAI", async () => {
      const caller = createCaller(Role.PEGAWAI);
      const res = await caller.deleteAll({
        mode: "PERMANENT",
        reason: "Reset total data ulasan oleh pegawai",
        confirmText: "HAPUS SEMUA",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("PERMANENT");
      expect(res.count).toBe(5);
      expect(mockPrisma.ratingReview.deleteMany).toHaveBeenCalledWith({});
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "PURGE_ALL_REVIEWS",
          }),
        })
      );
    });

    it("should permit permanent purge all if caller is SUPER_ADMIN", async () => {
      const caller = createCaller(Role.SUPER_ADMIN);
      const res = await caller.deleteAll({
        mode: "PERMANENT",
        reason: "Reset total data pengujian lingkungan sandbox",
        confirmText: "HAPUS SEMUA",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("PERMANENT");
      expect(res.count).toBe(5);
      expect(mockPrisma.ratingReview.deleteMany).toHaveBeenCalledWith({});
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "PURGE_ALL_REVIEWS",
          }),
        })
      );
    });

    it("should permit soft reject all for role PEGAWAI", async () => {
      const caller = createCaller(Role.PEGAWAI);
      const res = await caller.deleteAll({
        mode: "SOFT_REJECT",
        reason: "Arsip tolak seluruh data ulasan",
        confirmText: "HAPUS SEMUA",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("SOFT_REJECT");
      expect(res.count).toBe(5);
      expect(mockPrisma.ratingReview.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { validationStatus: { not: ValidationStatus.REJECTED } },
          data: expect.objectContaining({
            validationStatus: ValidationStatus.REJECTED,
          }),
        })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "BULK_REJECT_ALL_REVIEWS",
          }),
        })
      );
    });
  });

  describe("9. getFilterOptions Procedure", () => {
    it("should return up3s, ulps, and appVersions", async () => {
      const caller = createCaller();
      const res = await caller.getFilterOptions();

      expect(res.up3s).toHaveLength(1);
      expect(res.ulps).toHaveLength(1);
      expect(res.appVersions).toHaveLength(1);
    });
  });

  describe("8. RBAC Route Guard", () => {
    it("should reject PETUGAS_LAPANGAN from executing review procedures", async () => {
      const caller = reviewsRouter.createCaller({
        prisma: mockPrisma,
        redis: {} as any,
        user: {
          id: "field-1",
          name: "Petugas Lapangan",
          username: "petugas1",
          role: Role.PETUGAS_LAPANGAN,
          up3Id: "up3-1",
          ulpId: "ulp-1",
        },
        req: {} as any,
      });

      await expect(caller.getList({ page: 1, pageSize: 25 })).rejects.toThrow();
    });
  });
});
