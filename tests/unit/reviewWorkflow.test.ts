import { describe, it, expect, vi, beforeEach } from "vitest";
import { OcrProcessingStatus, Role, ValidationStatus } from "@prisma/client";
import {
  buildReviewWhereClause,
  createRedisCacheStampAdapter,
  createReviewWorkflow,
} from "@/server/services/reviewWorkflow";

describe("Review Workflow Deep Module", () => {
  let mockPrisma: any;
  let stampReportsCache: ReturnType<typeof vi.fn>;
  let enqueueVerification: ReturnType<typeof vi.fn>;

  const operatorActor = {
    id: "usr-op-1",
    name: "Operator Triase",
    username: "op_triase",
    role: Role.PEGAWAI,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stampReportsCache = vi.fn().mockResolvedValue(undefined);
    enqueueVerification = vi.fn().mockResolvedValue({
      enqueuedCount: 1,
      jobIds: ["job-1"],
    });

    mockPrisma = {
      ratingReview: {
        count: vi.fn().mockResolvedValue(12),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({
          id: "rev-1",
          playstoreReviewerName: "Budi Santoso",
          validationStatus: ValidationStatus.NEEDS_REVIEW,
          ocrStatus: OcrProcessingStatus.COMPLETED,
          verifiedById: null,
          verifiedAt: null,
          reviewRemarks: "Zona Kuning (82%)",
          up3Id: "up3-1",
          ulpId: "ulp-1",
          entryDate: new Date("2026-10-20"),
          isDuplicate: false,
        }),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "rev-1",
            ...data,
          })
        ),
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        delete: vi.fn().mockResolvedValue({ id: "rev-1" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
      uLP: {
        findFirst: vi.fn().mockResolvedValue({ id: "ulp-1", up3Id: "up3-1" }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      uP3: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      appVersion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn().mockImplementation((ops) => Promise.all(ops)),
    };
  });

  it("composes search and RED validationZone inside where.AND without overwriting where.OR", () => {
    const where = buildReviewWhereClause({
      search: "Wahyu",
      validationZone: "RED",
      validationStatus: "NEEDS_REVIEW",
    });

    expect(where.validationStatus).toBe(ValidationStatus.NEEDS_REVIEW);
    expect(where.OR).toBeUndefined();
    expect(Array.isArray(where.AND)).toBe(true);
    expect(where.AND).toHaveLength(2);
    expect((where.AND as any[])[0].OR).toHaveLength(5);
    expect((where.AND as any[])[1].OR).toEqual([
      { confidenceScore: { lt: 70.0 } },
      { ocrStatus: OcrProcessingStatus.FAILED },
    ]);
  });

  it("returns dedicated needsReview count in getList KPIs", async () => {
    mockPrisma.ratingReview.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(4) // approved
      .mockResolvedValueOnce(2) // rejected
      .mockResolvedValueOnce(1) // pending
      .mockResolvedValueOnce(3) // needsReview
      .mockResolvedValueOnce(2) // activeOcr
      .mockResolvedValueOnce(1); // duplicates

    const workflow = createReviewWorkflow({
      prisma: mockPrisma,
      stampReportsCache,
      enqueueVerification,
    });

    const result = await workflow.getList({ validationStatus: "NEEDS_REVIEW" });

    expect(result.kpi).toEqual({
      total: 10,
      approved: 4,
      rejected: 2,
      pending: 1,
      needsReview: 3,
      activeOcr: 2,
      duplicates: 1,
    });
  });

  it("submitDecision records previous-state snapshot in AuditLog and stamps reports cache", async () => {
    const workflow = createReviewWorkflow({
      prisma: mockPrisma,
      stampReportsCache,
      enqueueVerification,
    });

    await workflow.submitDecision(
      { reviewId: "rev-1", decision: "APPROVED", remarks: "Cocok" },
      operatorActor
    );

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "SUBMIT_REVIEW_DECISION",
          entityId: "rev-1",
          metadata: expect.objectContaining({
            decision: "APPROVED",
            previousStatus: ValidationStatus.NEEDS_REVIEW,
            previousVerifiedById: null,
            previousVerifiedAt: null,
            previousRemarks: "Zona Kuning (82%)",
          }),
        }),
      })
    );
    expect(stampReportsCache).toHaveBeenCalledTimes(1);
  });

  it("undoDecision restores exact state from server AuditLog snapshot even across non-NEEDS_REVIEW prior states", async () => {
    mockPrisma.ratingReview.findUnique.mockResolvedValueOnce({
      id: "rev-1",
      validationStatus: ValidationStatus.REJECTED,
      verifiedById: "usr-op-1",
      verifiedAt: new Date("2026-10-21T01:00:00Z"),
      reviewRemarks: "Ditolak sementara",
    });

    mockPrisma.auditLog.findMany.mockResolvedValueOnce([
      {
        id: "audit-prev",
        action: "SUBMIT_REVIEW_DECISION",
        metadata: {
          previousStatus: ValidationStatus.APPROVED,
          previousVerifiedById: "usr-earlier",
          previousVerifiedAt: "2026-10-19T08:00:00.000Z",
          previousRemarks: "Disetujui sebelumnya",
        },
      },
    ]);

    const workflow = createReviewWorkflow({
      prisma: mockPrisma,
      stampReportsCache,
      enqueueVerification,
    });

    const reverted = await workflow.undoDecision(
      { reviewId: "rev-1", previousStatus: "NEEDS_REVIEW" },
      operatorActor
    );

    expect(reverted.validationStatus).toBe(ValidationStatus.APPROVED);
    expect(reverted.verifiedById).toBe("usr-earlier");
    expect(reverted.reviewRemarks).toBe("Disetujui sebelumnya");
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UNDO_REVIEW_DECISION",
          entityId: "rev-1",
          metadata: expect.objectContaining({
            revertedFromStatus: ValidationStatus.REJECTED,
            restoredStatus: ValidationStatus.APPROVED,
            usedServerSnapshot: true,
          }),
        }),
      })
    );
    expect(stampReportsCache).toHaveBeenCalledTimes(1);
  });

  it("undoDecision falls back to input previousStatus when no decision snapshot log exists", async () => {
    mockPrisma.ratingReview.findUnique.mockResolvedValueOnce({
      id: "rev-1",
      validationStatus: ValidationStatus.APPROVED,
      verifiedById: "usr-op-1",
      verifiedAt: new Date(),
      reviewRemarks: "Disetujui oleh Operator",
    });
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);

    const workflow = createReviewWorkflow({
      prisma: mockPrisma,
      stampReportsCache,
      enqueueVerification,
    });

    const reverted = await workflow.undoDecision(
      { reviewId: "rev-1", previousStatus: "PENDING" },
      operatorActor
    );

    expect(reverted.validationStatus).toBe(ValidationStatus.PENDING);
    expect(reverted.verifiedById).toBeNull();
    expect(reverted.verifiedAt).toBeNull();
    expect(stampReportsCache).toHaveBeenCalledTimes(1);
  });

  it("stamps reports cache on update, bulkUpdate, delete, bulkDelete, and deleteAll", async () => {
    const workflow = createReviewWorkflow({
      prisma: mockPrisma,
      stampReportsCache,
      enqueueVerification,
    });

    await workflow.update(
      { id: "rev-1", playstoreReviewerName: "Nama Baru" },
      operatorActor
    );
    await workflow.bulkUpdate(
      { ids: ["rev-1", "rev-2"], validationStatus: ValidationStatus.APPROVED },
      operatorActor
    );
    await workflow.delete(
      { id: "rev-1", mode: "SOFT_REJECT", reason: "Buram" },
      operatorActor
    );
    await workflow.bulkDelete(
      { ids: ["rev-1"], mode: "SOFT_REJECT", reason: "Massal" },
      operatorActor
    );
    await workflow.deleteAll(
      { mode: "SOFT_REJECT", reason: "Reset", confirmText: "HAPUS SEMUA" },
      operatorActor
    );

    expect(stampReportsCache).toHaveBeenCalledTimes(5);
  });

  it("Redis cache stamp adapter handles missing clients and swallows Redis errors safely", async () => {
    const noopAdapter = createRedisCacheStampAdapter({});
    await expect(noopAdapter()).resolves.toBeUndefined();

    const failingAdapter = createRedisCacheStampAdapter({
      status: "ready",
      set: vi.fn().mockRejectedValue(new Error("Redis down")),
    });
    await expect(failingAdapter()).resolves.toBeUndefined();

    const mockSet = vi.fn().mockResolvedValue("OK");
    const workingAdapter = createRedisCacheStampAdapter({
      status: "ready",
      set: mockSet,
    });
    await workingAdapter();
    expect(mockSet).toHaveBeenCalledWith(
      "reports:last_update_timestamp",
      expect.any(String)
    );
  });
});
