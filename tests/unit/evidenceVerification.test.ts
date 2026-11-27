import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { OcrProcessingStatus, ReviewSource, ValidationStatus } from "@prisma/client";
import { ocrQueue } from "@/server/queues/ocrQueue";
import {
  buildRustBatchDuplicatePayload,
  createInMemoryVisionEngineAdapter,
  enqueueEvidenceVerification,
  normalizeEvidenceQueuePath,
  rustVisionEngineAdapter,
  TransientVerificationError,
  verifyEvidence,
} from "@/server/services/evidenceVerification";

vi.mock("@/server/queues/ocrQueue", () => ({
  ocrQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
    addBulk: vi.fn().mockResolvedValue([{ id: "job-1" }, { id: "job-2" }]),
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  checkUploadRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

function createMockPrisma(reviewRow: Record<string, any> | null, candidates: any[] = []) {
  return {
    ratingReview: {
      findUnique: vi.fn().mockResolvedValue(reviewRow),
      findMany: vi.fn().mockResolvedValue(candidates),
      update: vi.fn().mockResolvedValue({ ...reviewRow }),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: "rev-created-1",
        ...data,
      })),
      delete: vi.fn().mockResolvedValue({ id: "rev-created-1" }),
    },
  };
}

describe("Verifikasi Eviden (evidenceVerification deep module)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Enqueue seam & path normalization", () => {
    it("normalizes absolute storageRoot paths to relative paths and preserves external URLs", async () => {
      const storageRoot = path.join(os.tmpdir(), "goro-ev-verify-norm");
      const absPath = path.join(storageRoot, "evidence", "2026", "11", "26", "sample.jpg");
      expect(normalizeEvidenceQueuePath(absPath, storageRoot)).toBe("evidence/2026/11/26/sample.jpg");
      expect(normalizeEvidenceQueuePath("https://drive.google.com/open?id=abc123", storageRoot)).toBe(
        "https://drive.google.com/open?id=abc123"
      );

      const db = createMockPrisma(null);
      const res = await enqueueEvidenceVerification(
        {
          reviewId: "rev-intake-1",
          evidenceImagePath: absPath,
          expectedReviewerName: "Budi Santoso",
        },
        { markQueuedInDb: false, prismaClient: db, storageRoot }
      );

      expect(res.enqueuedCount).toBe(1);
      expect(ocrQueue.add).toHaveBeenCalledWith(
        "process-ocr",
        {
          reviewId: "rev-intake-1",
          evidenceImagePath: "evidence/2026/11/26/sample.jpg",
          expectedReviewerName: "Budi Santoso",
        },
        { priority: 1, attempts: 3 }
      );
    });

    it("verifies a local evidence image from an injected temp storageRoot", async () => {
      const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "goro-verify-local-"));
      try {
        const relPath = "evidence/2026/11/27/local.jpg";
        const absPath = path.join(tempRoot, relPath);
        await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
        await fs.promises.writeFile(absPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

        const db = createMockPrisma({
          id: "rev-local-temp",
          source: ReviewSource.INTAKE,
          validationStatus: ValidationStatus.PENDING,
          verifiedAt: null,
          reviewRemarks: null,
          entryDate: new Date("2026-11-27"),
          evidenceImagePath: relPath,
          playstoreReviewerName: "Budi Santoso",
        });

        const visionEngine = createInMemoryVisionEngineAdapter({
          ocrResult: {
            success: true,
            extracted_text: "Budi Santoso",
            phash: "1010101010101010",
            similarity_score: 96,
            zone: "GREEN",
            recommended_status: ValidationStatus.APPROVED,
            execution_time_ms: 15,
          },
        });

        const result = await verifyEvidence(
          {
            reviewId: "rev-local-temp",
            evidenceImagePath: absPath,
            expectedReviewerName: "Budi Santoso",
          },
          {
            prismaClient: db,
            storageRoot: tempRoot,
            visionEngine,
            onReportApproved: async () => {},
          }
        );

        expect(result.success).toBe(true);
        expect(result.status).toBe(ValidationStatus.APPROVED);
      } finally {
        await fs.promises.rm(tempRoot, { recursive: true, force: true });
      }
    });

    it("enqueues bulk verification jobs uniformly and marks QUEUED in DB", async () => {
      const db = createMockPrisma(null);
      const res = await enqueueEvidenceVerification(
        [
          { reviewId: "r1", evidenceImagePath: "evidence/a.jpg", expectedReviewerName: "A" },
          { reviewId: "r2", evidenceImagePath: "https://drive.google.com/open?id=xyz", expectedReviewerName: "B" },
        ],
        { priority: 2, prismaClient: db }
      );

      expect(res.enqueuedCount).toBe(2);
      expect(db.ratingReview.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["r1", "r2"] } },
        data: { ocrStatus: OcrProcessingStatus.QUEUED },
      });
      expect(ocrQueue.addBulk).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Tri-zone outcomes, duplicate overrides, and manual decision protection", () => {
    it("auto-approves Green Zone non-duplicate reviews and notifies report cache", async () => {
      const db = createMockPrisma({
        id: "rev-green",
        source: ReviewSource.MIGRATION,
        validationStatus: ValidationStatus.PENDING,
        verifiedAt: null,
        reviewRemarks: null,
        entryDate: new Date("2026-11-20"),
        evidenceImagePath: "https://drive.google.com/file/d/sample/view",
        playstoreReviewerName: "Ahmad Dahlan",
      });
      const onReportApproved = vi.fn().mockResolvedValue(undefined);
      const visionEngine = createInMemoryVisionEngineAdapter({
        ocrResult: {
          success: true,
          extracted_text: "Ahmad Dahlan Ulasan Bintang Lima",
          phash: "1010101010101010",
          similarity_score: 95,
          zone: "GREEN",
          recommended_status: ValidationStatus.APPROVED,
          execution_time_ms: 42,
        },
      });

      const result = await verifyEvidence(
        {
          reviewId: "rev-green",
          evidenceImagePath: "https://drive.google.com/file/d/sample/view",
          expectedReviewerName: "Ahmad Dahlan",
        },
        {
          prismaClient: db,
          visionEngine,
          streamExternalEvidence: async () => ({
            success: true,
            buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
          }),
          onReportApproved,
        }
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(ValidationStatus.APPROVED);
      expect(onReportApproved).toHaveBeenCalledTimes(1);
      expect(db.ratingReview.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: "rev-green" },
          data: expect.objectContaining({
            ocrStatus: OcrProcessingStatus.COMPLETED,
            confidenceScore: 95,
            validationStatus: ValidationStatus.APPROVED,
          }),
        })
      );
    });

    it("rejects PENDING reviews when duplicate is detected even with >= 90% OCR score", async () => {
      const db = createMockPrisma({
        id: "rev-dup",
        source: ReviewSource.MIGRATION,
        validationStatus: ValidationStatus.PENDING,
        verifiedAt: null,
        reviewRemarks: null,
        entryDate: new Date("2026-11-20"),
        evidenceImagePath: "https://drive.google.com/file/d/dup/view",
        playstoreReviewerName: "Fraud Reviewer",
      });
      const visionEngine = createInMemoryVisionEngineAdapter({
        ocrResult: {
          success: true,
          extracted_text: "Fraud Reviewer",
          phash: "1111111100000000",
          similarity_score: 98,
          zone: "GREEN",
          recommended_status: ValidationStatus.APPROVED,
          execution_time_ms: 30,
        },
        duplicateResult: {
          isDuplicate: true,
          duplicateOfId: "orig-1",
          minDistance: 0,
          visualSimilarity: 100,
          textSimilarity: 100,
          reviewerSimilarity: 100,
          matchReason: "Nama Pengulas & Visual Identik",
        },
      });

      const result = await verifyEvidence(
        {
          reviewId: "rev-dup",
          evidenceImagePath: "https://drive.google.com/file/d/dup/view",
          expectedReviewerName: "Fraud Reviewer",
        },
        {
          prismaClient: db,
          visionEngine,
          streamExternalEvidence: async () => ({
            success: true,
            buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
          }),
          onReportApproved: async () => {},
        }
      );

      expect(result.status).toBe(ValidationStatus.REJECTED);
      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOfId).toBe("orig-1");
    });

    it("protects manual Pegawai decision (APPROVED/REJECTED) on retry even when OCR hits Green Zone", async () => {
      const db = createMockPrisma({
        id: "rev-manual-rejected",
        source: ReviewSource.MIGRATION,
        validationStatus: ValidationStatus.REJECTED,
        verifiedAt: null,
        reviewRemarks: "Ditolak manual karena bukti tidak valid",
        entryDate: new Date("2026-11-20"),
        evidenceImagePath: "https://drive.google.com/file/d/manual/view",
        playstoreReviewerName: "Syarika Aja",
      });
      const visionEngine = createInMemoryVisionEngineAdapter({
        ocrResult: {
          success: true,
          extracted_text: "Syarika Aja",
          phash: "1111000011110000",
          similarity_score: 100,
          zone: "GREEN",
          recommended_status: ValidationStatus.APPROVED,
          execution_time_ms: 25,
        },
      });

      const result = await verifyEvidence(
        {
          reviewId: "rev-manual-rejected",
          evidenceImagePath: "https://drive.google.com/file/d/manual/view",
          expectedReviewerName: "Syarika Aja",
        },
        {
          prismaClient: db,
          visionEngine,
          streamExternalEvidence: async () => ({
            success: true,
            buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
          }),
          onReportApproved: async () => {},
        }
      );

      expect(result.status).toBe(ValidationStatus.REJECTED);
      expect(db.ratingReview.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ocrStatus: OcrProcessingStatus.COMPLETED,
            confidenceScore: 100,
            validationStatus: ValidationStatus.REJECTED,
            reviewRemarks: "Ditolak manual karena bukti tidak valid",
          }),
        })
      );
    });
  });

  describe("3. Transient vs permanent failure", () => {
    it("throws TransientVerificationError on non-final retry when streaming fails, then marks FAILED on final attempt", async () => {
      const db = createMockPrisma({
        id: "rev-retry",
        source: ReviewSource.MIGRATION,
        validationStatus: ValidationStatus.PENDING,
        verifiedAt: null,
        reviewRemarks: null,
        entryDate: new Date("2026-11-20"),
        evidenceImagePath: "https://drive.google.com/file/d/missing/view",
        playstoreReviewerName: "Nofran",
      });

      await expect(
        verifyEvidence(
          {
            reviewId: "rev-retry",
            evidenceImagePath: "https://drive.google.com/file/d/missing/view",
            expectedReviewerName: "Nofran",
            isFinalAttempt: false,
          },
          {
            prismaClient: db,
            streamExternalEvidence: async () => ({
              success: false,
              error: "Drive HTTP 503",
            }),
          }
        )
      ).rejects.toThrow(TransientVerificationError);

      const finalResult = await verifyEvidence(
        {
          reviewId: "rev-retry",
          evidenceImagePath: "https://drive.google.com/file/d/missing/view",
          expectedReviewerName: "Nofran",
          isFinalAttempt: true,
        },
        {
          prismaClient: db,
          streamExternalEvidence: async () => ({
            success: false,
            error: "Drive HTTP 503",
          }),
        }
      );

      expect(finalResult.success).toBe(false);
      expect(finalResult.ocrStatus).toBe(OcrProcessingStatus.FAILED);
      expect(db.ratingReview.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ocrStatus: OcrProcessingStatus.FAILED,
            validationStatus: ValidationStatus.NEEDS_REVIEW,
            isDuplicate: false,
            duplicateOfId: null,
          }),
        })
      );
    });

    it("marks missing local Eviden Ulasan file as permanentFailure immediately without retry", async () => {
      const db = createMockPrisma({
        id: "rev-local-missing",
        source: ReviewSource.INTAKE,
        validationStatus: ValidationStatus.PENDING,
        verifiedAt: null,
        reviewRemarks: null,
        entryDate: new Date("2026-11-20"),
        evidenceImagePath: "evidence/2026/11/26/does_not_exist.jpg",
        playstoreReviewerName: "Petugas",
      });

      const res = await verifyEvidence(
        {
          reviewId: "rev-local-missing",
          evidenceImagePath: "evidence/2026/11/26/does_not_exist.jpg",
          expectedReviewerName: "Petugas",
          isFinalAttempt: false,
        },
        { prismaClient: db }
      );

      expect(res.success).toBe(false);
      expect(res.permanentFailure).toBe(true);
      expect(res.ocrStatus).toBe(OcrProcessingStatus.FAILED);
    });
  });

  describe("4. Rust BatchDuplicateRequest contract", () => {
    it("serializes review_id and image_hash (never target_hash) and parses Rust HTTP response", async () => {
      const payload = buildRustBatchDuplicatePayload({
        reviewId: "rev-99",
        imageHash: "8707f8f80707f0f8",
        threshold: 5,
        extractedText: "PLN Mobile",
        reviewerName: "Budi",
        evidenceImagePath: "evidence/2026/11/26/budi.jpg",
        candidates: [
          {
            id: "rev-1",
            evidenceImageHash: "8707f8f80707f0f8",
            duplicateOfId: null,
            extractedOcrText: "PLN Mobile",
            playstoreReviewerName: "Budi",
            evidenceImagePath: "evidence/2026/11/25/budi.jpg",
          },
        ],
      });

      expect(payload).toHaveProperty("review_id", "rev-99");
      expect(payload).toHaveProperty("image_hash", "8707f8f80707f0f8");
      expect(payload).not.toHaveProperty("target_hash");

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          is_duplicate: true,
          duplicate_of_id: "rev-1",
          min_distance: 0,
          visual_similarity: 100,
          text_similarity: 100,
          reviewer_similarity: 100,
          match_reason: "Nama Pengulas & Visual Identik",
          execution_time_ms: 4,
        }),
      }) as any;

      try {
        const res = await rustVisionEngineAdapter.checkBatchDuplicates({
          reviewId: "rev-99",
          imageHash: "8707f8f80707f0f8",
          threshold: 5,
          candidates: [
            {
              id: "rev-1",
              evidenceImageHash: "8707f8f80707f0f8",
              duplicateOfId: null,
              extractedOcrText: "PLN Mobile",
              playstoreReviewerName: "Budi",
              evidenceImagePath: "evidence/2026/11/25/budi.jpg",
            },
          ],
        });

        expect(res.isDuplicate).toBe(true);
        expect(res.duplicateOfId).toBe("rev-1");
        expect(res.matchReason).toBe("Nama Pengulas & Visual Identik");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("falls back to in-process duplicate assessment when Rust HTTP engine is unreachable", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as any;

      try {
        const res = await rustVisionEngineAdapter.checkBatchDuplicates({
          reviewId: "rev-fallback",
          imageHash: "aa853f6a4a5af207",
          threshold: 5,
          extractedText: "Layanan PLN cepat dan responsif",
          reviewerName: "Budi Santoso",
          evidenceImagePath: "evidence/2026/11/27/budi.jpg",
          candidates: [
            {
              id: "rev-template",
              evidenceImageHash: "aa853f6a4a5af206",
              duplicateOfId: null,
              extractedOcrText: "Listrik padam lama sekali",
              playstoreReviewerName: "Siti Aminah",
              evidenceImagePath: "evidence/2026/11/26/siti.jpg",
            },
            {
              id: "rev-orig",
              evidenceImageHash: "aa853f6a4a5af207",
              duplicateOfId: null,
              extractedOcrText: "Layanan PLN cepat dan responsif",
              playstoreReviewerName: "Budi Santoso",
              evidenceImagePath: "evidence/2026/11/25/budi.jpg",
            },
          ],
        });

        expect(res.isDuplicate).toBe(true);
        expect(res.duplicateOfId).toBe("rev-orig");
        expect(res.matchReason).toBe("Nama Pengulas & Visual Identik");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
