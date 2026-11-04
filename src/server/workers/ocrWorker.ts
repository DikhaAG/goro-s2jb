import { Worker, Job } from "bullmq";
import redis from "@/lib/redis";
import prisma from "@/lib/prisma";
import { OCR_QUEUE_NAME, OcrJobData } from "../queues/ocrQueue";
import { executeOcrBridge } from "../services/ocrBridge";
import { checkImageDuplicate } from "../services/antiFraudService";
import {
  streamEvidenceImageBuffer,
  isExternalUrl,
} from "../services/evidenceDownloader";
import path from "path";
import { BASE_UPLOAD_DIR } from "@/lib/storage";
import { recordJobCompleted, recordJobFailed } from "../queues/queueTelemetry";

export async function processOcrJob(job: Job<OcrJobData>, queueName: string = OCR_QUEUE_NAME) {
  const jobStartTime = Date.now();
  console.log(`[OCR Worker] Processing job ${job.id} for reviewId: ${job.data.reviewId}`);
  const { reviewId, evidenceImagePath, expectedReviewerName } = job.data;

  // Check if review record still exists in DB
  const existingReview = await prisma.ratingReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      source: true,
      validationStatus: true,
      verifiedAt: true,
      reviewRemarks: true,
      entryDate: true,
      evidenceImagePath: true,
      playstoreReviewerName: true,
    },
  });

  if (!existingReview) {
    console.warn(`[OCR Worker] Review ${reviewId} not found in database. Skipping job.`);
    return { success: false, error: "Review record not found in database" };
  }

  let ocrInput: string | Buffer = "";
  const isMigration = existingReview.source === "MIGRATION" || isExternalUrl(evidenceImagePath);

  if (isMigration) {
    // MIGRATION DATA: Stream directly from Google Drive URL into memory without local disk persistence
    await prisma.ratingReview.update({
      where: { id: reviewId },
      data: { ocrStatus: "DOWNLOADING" },
    }).catch(() => {});

    const streamResult = await streamEvidenceImageBuffer(evidenceImagePath);
    if (!streamResult.success || !streamResult.buffer) {
      console.error(`[OCR Worker] Failed streaming image for reviewId: ${reviewId}`, streamResult.error);
      await prisma.ratingReview.update({
        where: { id: reviewId },
        data: {
          ocrStatus: "FAILED",
          validationStatus: "NEEDS_REVIEW",
          reviewRemarks: `OCR Gagal: Tautan gambar Google Drive tidak dapat dialirkan (${streamResult.error || "Gagal streaming"})`,
        },
      }).catch(() => {});
      return { success: false, error: streamResult.error };
    }

    ocrInput = streamResult.buffer;
    // Strict Zero-Storage: evidenceImagePath remains the original Google Drive URL (never overwritten to local path)
  } else {
    // INTAKE DATA: Local physical file stored in uploads/evidence/
    ocrInput = path.isAbsolute(evidenceImagePath)
      ? evidenceImagePath
      : path.join(BASE_UPLOAD_DIR, evidenceImagePath);
  }

  // Track state: Processing OCR extraction and fuzzy validation
  await prisma.ratingReview.update({
    where: { id: reviewId },
    data: { ocrStatus: "PROCESSING" },
  }).catch(() => {});

  // 1. Execute OCR and Fuzzy Matching through bridge (supports Buffer in-memory or file path)
  const ocrResult = await executeOcrBridge(ocrInput, expectedReviewerName);

  if (!ocrResult.success) {
    console.error(`[OCR Worker] Failed OCR for reviewId: ${reviewId}`, ocrResult.error);
    await prisma.ratingReview.update({
      where: { id: reviewId },
      data: {
        ocrStatus: "FAILED",
        validationStatus: "NEEDS_REVIEW",
        reviewRemarks: `OCR Gagal: ${ocrResult.error || "Citra tidak dapat diproses"}`,
      },
    }).catch(() => {
      // Ignore if review record does not exist in DB (e.g. synthetic queue test)
    });
    return { success: false, error: ocrResult.error };
  }

  // 2. Multimodal Anti-Fraud Check (Visual pHash + OCR Extracted Text + Reviewer Name)
  const antiFraudResult = await checkImageDuplicate(
    reviewId,
    ocrResult.phash,
    5,
    {
      extractedText: ocrResult.extracted_text,
      reviewerName: expectedReviewerName || existingReview.playstoreReviewerName,
      evidenceImagePath: existingReview.evidenceImagePath,
    }
  );

  const isGreenZone =
    !antiFraudResult.isDuplicate &&
    (ocrResult.similarity_score >= 90.0 || ocrResult.zone === "GREEN");

  let finalStatus = ocrResult.recommended_status;
  let reviewRemarks = `Verifikasi Otomatis AI (Skor: ${ocrResult.similarity_score}%, Zona: ${ocrResult.zone})`;

  if (antiFraudResult.isDuplicate) {
    finalStatus = "REJECTED";
    reviewRemarks = `Terindikasi duplikasi visual dengan ID: ${antiFraudResult.duplicateOfId} (Visual: ${antiFraudResult.visualSimilarity}%, Teks OCR: ${antiFraudResult.textSimilarity}%, Pengulas: ${antiFraudResult.reviewerSimilarity}%)`;
    console.warn(
      `[OCR Worker] Fraud Duplicate Detected! Review ${reviewId} matches ${antiFraudResult.duplicateOfId} (Visual: ${antiFraudResult.visualSimilarity}%, Text: ${antiFraudResult.textSimilarity}%, Reviewer: ${antiFraudResult.reviewerSimilarity}%)`
    );
  } else if (isGreenZone) {
    // Aturan Zona Hijau (Skor >= 90%): Status validasi otomatis langsung dibuat menjadi APPROVED (True)
    finalStatus = "APPROVED";
    reviewRemarks = `Verifikasi Otomatis AI (Skor: ${ocrResult.similarity_score}%, Zona Hijau Valid)`;
  } else if (
    existingReview.validationStatus === "APPROVED" ||
    existingReview.validationStatus === "REJECTED"
  ) {
    // Jika ulasan telah diputuskan secara manual sebelumnya dan bukan zona hijau
    finalStatus = existingReview.validationStatus;
    reviewRemarks = existingReview.reviewRemarks || reviewRemarks;
  }

  // 3. Update RatingReview record atomically in PostgreSQL with COMPLETED status
  try {
    await prisma.ratingReview.update({
      where: { id: reviewId },
      data: {
        ocrStatus: "COMPLETED",
        extractedOcrText: ocrResult.extracted_text,
        evidenceImageHash: ocrResult.phash,
        confidenceScore: ocrResult.similarity_score,
        isDuplicate: antiFraudResult.isDuplicate,
        duplicateOfId: antiFraudResult.duplicateOfId,
        validationStatus: finalStatus,
        verifiedAt: finalStatus === "APPROVED" ? (existingReview.verifiedAt || new Date()) : null,
        reviewRemarks,
      },
    });
  } catch (updateErr: any) {
    console.warn(`[OCR Worker] Failed to update review ${reviewId}:`, updateErr.message);
  }

  console.log(
    `[OCR Worker] Successfully processed review ${reviewId}: Zone ${ocrResult.zone}, Score ${ocrResult.similarity_score}%, Status: ${finalStatus}, Dup: ${antiFraudResult.isDuplicate}`
  );

  const jobDurationMs = Date.now() - jobStartTime;
  recordJobCompleted(queueName, jobDurationMs);

  return {
    success: true,
    ocrStatus: "COMPLETED",
    reviewId,
    score: ocrResult.similarity_score,
    zone: ocrResult.zone,
    status: finalStatus,
    isDuplicate: antiFraudResult.isDuplicate,
    duplicateOfId: antiFraudResult.duplicateOfId,
  };
}

export function createOcrWorker(queueName: string = OCR_QUEUE_NAME) {
  const worker = new Worker<OcrJobData>(
    queueName,
    async (job: Job<OcrJobData>) => {
      return await processOcrJob(job, queueName);
    },
    {
      connection: redis,
      concurrency: 4,
    }
  );

  worker.on("failed", (job, err) => {
    recordJobFailed(queueName);
    console.error(`[OCR Worker] Job ${job?.id} failed with error:`, err);
  });

  worker.on("error", (err) => {
    console.error(`[OCR Worker] BullMQ worker internal error:`, err);
  });

  return worker;
}

if (require.main === module) {
  console.log("🚀 Starting standalone GORO S2JB OCR Worker...");
  const worker = createOcrWorker();

  process.on("uncaughtException", (err) => {
    console.error("[OCR Worker] Uncaught Exception:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[OCR Worker] Unhandled Rejection:", reason);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down OCR Worker...");
    await worker.close();
    process.exit(0);
  });
}
