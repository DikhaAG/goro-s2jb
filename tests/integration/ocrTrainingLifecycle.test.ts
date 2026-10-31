import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { appRouter } from "@/server/routers/_app";
import {
  Role,
  ValidationStatus,
  OcrProcessingStatus,
  OcrSampleSource,
  OcrSampleInclusion,
  OcrModelStatus,
  OcrTrainingJobStatus,
} from "@prisma/client";
import {
  harvestFromApprovedReview,
} from "@/server/services/ocrDatasetHarvester";
import {
  activateModel,
  rollbackModel,
  getActiveModel,
  getActiveModelPath,
} from "@/server/services/ocrModelRegistryService";

describe("Subtask 19.6: End-to-End OCR Training, Model Registry & Hot-Reload Lifecycle", () => {
  let adminUser: { id: string; username: string; name: string; role: Role };
  let operatorUser: { id: string; username: string; name: string; role: Role };
  let testUp3Id: string;
  let testUlpId: string;
  let testAppVersionId: string;

  const createdReviewIds: string[] = [];
  const createdSampleIds: string[] = [];
  const createdModelIds: string[] = [];
  const createdJobIds: string[] = [];

  beforeAll(async () => {
    // 1. Fetch seed users and master data
    const admin = await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });
    const operator = await prisma.user.findFirst({ where: { role: Role.PEGAWAI } });
    adminUser = admin!;
    operatorUser = operator!;

    const up3 = await prisma.uP3.findFirst({ include: { ulps: true } });
    testUp3Id = up3!.id;
    testUlpId = up3!.ulps[0].id;

    const version = await prisma.appVersion.findFirst();
    testAppVersionId = version!.id;
  });

  afterAll(async () => {
    // Clean up created resources in reverse order
    if (createdJobIds.length > 0) {
      await prisma.ocrTrainingJob.deleteMany({
        where: { id: { in: createdJobIds } },
      }).catch(() => {});
    }

    if (createdModelIds.length > 0) {
      await prisma.ocrModelRegistry.deleteMany({
        where: { id: { in: createdModelIds } },
      }).catch(() => {});
    }

    if (createdSampleIds.length > 0) {
      await prisma.ocrTrainingSample.deleteMany({
        where: { id: { in: createdSampleIds } },
      }).catch(() => {});
    }

    if (createdReviewIds.length > 0) {
      await prisma.ratingReview.deleteMany({
        where: { id: { in: createdReviewIds } },
      }).catch(() => {});
    }

    await prisma.$disconnect();
  });

  const getCaller = (user: { id: string; name: string; username: string; role: Role }) => {
    return appRouter.createCaller({
      prisma,
      redis: redis as any,
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

  describe("1. Cold-Start & Active Learning Dataset Harvesting", () => {
    it("should harvest an approved review into OcrTrainingSample with APPROVED_FOR_TRAIN status", async () => {
      const review = await prisma.ratingReview.create({
        data: {
          up3Id: testUp3Id,
          ulpId: testUlpId,
          appVersionId: testAppVersionId,
          playstoreReviewerName: "E2E User Alpha",
          originalReviewerName: "alpha@pln.co.id",
          evidenceImagePath: "uploads/test/sample_budi.png",
          evidenceImageHash: "e2e_hash_11223344",
          validationStatus: ValidationStatus.APPROVED,
          ocrStatus: OcrProcessingStatus.COMPLETED,
          confidenceScore: 98.0,
          entryDate: new Date(),
        },
      });
      createdReviewIds.push(review.id);

      const sample = await harvestFromApprovedReview(
        review.id,
        {
          source: OcrSampleSource.TRIAGE_VALIDATION,
          actorId: operatorUser.id,
        },
        prisma
      );

      expect(sample).not.toBeNull();
      expect(sample?.groundTruthText).toBe("E2E User Alpha");
      expect(sample?.inclusion).toBe(OcrSampleInclusion.APPROVED_FOR_TRAIN);
      if (sample) createdSampleIds.push(sample.id);

      // Verify dataset stats aggregation through tRPC procedure
      const caller = getCaller(operatorUser);
      const stats = await caller.ocrTraining.getDatasetStats();
      expect(stats.approvedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("2. Dual-Trigger Status & Asynchronous Queue Enqueue", () => {
    it("should accurately compute trigger status metrics", async () => {
      const caller = getCaller(operatorUser);
      const triggerStatus = await caller.ocrTraining.getTriggerStatus();

      expect(triggerStatus).toHaveProperty("threshold");
      expect(triggerStatus).toHaveProperty("totalApprovedSamples");
      expect(triggerStatus).toHaveProperty("newSamplesCount");
      expect(triggerStatus).toHaveProperty("isCooldownActive");
      expect(triggerStatus.threshold).toBe(100);
    });

    it("should enqueue a manual training job to BullMQ queue and persist job record", async () => {
      const caller = getCaller(adminUser);
      const targetVer = `v1.test.${Date.now()}`;

      const res = await caller.ocrTraining.enqueueManualTraining({
        epochs: 5,
        batchSize: 8,
        learningRate: 0.001,
        targetVersion: targetVer,
      });

      expect(res.success).toBe(true);
      expect(res.jobId).toBeDefined();
      expect(res.targetVersion).toBe(targetVer);
      createdJobIds.push(res.jobId);

      // Verify record in database
      const dbJob = await prisma.ocrTrainingJob.findUnique({
        where: { id: res.jobId },
      });
      expect(dbJob).not.toBeNull();
      expect(dbJob?.modelTargetVersion).toBe(targetVer);
      expect(dbJob?.triggerType).toBe("MANUAL");

      // Verify Audit Log entry
      const audit = await prisma.auditLog.findFirst({
        where: { action: "ENQUEUE_MANUAL_OCR_TRAINING", entityId: res.jobId },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUser.id);
    });
  });

  describe("3. Model Registry Staging & Side-by-Side Comparison", () => {
    let stagingModelId: string;
    let baselineModelId: string;

    it("should register a trained model in STAGING status with objective evaluation metrics", async () => {
      const modelVer = `v1.stage.${Date.now()}`;
      const model = await prisma.ocrModelRegistry.create({
        data: {
          version: modelVer,
          name: `PLN Mobile CRNN ${modelVer}`,
          description: "Staging candidate model for E2E testing",
          artifactPath: `/uploads/training/models/${modelVer}/weights_latest.pt`,
          architecture: "CRNN_PYTORCH",
          status: OcrModelStatus.STAGING,
          cerScore: 2.45,
          werScore: 4.80,
          accuracyScore: 96.5,
          trainingSamplesCount: 250,
          epochsTrained: 10,
          durationSeconds: 45,
          trainedById: operatorUser.id,
          metadata: { device: "cpu" },
        },
      });
      stagingModelId = model.id;
      createdModelIds.push(model.id);

      const caller = getCaller(operatorUser);
      const details = await caller.ocrTraining.getModelDetails({ modelId: model.id });

      expect(details.status).toBe(OcrModelStatus.STAGING);
      expect(details.accuracyScore).toBe(96.5);
      expect(details.cerScore).toBe(2.45);
    });

    it("should compare staging candidate against another model and compute metrics delta", async () => {
      const baseVer = `v1.base.${Date.now()}`;
      const baseModel = await prisma.ocrModelRegistry.create({
        data: {
          version: baseVer,
          name: `PLN Mobile CRNN ${baseVer}`,
          artifactPath: `/uploads/training/models/${baseVer}/weights_latest.pt`,
          architecture: "CRNN_PYTORCH",
          status: OcrModelStatus.ARCHIVED,
          cerScore: 4.50,
          werScore: 8.20,
          accuracyScore: 91.0,
          trainingSamplesCount: 100,
          epochsTrained: 5,
        },
      });
      baselineModelId = baseModel.id;
      createdModelIds.push(baseModel.id);

      const caller = getCaller(operatorUser);
      const comparison = await caller.ocrTraining.compareModels({
        modelAId: baselineModelId,
        modelBId: stagingModelId,
      });

      expect(comparison.verdict).toBe("MODEL_B_BETTER");
      expect(comparison.delta.accuracy).toBe(5.5); // 96.5 - 91.0
      expect(comparison.delta.cer).toBe(-2.05);   // 2.45 - 4.50
      expect(comparison.isModelBImprovement).toBe(true);
    });
  });

  describe("4. Hot-Reload Activation to Production (Zero Downtime)", () => {
    let candidateModelId: string;
    let initialActiveModelId: string;

    it("should promote staging model to ACTIVE and automatically archive previously active models", async () => {
      // 1. Setup initial active model
      const initVer = `v1.active.${Date.now()}`;
      const initModel = await prisma.ocrModelRegistry.create({
        data: {
          version: initVer,
          name: `PLN Initial ${initVer}`,
          artifactPath: `/uploads/training/models/${initVer}/weights.pt`,
          status: OcrModelStatus.ACTIVE,
          accuracyScore: 92.0,
        },
      });
      initialActiveModelId = initModel.id;
      createdModelIds.push(initModel.id);

      // 2. Setup candidate model
      const candVer = `v1.candidate.${Date.now()}`;
      const candidateModel = await prisma.ocrModelRegistry.create({
        data: {
          version: candVer,
          name: `PLN Candidate ${candVer}`,
          artifactPath: `/uploads/training/models/${candVer}/weights.pt`,
          status: OcrModelStatus.STAGING,
          accuracyScore: 97.2,
        },
      });
      candidateModelId = candidateModel.id;
      createdModelIds.push(candidateModel.id);

      // 3. Promote candidate to ACTIVE via tRPC procedure
      const caller = getCaller(adminUser);
      const activateRes = await caller.ocrTraining.activateModel({
        modelId: candidateModelId,
      });

      expect(activateRes.success).toBe(true);
      expect(activateRes.model.status).toBe(OcrModelStatus.ACTIVE);

      // 4. Verify previous active model is now ARCHIVED
      const oldModelDb = await prisma.ocrModelRegistry.findUnique({
        where: { id: initialActiveModelId },
      });
      expect(oldModelDb?.status).toBe(OcrModelStatus.ARCHIVED);

      // 5. Verify getActiveModel and getActiveModelPath dynamically point to new model
      const activeModel = await getActiveModel(prisma, redis);
      expect(activeModel?.id).toBe(candidateModelId);
      expect(activeModel?.version).toBe(candVer);

      const activePath = await getActiveModelPath(prisma, redis);
      expect(activePath).toBe(candidateModel.artifactPath);

      // 6. Verify Audit Log entry
      const audit = await prisma.auditLog.findFirst({
        where: { action: "ACTIVATE_OCR_MODEL", entityId: candidateModelId },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUser.id);
    });
  });

  describe("5. Instant Safe Rollback to Previous Version", () => {
    it("should safely rollback from current active model to previous archived version with audit trail", async () => {
      // Archive any leftover active model first to isolate test
      await prisma.ocrModelRegistry.updateMany({
        where: { status: OcrModelStatus.ACTIVE },
        data: { status: OcrModelStatus.ARCHIVED },
      });

      // 1. Setup stable previous model
      const stableVer = `v1.stable.${Date.now()}`;
      const stableModel = await prisma.ocrModelRegistry.create({
        data: {
          version: stableVer,
          name: `PLN Stable ${stableVer}`,
          artifactPath: `/uploads/training/models/${stableVer}/weights.pt`,
          status: OcrModelStatus.ARCHIVED,
          accuracyScore: 94.0,
        },
      });
      createdModelIds.push(stableModel.id);

      // 2. Setup faulty current active model
      const faultyVer = `v1.faulty.${Date.now()}`;
      const faultyModel = await prisma.ocrModelRegistry.create({
        data: {
          version: faultyVer,
          name: `PLN Faulty ${faultyVer}`,
          artifactPath: `/uploads/training/models/${faultyVer}/weights.pt`,
          status: OcrModelStatus.ACTIVE,
          accuracyScore: 85.0,
        },
      });
      createdModelIds.push(faultyModel.id);

      // 3. Execute rollback via tRPC procedure
      const caller = getCaller(adminUser);
      const rollbackRes = await caller.ocrTraining.rollbackModel({
        targetModelId: stableModel.id,
        reason: "False negatives pada citra ulasan berlatar belakang gelap",
      });

      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.activeModel.id).toBe(stableModel.id);
      expect(rollbackRes.activeModel.status).toBe(OcrModelStatus.ACTIVE);

      // 4. Verify faulty model was archived and annotated with rollback metadata
      const faultyDb = await prisma.ocrModelRegistry.findUnique({
        where: { id: faultyModel.id },
      });
      expect(faultyDb?.status).toBe(OcrModelStatus.ARCHIVED);
      const meta = faultyDb?.metadata as Record<string, any>;
      expect(meta?.rollbackReason).toBe("False negatives pada citra ulasan berlatar belakang gelap");
      expect(meta?.rolledBackToVersion).toBe(stableVer);

      // 5. Verify dynamic active model lookup points to restored stable version
      const currentActive = await getActiveModel(prisma, redis);
      expect(currentActive?.id).toBe(stableModel.id);

      // 6. Verify Audit Log entry
      const audit = await prisma.auditLog.findFirst({
        where: { action: "ROLLBACK_OCR_MODEL", entityId: stableModel.id },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUser.id);
    });
  });

  describe("6. Dataset Sample Exclusion and Job Cancellation", () => {
    it("should exclude a noisy training sample with explicit reason", async () => {
      const sample = await prisma.ocrTrainingSample.create({
        data: {
          imagePath: "uploads/test/sample_noisy.png",
          groundTruthText: "Sample Noise Text",
          reviewerName: "Noise User",
          source: OcrSampleSource.MANUAL_CURATION,
          inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
        },
      });
      createdSampleIds.push(sample.id);

      const caller = getCaller(operatorUser);
      const res = await caller.ocrTraining.updateSampleInclusion({
        sampleId: sample.id,
        inclusion: OcrSampleInclusion.EXCLUDED,
        exclusionReason: "Tangkapan layar blur ekstrem tidak terbaca",
      });

      expect(res.success).toBe(true);
      const updated = await prisma.ocrTrainingSample.findUnique({
        where: { id: sample.id },
      });
      expect(updated?.inclusion).toBe(OcrSampleInclusion.EXCLUDED);
      expect(updated?.exclusionReason).toBe("Tangkapan layar blur ekstrem tidak terbaca");
    });

    it("should cancel a running or pending training job gracefully", async () => {
      const job = await prisma.ocrTrainingJob.create({
        data: {
          status: OcrTrainingJobStatus.RUNNING,
          triggerType: "MANUAL",
          modelTargetVersion: `v1.cancel.${Date.now()}`,
          datasetSize: 50,
          totalEpochs: 10,
          createdById: operatorUser.id,
          logs: ["Starting training..."],
        },
      });
      createdJobIds.push(job.id);

      const caller = getCaller(adminUser);
      const cancelRes = await caller.ocrTraining.cancelJob({
        jobId: job.id,
        reason: "Penghentian darurat oleh administrator",
      });

      expect(cancelRes.success).toBe(true);
      expect(cancelRes.job.status).toBe(OcrTrainingJobStatus.CANCELLED);

      const dbJob = await prisma.ocrTrainingJob.findUnique({
        where: { id: job.id },
      });
      expect(dbJob?.status).toBe(OcrTrainingJobStatus.CANCELLED);
      expect(dbJob?.errorMessage).toContain("Penghentian darurat");
    });
  });
});
