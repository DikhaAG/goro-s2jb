import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import { appRouter } from "@/server/routers/_app";
import { Role, ValidationStatus, OcrProcessingStatus, OcrSampleSource, OcrSampleInclusion } from "@prisma/client";
import {
  harvestFromApprovedReview,
  coldStartHarvestFromHistoricalSpreadsheet,
} from "@/server/services/ocrDatasetHarvester";

describe("Subtask 19.1: OCR Dataset & Active Learning Lifecycle Integration Test Suite", () => {
  let pegawaiUser: { id: string; username: string; name: string; role: Role };
  let adminUser: { id: string; username: string; name: string; role: Role };
  let testUp3Id: string;
  let testUlpId: string;
  let testAppVersionId: string;

  const createdReviewIds: string[] = [];
  const createdSampleIds: string[] = [];

  beforeAll(async () => {
    // 1. Fetch seed users and master data
    const pegawai = await prisma.user.findFirst({ where: { role: Role.PEGAWAI } });
    const admin = await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });
    pegawaiUser = pegawai!;
    adminUser = admin!;

    const up3 = await prisma.uP3.findFirst({ include: { ulps: true } });
    testUp3Id = up3!.id;
    testUlpId = up3!.ulps[0].id;

    const version = await prisma.appVersion.findFirst();
    testAppVersionId = version!.id;
  });

  afterAll(async () => {
    // Cleanup created training samples and reviews
    if (createdSampleIds.length > 0) {
      await prisma.ocrTrainingSample.deleteMany({
        where: { id: { in: createdSampleIds } },
      }).catch(() => {});
    }

    if (createdReviewIds.length > 0) {
      await prisma.ocrTrainingSample.deleteMany({
        where: { reviewId: { in: createdReviewIds } },
      }).catch(() => {});

      await prisma.ratingReview.deleteMany({
        where: { id: { in: createdReviewIds } },
      }).catch(() => {});
    }

    await prisma.$disconnect();
  });

  const getCaller = (user: { id: string; name: string; username: string; role: Role }) => {
    return appRouter.createCaller({
      prisma,
      redis: {} as any,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        up3Id: testUp3Id,
        ulpId: testUlpId,
      },
      req: {} as any,
    });
  };

  describe("1. Direct Harvester Service & Database Persistence", () => {
    it("should persist a ground truth training sample for an approved review", async () => {
      const review = await prisma.ratingReview.create({
        data: {
          up3Id: testUp3Id,
          ulpId: testUlpId,
          appVersionId: testAppVersionId,
          playstoreReviewerName: "Dewi Lestari Integration",
          originalReviewerName: "dewi@gmail.com",
          evidenceImagePath: "uploads/test/sample_dewi.png",
          evidenceImageHash: "feedface12345678",
          validationStatus: ValidationStatus.APPROVED,
          ocrStatus: OcrProcessingStatus.COMPLETED,
          confidenceScore: 96.0,
          entryDate: new Date(),
        },
      });
      createdReviewIds.push(review.id);

      const sample = await harvestFromApprovedReview(
        review.id,
        {
          source: OcrSampleSource.TRIAGE_VALIDATION,
          actorId: pegawaiUser.id,
        },
        prisma
      );

      expect(sample).not.toBeNull();
      expect(sample?.id).toBeDefined();
      expect(sample?.groundTruthText).toBe("Dewi Lestari Integration");
      expect(sample?.inclusion).toBe(OcrSampleInclusion.APPROVED_FOR_TRAIN);
      if (sample) createdSampleIds.push(sample.id);

      // Verify row in database
      const dbSample = await prisma.ocrTrainingSample.findUnique({
        where: { id: sample!.id },
      });
      expect(dbSample).not.toBeNull();
      expect(dbSample?.reviewId).toBe(review.id);
    });

    it("should cold-start harvest historical approved reviews in batch", async () => {
      const rev1 = await prisma.ratingReview.create({
        data: {
          up3Id: testUp3Id,
          ulpId: testUlpId,
          appVersionId: testAppVersionId,
          playstoreReviewerName: "ColdStart User 1",
          originalReviewerName: "cs1@gmail.com",
          evidenceImagePath: "uploads/test/cs1.png",
          validationStatus: ValidationStatus.APPROVED,
          ocrStatus: OcrProcessingStatus.COMPLETED,
          confidenceScore: 93.0,
          entryDate: new Date(),
        },
      });
      createdReviewIds.push(rev1.id);

      const stats = await coldStartHarvestFromHistoricalSpreadsheet(
        { batchSize: 50, actorId: adminUser.id },
        prisma
      );

      expect(stats.totalImported).toBeGreaterThanOrEqual(1);

      const found = await prisma.ocrTrainingSample.findFirst({
        where: { reviewId: rev1.id },
      });
      expect(found).not.toBeNull();
      expect(found?.source).toBe(OcrSampleSource.IMPORT_SPREADSHEET);
      if (found) createdSampleIds.push(found.id);
    });
  });

  describe("2. tRPC ocrTraining Procedures & RBAC", () => {
    it("should return aggregated dataset stats via tRPC", async () => {
      const caller = getCaller(pegawaiUser);
      const stats = await caller.ocrTraining.getDatasetStats();

      expect(stats.totalSamples).toBeGreaterThanOrEqual(1);
      expect(stats.approvedCount).toBeGreaterThanOrEqual(1);
    });

    it("should return paginated samples with filtering", async () => {
      const caller = getCaller(pegawaiUser);
      const res = await caller.ocrTraining.getSamples({
        page: 1,
        pageSize: 10,
        inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
      });

      expect(res.items.length).toBeGreaterThanOrEqual(1);
      expect(res.totalCount).toBeGreaterThanOrEqual(1);
    });

    it("should allow operator to exclude a sample with reason", async () => {
      const sample = await prisma.ocrTrainingSample.findFirst({
        where: { inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN },
      });
      expect(sample).not.toBeNull();

      const caller = getCaller(pegawaiUser);
      const res = await caller.ocrTraining.updateSampleInclusion({
        sampleId: sample!.id,
        inclusion: OcrSampleInclusion.EXCLUDED,
        exclusionReason: "Tangkapan layar resolusi rendah diuji",
      });

      expect(res.success).toBe(true);
      expect(res.sample.inclusion).toBe(OcrSampleInclusion.EXCLUDED);

      const updated = await prisma.ocrTrainingSample.findUnique({
        where: { id: sample!.id },
      });
      expect(updated?.inclusion).toBe(OcrSampleInclusion.EXCLUDED);
      expect(updated?.exclusionReason).toBe("Tangkapan layar resolusi rendah diuji");
    });
  });

  describe("3. Active Learning Hook on Triage Workflow", () => {
    it("should automatically harvest training sample when review is approved via triage", async () => {
      const review = await prisma.ratingReview.create({
        data: {
          up3Id: testUp3Id,
          ulpId: testUlpId,
          appVersionId: testAppVersionId,
          playstoreReviewerName: "Triage Active Learning User",
          originalReviewerName: "triage.al@gmail.com",
          evidenceImagePath: "uploads/test/triage_al.png",
          validationStatus: ValidationStatus.NEEDS_REVIEW,
          ocrStatus: OcrProcessingStatus.COMPLETED,
          confidenceScore: 78.0,
          entryDate: new Date(),
        },
      });
      createdReviewIds.push(review.id);

      const caller = getCaller(pegawaiUser);
      await caller.triage.submitDecision({
        reviewId: review.id,
        decision: "APPROVED",
        remarks: "Disetujui operator via triase",
      });

      // Wait 100ms for background async hook to execute
      await new Promise((r) => setTimeout(r, 150));

      const sample = await prisma.ocrTrainingSample.findFirst({
        where: { reviewId: review.id },
      });
      expect(sample).not.toBeNull();
      expect(sample?.groundTruthText).toBe("Triage Active Learning User");
      expect(sample?.source).toBe(OcrSampleSource.TRIAGE_VALIDATION);
      if (sample) createdSampleIds.push(sample.id);
    });

    it("should exclude training sample if triage approval is undone", async () => {
      const targetReviewId = createdReviewIds[createdReviewIds.length - 1];

      const caller = getCaller(pegawaiUser);
      await caller.triage.undoDecision({
        reviewId: targetReviewId,
        previousStatus: "NEEDS_REVIEW",
      });

      const sample = await prisma.ocrTrainingSample.findFirst({
        where: { reviewId: targetReviewId },
      });
      expect(sample).not.toBeNull();
      expect(sample?.inclusion).toBe(OcrSampleInclusion.EXCLUDED);
    });
  });
});

