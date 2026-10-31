import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { appRouter } from "@/server/routers/_app";
import { TRPCError } from "@trpc/server";
import { Role, ValidationStatus, OcrProcessingStatus } from "@prisma/client";

describe("Task 18: Reviews Management & Lifecycle Integration Test Suite", () => {
  let pegawaiUser: { id: string; username: string; name: string; role: Role };
  let adminUser: { id: string; username: string; name: string; role: Role };
  let fieldUser: { id: string; username: string; name: string; role: Role };

  let testUp3Id: string;
  let testUlpId: string;
  let targetUlpId: string;
  let testAppVersionId: string;

  const createdReviewIds: string[] = [];

  beforeAll(async () => {
    // 1. Fetch seed users and masters
    const pegawai = await prisma.user.findFirst({ where: { role: Role.PEGAWAI } });
    const admin = await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });
    const field = await prisma.user.findFirst({ where: { role: Role.PETUGAS_LAPANGAN } });

    pegawaiUser = pegawai!;
    adminUser = admin!;
    fieldUser = field!;

    const up3 = await prisma.uP3.findFirst({ include: { ulps: true } });
    testUp3Id = up3!.id;
    testUlpId = up3!.ulps[0].id;
    targetUlpId = up3!.ulps[1]?.id || up3!.ulps[0].id;

    const version = await prisma.appVersion.findFirst();
    testAppVersionId = version!.id;

    // 2. Create seed reviews for lifecycle testing
    const reviewA = await prisma.ratingReview.create({
      data: {
        up3Id: testUp3Id,
        ulpId: testUlpId,
        appVersionId: testAppVersionId,
        playstoreReviewerName: "Budi Triase Integration A",
        originalReviewerName: "budi.akun.form@gmail.com",
        evidenceImagePath: "uploads/test/sample_budi_a.png",
        validationStatus: ValidationStatus.PENDING,
        ocrStatus: OcrProcessingStatus.COMPLETED,
        confidenceScore: 92.5, // Green Zone
        extractedOcrText: "Ulasan lancar jaya PLN Mobile bintang lima",
        entryDate: new Date("2026-03-01T08:00:00Z"),
        timestamp: new Date("2026-03-01T08:00:00Z"),
      },
    });
    createdReviewIds.push(reviewA.id);

    const reviewB = await prisma.ratingReview.create({
      data: {
        up3Id: testUp3Id,
        ulpId: testUlpId,
        appVersionId: testAppVersionId,
        playstoreReviewerName: "Siti Triase Integration B",
        originalReviewerName: "siti.akun.form@gmail.com",
        evidenceImagePath: "uploads/test/sample_siti_b.png",
        validationStatus: ValidationStatus.PENDING,
        ocrStatus: OcrProcessingStatus.COMPLETED,
        confidenceScore: 75.0, // Yellow Zone
        extractedOcrText: "Aplikasi bagus respon cepat",
        entryDate: new Date("2026-03-02T09:00:00Z"),
        timestamp: new Date("2026-03-02T09:00:00Z"),
      },
    });
    createdReviewIds.push(reviewB.id);

    const reviewC = await prisma.ratingReview.create({
      data: {
        up3Id: testUp3Id,
        ulpId: testUlpId,
        appVersionId: testAppVersionId,
        playstoreReviewerName: "Eko Triase Integration C",
        originalReviewerName: "eko.akun.form@gmail.com",
        evidenceImagePath: "uploads/test/sample_eko_c.png",
        validationStatus: ValidationStatus.PENDING,
        ocrStatus: OcrProcessingStatus.FAILED,
        confidenceScore: 40.0, // Red Zone
        extractedOcrText: null,
        entryDate: new Date("2026-03-03T10:00:00Z"),
        timestamp: new Date("2026-03-03T10:00:00Z"),
      },
    });
    createdReviewIds.push(reviewC.id);
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.ratingReview.deleteMany({
      where: { id: { in: createdReviewIds } },
    }).catch(() => {});

    await prisma.$disconnect();
    redis.disconnect();
  });

  const getCaller = (user: any) =>
    appRouter.createCaller({
      prisma,
      redis,
      user,
      ipAddress: "127.0.0.1",
      userAgent: "Vitest-Integration-Agent",
    });

  describe("1. reviews.getList Procedure", () => {
    it("should retrieve paginated list and accurate KPI aggregations", async () => {
      const caller = getCaller(pegawaiUser);
      const res = await caller.reviews.getList({
        page: 1,
        pageSize: 10,
        search: "Triase Integration",
      });

      expect(res.items.length).toBeGreaterThanOrEqual(3);
      expect(res.totalCount).toBeGreaterThanOrEqual(3);
      expect(res.kpi).toBeDefined();
      expect(res.kpi.total).toBeGreaterThanOrEqual(3);
      expect(res.kpi.pending).toBeGreaterThanOrEqual(3);
    });

    it("should accurately filter reviews by validationZone GREEN (>= 90%)", async () => {
      const caller = getCaller(pegawaiUser);
      const res = await caller.reviews.getList({
        search: "Budi Triase Integration A",
        validationZone: "GREEN",
      });

      expect(res.items).toHaveLength(1);
      expect(res.items[0].playstoreReviewerName).toBe("Budi Triase Integration A");
      expect(res.items[0].confidenceScore).toBeGreaterThanOrEqual(90.0);
    });
  });

  describe("2. reviews.getDetail Procedure", () => {
    it("should retrieve full review record with relations and empty/populated audit trail", async () => {
      const caller = getCaller(pegawaiUser);
      const res = await caller.reviews.getDetail({
        id: createdReviewIds[0],
      });

      expect(res.review).toBeDefined();
      expect(res.review.id).toBe(createdReviewIds[0]);
      expect(res.review.up3).toBeDefined();
      expect(res.review.ulp).toBeDefined();
      expect(res.review.appVersion).toBeDefined();
      expect(Array.isArray(res.auditLogs)).toBe(true);
    });

    it("should throw NOT_FOUND for non-existent review ID", async () => {
      const caller = getCaller(pegawaiUser);
      await expect(
        caller.reviews.getDetail({ id: "non-existent-cuid-999" })
      ).rejects.toThrowError(TRPCError);
    });
  });

  describe("3. reviews.update Procedure (Curative Edit)", () => {
    it("should update metadata fields, persist changes, and record AuditLog", async () => {
      const caller = getCaller(pegawaiUser);
      const targetId = createdReviewIds[0];

      const updateRes = await caller.reviews.update({
        id: targetId,
        playstoreReviewerName: "Budi Triase Integration A (Updated)",
        fieldNotes: "Koreksi salah ketik nama ulasan",
        reviewerCategory: "Pegawai PLN",
      });

      expect(updateRes.id).toBe(targetId);
      expect(updateRes.playstoreReviewerName).toBe("Budi Triase Integration A (Updated)");
      expect(updateRes.reviewerCategory).toBe("Pegawai PLN");

      // Verify AuditLog entry was recorded
      const log = await prisma.auditLog.findFirst({
        where: {
          entityId: targetId,
          action: "UPDATE_REVIEW_CURATIVE",
        },
        orderBy: { createdAt: "desc" },
      });

      expect(log).toBeDefined();
      expect(log?.userId).toBe(pegawaiUser.id);
      expect(log?.metadata).toBeDefined();
    });
  });

  describe("4. reviews.bulkUpdate Procedure", () => {
    it("should bulk update validation status across targeted reviews and record single batch AuditLog", async () => {
      const caller = getCaller(pegawaiUser);
      const targets = [createdReviewIds[0], createdReviewIds[1]];

      const bulkRes = await caller.reviews.bulkUpdate({
        ids: targets,
        validationStatus: ValidationStatus.APPROVED,
        remarks: "Disetujui serentak saat pengujian integrasi",
      });

      expect(bulkRes.success).toBe(true);
      expect(bulkRes.count).toBe(2);

      // Verify database reflects the update
      const updatedRows = await prisma.ratingReview.findMany({
        where: { id: { in: targets } },
      });

      for (const row of updatedRows) {
        expect(row.validationStatus).toBe(ValidationStatus.APPROVED);
        expect(row.reviewRemarks).toContain("Disetujui serentak");
        expect(row.verifiedById).toBe(pegawaiUser.id);
      }
    });
  });

  describe("5. reviews.retryOcr Procedure", () => {
    it("should reset ocrStatus to QUEUED and enqueue BullMQ job", async () => {
      const caller = getCaller(pegawaiUser);
      const targetId = createdReviewIds[2]; // Previously FAILED

      const res = await caller.reviews.retryOcr({ reviewId: targetId });
      expect(res.success).toBe(true);
      expect(res.jobId).toBeDefined();

      const updated = await prisma.ratingReview.findUnique({
        where: { id: targetId },
      });
      expect(updated?.ocrStatus).toBe(OcrProcessingStatus.QUEUED);
    });
  });

  describe("6. reviews.delete Procedure (Curative Actions & RBAC)", () => {
    it("should permit Pegawai to execute SOFT_REJECT", async () => {
      const caller = getCaller(pegawaiUser);
      const targetId = createdReviewIds[1];

      const res = await caller.reviews.delete({
        id: targetId,
        mode: "SOFT_REJECT",
        reason: "Tangkapan layar terpotong tidak terbaca",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("SOFT_REJECT");

      const row = await prisma.ratingReview.findUnique({ where: { id: targetId } });
      expect(row?.validationStatus).toBe(ValidationStatus.REJECTED);
      expect(row?.reviewRemarks).toContain("Ditolak Kuratif");
    });

    it("should reject Pegawai attempting PERMANENT delete with FORBIDDEN error", async () => {
      const caller = getCaller(pegawaiUser);
      const targetId = createdReviewIds[2];

      await expect(
        caller.reviews.delete({
          id: targetId,
          mode: "PERMANENT",
          reason: "Hapus permanen tanpa hak akses",
        })
      ).rejects.toThrow("Hanya Super Admin yang berhak menghapus data ulasan secara permanen.");
    });

    it("should permit Super Admin to execute PERMANENT delete", async () => {
      const caller = getCaller(adminUser);
      const targetId = createdReviewIds[2];

      const res = await caller.reviews.delete({
        id: targetId,
        mode: "PERMANENT",
        reason: "Pembersihan data sampah uji coba oleh Super Admin",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("PERMANENT");

      const row = await prisma.ratingReview.findUnique({ where: { id: targetId } });
      expect(row).toBeNull(); // Row deleted permanently
    });
  });

  describe("7. reviews.bulkDelete and deleteAll Procedures", () => {
    let bulkTestReview1Id: string;
    let bulkTestReview2Id: string;

    beforeAll(async () => {
      const b1 = await prisma.ratingReview.create({
        data: {
          up3Id: testUp3Id,
          ulpId: testUlpId,
          appVersionId: testAppVersionId,
          playstoreReviewerName: "Bulk User 1",
          originalReviewerName: "bulk1@gmail.com",
          evidenceImagePath: "uploads/test/bulk1.png",
          validationStatus: ValidationStatus.PENDING,
          ocrStatus: OcrProcessingStatus.COMPLETED,
          confidenceScore: 90.0,
          entryDate: new Date("2026-03-05T08:00:00Z"),
          timestamp: new Date("2026-03-05T08:00:00Z"),
        },
      });
      const b2 = await prisma.ratingReview.create({
        data: {
          up3Id: testUp3Id,
          ulpId: testUlpId,
          appVersionId: testAppVersionId,
          playstoreReviewerName: "Bulk User 2",
          originalReviewerName: "bulk2@gmail.com",
          evidenceImagePath: "uploads/test/bulk2.png",
          validationStatus: ValidationStatus.PENDING,
          ocrStatus: OcrProcessingStatus.COMPLETED,
          confidenceScore: 85.0,
          entryDate: new Date("2026-03-05T09:00:00Z"),
          timestamp: new Date("2026-03-05T09:00:00Z"),
        },
      });
      bulkTestReview1Id = b1.id;
      bulkTestReview2Id = b2.id;
      createdReviewIds.push(b1.id, b2.id);
    });

    it("should permit Pegawai to execute bulk SOFT_REJECT", async () => {
      const caller = getCaller(pegawaiUser);
      const res = await caller.reviews.bulkDelete({
        ids: [bulkTestReview1Id, bulkTestReview2Id],
        mode: "SOFT_REJECT",
        reason: "Tolak massal integrasi",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("SOFT_REJECT");
      expect(res.count).toBe(2);

      const items = await prisma.ratingReview.findMany({
        where: { id: { in: [bulkTestReview1Id, bulkTestReview2Id] } },
      });
      expect(items.every((i) => i.validationStatus === ValidationStatus.REJECTED)).toBe(true);
    });

    it("should reject Pegawai attempting bulk PERMANENT delete", async () => {
      const caller = getCaller(pegawaiUser);
      await expect(
        caller.reviews.bulkDelete({
          ids: [bulkTestReview1Id, bulkTestReview2Id],
          mode: "PERMANENT",
          reason: "Hapus permanen tanpa hak akses",
        })
      ).rejects.toThrow("Hanya Super Admin yang berhak menghapus data ulasan secara permanen.");
    });

    it("should permit Super Admin to execute bulk PERMANENT delete", async () => {
      const caller = getCaller(adminUser);
      const res = await caller.reviews.bulkDelete({
        ids: [bulkTestReview1Id, bulkTestReview2Id],
        mode: "PERMANENT",
        reason: "Hapus permanen oleh Super Admin",
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe("PERMANENT");
      expect(res.count).toBe(2);

      const count = await prisma.ratingReview.count({
        where: { id: { in: [bulkTestReview1Id, bulkTestReview2Id] } },
      });
      expect(count).toBe(0);
    });

    it("should validate confirmText on deleteAll", async () => {
      const caller = getCaller(adminUser);
      await expect(
        caller.reviews.deleteAll({
          mode: "PERMANENT",
          reason: "Uji coba hapus semua",
          confirmText: "HAPUS",
        })
      ).rejects.toThrow("Konfirmasi teks harus tepat 'HAPUS SEMUA'.");
    });

    it("should reject Pegawai from executing PERMANENT on deleteAll", async () => {
      const caller = getCaller(pegawaiUser);
      await expect(
        caller.reviews.deleteAll({
          mode: "PERMANENT",
          reason: "Uji coba hapus semua",
          confirmText: "HAPUS SEMUA",
        })
      ).rejects.toThrow("Hanya Super Admin yang berhak menghapus data ulasan secara permanen.");
    });
  });

  describe("8. Defensive RBAC Boundary for Non-Operator Roles", () => {
    it("should reject PETUGAS_LAPANGAN from accessing any review management procedures", async () => {
      const caller = getCaller(fieldUser);

      await expect(
        caller.reviews.getList({ page: 1, pageSize: 10 })
      ).rejects.toThrow("Hanya Pegawai Operator atau Super Admin yang diizinkan.");

      await expect(
        caller.reviews.getDetail({ id: createdReviewIds[0] })
      ).rejects.toThrow("Hanya Pegawai Operator atau Super Admin yang diizinkan.");
    });
  });
});
