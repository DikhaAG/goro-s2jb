import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  calculateHammingDistance,
  checkImageDuplicate,
} from "@/server/services/antiFraudService";
import prisma from "@/lib/prisma";

describe("Anti-Fraud Perceptual Hashing & Hamming Distance Service", () => {
  const hashOriginal = "8707f8f80707f0f8"; // 64-bit hex
  const hashIdentical = "8707f8f80707f0f8"; // 0 bit difference
  const hashNearDup = "8707f8f80707f0f9";   // 1 bit difference (f8 vs f9)
  const hashFar = "00000000ffffffff";       // Completely different

  it("should calculate exact Hamming distance between 64-bit hex hashes", () => {
    expect(calculateHammingDistance(hashOriginal, hashIdentical)).toBe(0);
    expect(calculateHammingDistance(hashOriginal, hashNearDup)).toBe(1);
    expect(calculateHammingDistance(hashOriginal, hashFar)).toBeGreaterThan(15);
  });

  describe("Database Anti-Fraud Check", () => {
    let originalReviewId: string;
    let up3Id: string;
    let ulpId: string;
    let versionId: string;

    beforeAll(async () => {
      const ulp = await prisma.uLP.findFirst({
        where: { code: "ULP_RIV" },
        include: { up3: true },
      });
      const version = await prisma.appVersion.findFirst({
        where: { version: "V5.2.79" },
      });

      ulpId = ulp!.id;
      up3Id = ulp!.up3Id;
      versionId = version!.id;

      // Clean up previous test hashes
      await prisma.ratingReview.deleteMany({
        where: {
          evidenceImageHash: { in: [hashOriginal, hashNearDup] },
        },
      });

      // Insert original review
      const rev = await prisma.ratingReview.create({
        data: {
          up3Id,
          ulpId,
          appVersionId: versionId,
          playstoreReviewerName: "Pengulas Asli AntiFraud",
          evidenceImagePath: "uploads/test/sample_budi.png",
          evidenceImageHash: hashOriginal,
          validationStatus: "APPROVED",
          entryDate: new Date("2026-05-15"),
          timestamp: new Date(),
        },
      });
      originalReviewId = rev.id;
    });

    afterAll(async () => {
      await prisma.ratingReview.deleteMany({
        where: {
          evidenceImageHash: { in: [hashOriginal, hashNearDup] },
        },
      });
    });

    it("should detect exact visual duplicate (distance 0)", async () => {
      const result = await checkImageDuplicate("new_temp_id", hashOriginal);
      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOfId).toBe(originalReviewId);
      expect(result.minDistance).toBe(0);
    });

    it("should detect near visual duplicate within threshold (distance <= 5)", async () => {
      const result = await checkImageDuplicate("new_temp_id_2", hashNearDup, 5);
      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOfId).toBe(originalReviewId);
      expect(result.minDistance).toBe(1);
    });

    it("should not flag distinct image (distance > 5)", async () => {
      const result = await checkImageDuplicate("new_temp_id_3", hashFar, 5);
      expect(result.isDuplicate).toBe(false);
      expect(result.duplicateOfId).toBeNull();
    });
  });
});
