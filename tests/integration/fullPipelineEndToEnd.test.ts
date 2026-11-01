import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { appRouter } from "@/server/routers/_app";
import { processEvidenceOcr } from "@/server/services/ocrService";
import {
  harvestFromApprovedReview,
} from "@/server/services/ocrDatasetHarvester";
import {
  getActiveModel,
  getActiveModelPath,
} from "@/server/services/ocrModelRegistryService";
import { REDIS_TRAINING_ACTIVE_KEY } from "@/server/workers/ocrTrainingWorker";
import {
  Role,
  ValidationStatus,
  OcrProcessingStatus,
  OcrSampleSource,
  OcrSampleInclusion,
  OcrModelStatus,
  OcrTrainingJobStatus,
} from "@prisma/client";

describe("Comprehensive End-to-End Integration Test Suite: UI + Python OCR Worker + Database", () => {
  let adminUser: { id: string; username: string; name: string; role: Role };
  let operatorUser: { id: string; username: string; name: string; role: Role };
  let fieldUser: { id: string; username: string; name: string; role: Role };

  let testUp3: { id: string; code: string; name: string };
  let testUlp: { id: string; code: string; name: string; up3Id: string };
  let testAppVersion: { id: string; version: string };

  const sampleImagePath = path.resolve(process.cwd(), "uploads/test/sample_budi.png");
  const testSampleBuffer = fs.readFileSync(sampleImagePath);
  const testBase64 = testSampleBuffer.toString("base64");

  const createdReviewIds: string[] = [];
  const createdSampleIds: string[] = [];
  const createdModelIds: string[] = [];
  const createdJobIds: string[] = [];

  beforeAll(async () => {
    // 1. Fetch seed users
    const admin = await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });
    const operator = await prisma.user.findFirst({ where: { role: Role.PEGAWAI } });
    const field = await prisma.user.findFirst({ where: { role: Role.PETUGAS_LAPANGAN } });

    expect(admin).not.toBeNull();
    expect(operator).not.toBeNull();
    expect(field).not.toBeNull();

    adminUser = admin!;
    operatorUser = operator!;
    fieldUser = field!;

    // 2. Fetch master hierarchy data
    const up3 = await prisma.uP3.findFirst({
      where: { code: "UP3_PLG" },
      include: { ulps: true },
    });
    testUp3 = up3!;
    testUlp = up3!.ulps.find((u) => u.code === "ULP_RIV") || up3!.ulps[0];

    const version = await prisma.appVersion.findFirst({ where: { isActive: true } });
    testAppVersion = version!;
  });

  afterAll(async () => {
    // Cleanup created test records
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

    await redis.del(REDIS_TRAINING_ACTIVE_KEY).catch(() => {});
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
        up3Id: testUp3.id,
        ulpId: testUlp.id,
      },
      req: {} as any,
    });
  };

  describe("Phase 1: Environment & Engine Health Verification", () => {
    it("should successfully connect to PostgreSQL database and retrieve master data", async () => {
      const up3Count = await prisma.uP3.count();
      const ulpCount = await prisma.uLP.count();
      const userCount = await prisma.user.count();

      expect(up3Count).toBeGreaterThan(0);
      expect(ulpCount).toBeGreaterThan(0);
      expect(userCount).toBeGreaterThan(0);
    });

    it("should successfully execute Python OCR engine directly via adapter and extract valid results", async () => {
      const ocrResult = await processEvidenceOcr(sampleImagePath, "Budi Santoso");

      expect(ocrResult.success).toBe(true);
      expect(ocrResult.phash).toHaveLength(16);
      expect(ocrResult.extracted_text.toLowerCase()).toContain("budi");
      expect(ocrResult.zone).toBe("GREEN");
      expect(ocrResult.similarity_score).toBeGreaterThanOrEqual(80.0);
      expect(ocrResult.execution_time_ms).toBeGreaterThan(0);
    });
  });

  describe("Phase 2: Ingestion & Live OCR Processing Loop", () => {
    let newReviewId: string;

    it("should ingest evidence through intake API by Field Officer and persist to database", async () => {
      const fieldCaller = getCaller(fieldUser);
      const testName = `Pelanggan E2E ${Date.now()}`;

      const submitRes = await fieldCaller.intake.submitReview({
        up3Id: testUp3.id,
        ulpId: testUlp.id,
        appVersionId: testAppVersion.id,
        playstoreReviewerName: testName,
        originalReviewerName: testName,
        entryDate: new Date().toISOString().split("T")[0],
        evidenceImageBase64: `data:image/png;base64,${testBase64}`,
        evidenceFilename: "e2e_full_pipeline.png",
      });

      expect(submitRes.success).toBe(true);
      expect(submitRes.reviewId).toBeDefined();
      newReviewId = submitRes.reviewId;
      createdReviewIds.push(newReviewId);

      // Verify in database
      const dbReview = await prisma.ratingReview.findUnique({
        where: { id: newReviewId },
      });
      expect(dbReview).not.toBeNull();
      expect(dbReview?.validationStatus).toBe(ValidationStatus.PENDING);
      expect(dbReview?.submittedById).toBe(fieldUser.id);
    });

    it("should process evidence through Python OCR worker and update review metrics", async () => {
      // Simulate worker executing Python OCR on the newly ingested record
      const ocrResult = await processEvidenceOcr(sampleImagePath, "Budi Santoso");

      const updatedReview = await prisma.ratingReview.update({
        where: { id: newReviewId },
        data: {
          ocrStatus: OcrProcessingStatus.COMPLETED,
          extractedOcrText: ocrResult.extracted_text,
          evidenceImageHash: ocrResult.phash,
          confidenceScore: ocrResult.similarity_score,
          validationStatus: ValidationStatus.NEEDS_REVIEW, // Marginal score in triage queue
        },
      });

      expect(updatedReview.ocrStatus).toBe(OcrProcessingStatus.COMPLETED);
      expect(updatedReview.evidenceImageHash).toBe(ocrResult.phash);
      expect(updatedReview.validationStatus).toBe(ValidationStatus.NEEDS_REVIEW);
    });
  });

  describe("Phase 3: Operator Triase & Active Learning Auto-Harvesting", () => {
    let triageReviewId: string;

    beforeAll(async () => {
      // Create a test review in NEEDS_REVIEW status
      const review = await prisma.ratingReview.create({
        data: {
          up3Id: testUp3.id,
          ulpId: testUlp.id,
          appVersionId: testAppVersion.id,
          playstoreReviewerName: "Hendra Wijaya",
          originalReviewerName: "hendra@pln.co.id",
          evidenceImagePath: sampleImagePath,
          evidenceImageHash: "e2e_hash_hendra_123",
          validationStatus: ValidationStatus.NEEDS_REVIEW,
          ocrStatus: OcrProcessingStatus.COMPLETED,
          confidenceScore: 78.0,
          entryDate: new Date(),
        },
      });
      triageReviewId = review.id;
      createdReviewIds.push(triageReviewId);
    });

    it("should allow operator to inspect queue and approve review with remarks", async () => {
      const operatorCaller = getCaller(operatorUser);

      const decisionRes = await operatorCaller.triage.submitDecision({
        reviewId: triageReviewId,
        decision: "APPROVED",
        remarks: "Disetujui oleh verifikator dalam uji integrasi menyeluruh",
      });

      expect(decisionRes.validationStatus).toBe(ValidationStatus.APPROVED);
      expect(decisionRes.verifiedById).toBe(operatorUser.id);

      // Verify in database
      const verifiedDb = await prisma.ratingReview.findUnique({
        where: { id: triageReviewId },
      });
      expect(verifiedDb?.validationStatus).toBe(ValidationStatus.APPROVED);
    });

    it("should automatically harvest approved review into OcrTrainingSample dataset pool", async () => {
      // Execute active learning harvest hook explicitly to verify logic
      const sample = await harvestFromApprovedReview(
        triageReviewId,
        {
          source: OcrSampleSource.TRIAGE_VALIDATION,
          actorId: operatorUser.id,
        },
        prisma
      );

      expect(sample).not.toBeNull();
      expect(sample?.groundTruthText).toBe("Hendra Wijaya");
      expect(sample?.inclusion).toBe(OcrSampleInclusion.APPROVED_FOR_TRAIN);
      expect(sample?.source).toBe(OcrSampleSource.TRIAGE_VALIDATION);
      if (sample) createdSampleIds.push(sample.id);

      // Check dataset stats via tRPC
      const operatorCaller = getCaller(operatorUser);
      const stats = await operatorCaller.ocrTraining.getDatasetStats();
      expect(stats.totalSamples).toBeGreaterThanOrEqual(1);
      expect(stats.approvedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Phase 4: Dataset Curation & Quality Control", () => {
    it("should allow operator to toggle noisy sample inclusion status to EXCLUDED", async () => {
      const operatorCaller = getCaller(operatorUser);

      // Fetch samples list
      const samplesRes = await operatorCaller.ocrTraining.getSamples({
        page: 1,
        pageSize: 10,
        inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
      });

      expect(samplesRes.items.length).toBeGreaterThanOrEqual(1);
      const targetSample = samplesRes.items[0];

      // Exclude sample
      const excludeRes = await operatorCaller.ocrTraining.updateSampleInclusion({
        sampleId: targetSample.id,
        inclusion: OcrSampleInclusion.EXCLUDED,
        exclusionReason: "Kualitas citra blur ekstrem terdeteksi saat inspeksi kurasi",
      });

      expect(excludeRes.success).toBe(true);
      expect(excludeRes.sample.inclusion).toBe(OcrSampleInclusion.EXCLUDED);

      // Restore back to APPROVED_FOR_TRAIN
      const restoreRes = await operatorCaller.ocrTraining.updateSampleInclusion({
        sampleId: targetSample.id,
        inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
      });

      expect(restoreRes.success).toBe(true);
      expect(restoreRes.sample.inclusion).toBe(OcrSampleInclusion.APPROVED_FOR_TRAIN);
    });
  });

  describe("Phase 5: Asynchronous Training Job Dispatch & Monitoring", () => {
    let createdJobId: string;
    const targetVersion = `v2.e2e.${Date.now()}`;

    it("should evaluate dual-trigger threshold and enqueue manual training job", async () => {
      const adminCaller = getCaller(adminUser);

      // 1. Check trigger status
      const triggerStatus = await adminCaller.ocrTraining.getTriggerStatus();
      expect(triggerStatus).toHaveProperty("threshold");
      expect(triggerStatus).toHaveProperty("totalApprovedSamples");

      // 2. Enqueue manual training job
      const enqueueRes = await adminCaller.ocrTraining.enqueueManualTraining({
        epochs: 3,
        batchSize: 4,
        learningRate: 0.0005,
        targetVersion,
      });

      expect(enqueueRes.success).toBe(true);
      expect(enqueueRes.jobId).toBeDefined();
      createdJobId = enqueueRes.jobId;
      createdJobIds.push(createdJobId);

      // Verify in database
      const jobDb = await prisma.ocrTrainingJob.findUnique({
        where: { id: createdJobId },
      });
      expect(jobDb).not.toBeNull();
      expect(jobDb?.modelTargetVersion).toBe(targetVersion);
      expect(jobDb?.status).toBe(OcrTrainingJobStatus.PENDING);
    });

    it("should update and monitor training job progress through tRPC", async () => {
      // Simulate worker updating database record
      await prisma.ocrTrainingJob.update({
        where: { id: createdJobId },
        data: {
          status: OcrTrainingJobStatus.RUNNING,
          currentEpoch: 2,
          totalEpochs: 3,
          currentLoss: 0.1245,
          logs: [{ level: "INFO", message: "Epoch 2/3 complete. CTC Loss: 0.1245" }],
        },
      });

      // Simulate worker publishing live stream to Redis for UI polling
      await redis.set(
        REDIS_TRAINING_ACTIVE_KEY,
        JSON.stringify({
          jobId: createdJobId,
          targetVersion,
          triggerType: "MANUAL",
          currentEpoch: 2,
          totalEpochs: 3,
          progressPercent: 67,
          currentLoss: 0.1245,
          datasetSize: 100,
        })
      );

      const operatorCaller = getCaller(operatorUser);
      const activeJobStatus = await operatorCaller.ocrTraining.getActiveJobStatus();

      expect(activeJobStatus).not.toBeNull();
      expect(activeJobStatus?.jobId).toBe(createdJobId);
      expect(activeJobStatus?.currentEpoch).toBe(2);
      expect(activeJobStatus?.progressPercent).toBe(67);
    });
  });

  describe("Phase 6: Model Registry Governance, Zero-Downtime Hot-Reload & Safe Rollback", () => {
    let stagingModelId: string;
    let initialActiveModelId: string;
    const candidateVersion = `v2.prod.${Date.now()}`;

    beforeAll(async () => {
      // Archive any active models to ensure clean isolation
      await prisma.ocrModelRegistry.updateMany({
        where: { status: OcrModelStatus.ACTIVE },
        data: { status: OcrModelStatus.ARCHIVED },
      });

      // Create an initial active model (v1.0.0)
      const initialModel = await prisma.ocrModelRegistry.create({
        data: {
          version: `v1.initial.${Date.now()}`,
          name: "Model Baseline Produksi V1",
          artifactPath: "/uploads/training/models/v1.initial/weights.pt",
          architecture: "CRNN_PYTORCH",
          status: OcrModelStatus.ACTIVE,
          accuracyScore: 92.5,
          cerScore: 3.8,
          werScore: 7.2,
          trainingSamplesCount: 500,
        },
      });
      initialActiveModelId = initialModel.id;
      createdModelIds.push(initialModel.id);

      // Create trained candidate model in STAGING
      const stagingModel = await prisma.ocrModelRegistry.create({
        data: {
          version: candidateVersion,
          name: `Model CRNN Adaptif ${candidateVersion}`,
          artifactPath: `/uploads/training/models/${candidateVersion}/weights.pt`,
          architecture: "CRNN_PYTORCH",
          status: OcrModelStatus.STAGING,
          accuracyScore: 97.4,
          cerScore: 1.4,
          werScore: 3.1,
          trainingSamplesCount: 850,
          trainedById: operatorUser.id,
        },
      });
      stagingModelId = stagingModel.id;
      createdModelIds.push(stagingModel.id);
    });

    it("should compare candidate model against active model and show positive quality delta", async () => {
      const operatorCaller = getCaller(operatorUser);

      const comparison = await operatorCaller.ocrTraining.compareModels({
        modelAId: initialActiveModelId,
        modelBId: stagingModelId,
      });

      expect(comparison.verdict).toBe("MODEL_B_BETTER");
      expect(comparison.isModelBImprovement).toBe(true);
      expect(comparison.delta.accuracy).toBeGreaterThan(0);
      expect(comparison.delta.cer).toBeLessThan(0); // CER decreased = improvement
    });

    it("should promote staging model to ACTIVE with zero downtime hot-reload", async () => {
      const adminCaller = getCaller(adminUser);

      const activationRes = await adminCaller.ocrTraining.activateModel({
        modelId: stagingModelId,
      });

      expect(activationRes.success).toBe(true);
      expect(activationRes.model.status).toBe(OcrModelStatus.ACTIVE);

      // Dynamic path resolver must point to new model immediately
      const currentActivePath = await getActiveModelPath(prisma, redis);
      expect(currentActivePath).toBe(`/uploads/training/models/${candidateVersion}/weights.pt`);

      const currentActiveModel = await getActiveModel(prisma, redis);
      expect(currentActiveModel?.id).toBe(stagingModelId);
      expect(currentActiveModel?.version).toBe(candidateVersion);

      // Previous active model must be transitioned to ARCHIVED
      const oldModelDb = await prisma.ocrModelRegistry.findUnique({
        where: { id: initialActiveModelId },
      });
      expect(oldModelDb?.status).toBe(OcrModelStatus.ARCHIVED);
    });

    it("should run Python OCR inference accepting the hot-reloaded model parameter", async () => {
      const currentActivePath = await getActiveModelPath(prisma, redis);

      const inferenceResult = await processEvidenceOcr(sampleImagePath, "Budi Santoso", {
        modelPath: currentActivePath || undefined,
      });

      expect(inferenceResult.success).toBe(true);
      expect(inferenceResult.extracted_text.toLowerCase()).toContain("budi");
      expect(inferenceResult.zone).toBe("GREEN");
    });

    it("should safely rollback to previous model version in 1-click with complete audit trail", async () => {
      const adminCaller = getCaller(adminUser);

      const rollbackRes = await adminCaller.ocrTraining.rollbackModel({
        targetModelId: initialActiveModelId,
        reason: "Rollback verifikasi ke versi stabil sebelumnya pada E2E suite",
      });

      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.activeModel.id).toBe(initialActiveModelId);
      expect(rollbackRes.activeModel.status).toBe(OcrModelStatus.ACTIVE);

      // Verify hot-reload path dynamically restored to initial model
      const restoredPath = await getActiveModelPath(prisma, redis);
      expect(restoredPath).toBe("/uploads/training/models/v1.initial/weights.pt");

      // Verify candidate model was archived
      const candidateDb = await prisma.ocrModelRegistry.findUnique({
        where: { id: stagingModelId },
      });
      expect(candidateDb?.status).toBe(OcrModelStatus.ARCHIVED);

      // Verify Audit Log entry
      const audit = await prisma.auditLog.findFirst({
        where: { action: "ROLLBACK_OCR_MODEL", entityId: initialActiveModelId },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUser.id);
    });
  });
});
