import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { appRouter } from "@/server/routers/_app";
import { TRPCError } from "@trpc/server";

describe("Task 4: Triage Operator tRPC Procedure Integration & Audit Trail", () => {
  let pegawaiUser: { id: string; username: string; name: string; role: any };
  let fieldUser: { id: string; username: string; name: string; role: any };
  let testReviewId: string;
  let testUp3Id: string;
  let testUlpId: string;
  let testAppVersionId: string;

  beforeAll(async () => {
    // 1. Fetch seeded users
    const pegawai = await prisma.user.findFirst({
      where: { role: "PEGAWAI" },
    });
    const field = await prisma.user.findFirst({
      where: { role: "PETUGAS_LAPANGAN" },
    });
    const up3 = await prisma.uP3.findFirst();
    const ulp = await prisma.uLP.findFirst();
    const version = await prisma.appVersion.findFirst();

    pegawaiUser = pegawai!;
    fieldUser = field!;
    testUp3Id = up3!.id;
    testUlpId = ulp!.id;
    testAppVersionId = version!.id;

    // 2. Create test review record in NEEDS_REVIEW state
    const rev = await prisma.ratingReview.create({
      data: {
        up3Id: testUp3Id,
        ulpId: testUlpId,
        appVersionId: testAppVersionId,
        playstoreReviewerName: "Wahyu Operator Test",
        evidenceImagePath: "uploads/test/sample_budi.png",
        validationStatus: "NEEDS_REVIEW",
        confidenceScore: 78.5,
        extractedOcrText: "Wahyu ... ulasan aplikasi lancar ...",
        entryDate: new Date(),
        timestamp: new Date(),
      },
    });
    testReviewId = rev.id;
  });

  afterAll(async () => {
    await prisma.ratingReview.delete({
      where: { id: testReviewId },
    }).catch(() => {});

    await prisma.$disconnect();
    redis.disconnect();
  });

  it("should enforce RBAC guard: reject PETUGAS_LAPANGAN with FORBIDDEN (403)", async () => {
    const fieldCaller = appRouter.createCaller({
      prisma,
      redis,
      user: fieldUser,
      req: undefined,
    });

    await expect(
      fieldCaller.triage.getQueue({ status: "NEEDS_REVIEW" })
    ).rejects.toThrowError(TRPCError);

    try {
      await fieldCaller.triage.getQueue({ status: "NEEDS_REVIEW" });
    } catch (err: any) {
      expect(err.code).toBe("FORBIDDEN");
    }
  });

  it("should allow PEGAWAI operator to query triage queue and return tactical metrics", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: pegawaiUser,
      req: undefined,
    });

    const result = await operatorCaller.triage.getQueue({
      status: "NEEDS_REVIEW",
    });

    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.metrics).toBeDefined();
    expect(result.metrics.yellowQueueCount).toBeGreaterThanOrEqual(1);
    expect(typeof result.metrics.verifiedTodayCount).toBe("number");
    expect(typeof result.metrics.aiAutomationRate).toBe("number");

    // Verify test review item is returned with full relational metadata
    const item = result.items.find((i) => i.id === testReviewId);
    expect(item).toBeDefined();
    expect(item?.playstoreReviewerName).toBe("Wahyu Operator Test");
    expect(item?.confidenceScore).toBe(78.5);
    expect(item?.up3).toBeDefined();
    expect(item?.ulp).toBeDefined();
  });

  it("should record decision APPROVED with tamper-proof audit trail (verifiedById & verifiedAt)", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: pegawaiUser,
      req: undefined,
    });

    const beforeDecision = new Date();

    const decisionResult = await operatorCaller.triage.submitDecision({
      reviewId: testReviewId,
      decision: "APPROVED",
      remarks: "Disetujui verifikator manual",
    });

    expect(decisionResult.validationStatus).toBe("APPROVED");
    expect(decisionResult.verifiedById).toBe(pegawaiUser.id);
    expect(decisionResult.verifiedAt).toBeDefined();
    expect(new Date(decisionResult.verifiedAt!).getTime()).toBeGreaterThanOrEqual(
      beforeDecision.getTime() - 1000
    );
    expect(decisionResult.reviewRemarks).toContain("Disetujui verifikator manual");

    // Check database directly
    const dbRecord = await prisma.ratingReview.findUnique({
      where: { id: testReviewId },
      include: { verifiedBy: true },
    });
    expect(dbRecord?.validationStatus).toBe("APPROVED");
    expect(dbRecord?.verifiedById).toBe(pegawaiUser.id);
    expect(dbRecord?.verifiedBy?.username).toBe(pegawaiUser.username);
  });

  it("should record decision REJECTED with specific rejection reason", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: pegawaiUser,
      req: undefined,
    });

    const decisionResult = await operatorCaller.triage.submitDecision({
      reviewId: testReviewId,
      decision: "REJECTED",
      remarks: "Eviden buram/tidak terbaca",
    });

    expect(decisionResult.validationStatus).toBe("REJECTED");
    expect(decisionResult.verifiedById).toBe(pegawaiUser.id);
    expect(decisionResult.reviewRemarks).toBe("Eviden buram/tidak terbaca");
  });

  it("should support undo within reversible window, reverting to NEEDS_REVIEW", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: pegawaiUser,
      req: undefined,
    });

    const undoResult = await operatorCaller.triage.undoDecision({
      reviewId: testReviewId,
      previousStatus: "NEEDS_REVIEW",
    });

    expect(undoResult.validationStatus).toBe("NEEDS_REVIEW");
    expect(undoResult.verifiedById).toBeNull();
    expect(undoResult.verifiedAt).toBeNull();

    const dbRecord = await prisma.ratingReview.findUnique({
      where: { id: testReviewId },
    });
    expect(dbRecord?.validationStatus).toBe("NEEDS_REVIEW");
    expect(dbRecord?.verifiedById).toBeNull();
  });
});
