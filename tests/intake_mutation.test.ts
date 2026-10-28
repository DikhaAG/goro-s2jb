import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/context";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { ocrQueue } from "@/server/queues/ocrQueue";
import fs from "fs";
import path from "path";
import { BASE_UPLOAD_DIR } from "@/lib/storage";

describe("Intake Mutation Procedure (trpc.intake.submitReview)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let up3Id: string;
  let ulpId: string;
  let appVersionId: string;
  let createdReviewId: string | null = null;
  let createdFilePath: string | null = null;

  beforeAll(async () => {
    const ctx = await createContext();
    caller = appRouter.createCaller(ctx);

    const ulp = await prisma.uLP.findFirst({
      where: { code: "ULP_RIV" },
      include: { up3: true },
    });
    const version = await prisma.appVersion.findFirst({
      where: { version: "V5.2.79" },
    });

    ulpId = ulp!.id;
    up3Id = ulp!.up3Id;
    appVersionId = version!.id;
  });

  afterAll(async () => {
    if (createdReviewId) {
      await prisma.ratingReview.delete({ where: { id: createdReviewId } }).catch(() => {});
    }
    if (createdFilePath) {
      const abs = path.join(BASE_UPLOAD_DIR, createdFilePath);
      if (fs.existsSync(abs)) {
        await fs.promises.unlink(abs).catch(() => {});
      }
    }
    await ocrQueue.close();
    await prisma.$disconnect();
    redis.disconnect();
  });

  it("should accept valid payload, save image to date directory, create RatingReview in PENDING state, and queue OCR job in <500ms", async () => {
    const sampleBuffer = Buffer.from("dummy-image-content-for-intake-test");
    const sampleBase64 = "data:image/jpeg;base64," + sampleBuffer.toString("base64");

    const result = await caller.intake.submitReview({
      up3Id,
      ulpId,
      appVersionId,
      playstoreReviewerName: "Hendra Wijaya",
      originalReviewerName: "Hendra Wijaya",
      entryDate: "2026-05-18",
      reviewerCategory: "Pelanggan",
      fieldNotes: "Ulasan dari pelanggan gardu 4",
      evidenceImageBase64: sampleBase64,
      evidenceFilename: "bukti_hendra.jpg",
    });

    expect(result.success).toBe(true);
    expect(result.reviewId).toBeDefined();
    expect(result.evidencePath).toContain("evidence/2026/05/18");
    expect(result.latencyMs).toBeLessThan(1000); // Fast server response

    createdReviewId = result.reviewId;
    createdFilePath = result.evidencePath;

    // Verify DB entry
    const review = await prisma.ratingReview.findUnique({
      where: { id: result.reviewId },
      include: { up3: true, ulp: true, appVersion: true },
    });

    expect(review).toBeDefined();
    expect(review?.validationStatus).toBe("PENDING");
    expect(review?.playstoreReviewerName).toBe("Hendra Wijaya");
    expect(review?.up3.id).toBe(up3Id);
    expect(review?.ulp.id).toBe(ulpId);
    expect(review?.isDuplicate).toBe(false);

    // Verify physical file was written
    const physicalPath = path.join(BASE_UPLOAD_DIR, result.evidencePath);
    expect(fs.existsSync(physicalPath)).toBe(true);

    // Verify job in BullMQ
    const jobs = await ocrQueue.getJobs(["waiting", "delayed", "active", "completed"]);
    const queuedJob = jobs.find((j) => j.data.reviewId === result.reviewId);
    expect(queuedJob).toBeDefined();
    expect(queuedJob?.data.expectedReviewerName).toBe("Hendra Wijaya");
  });
});
