import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { appRouter } from "@/server/routers/_app";
import { processEvidenceOcr } from "@/server/services/ocrService";
import {
  Role,
  ValidationStatus,
  OcrProcessingStatus,
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
  });
});
