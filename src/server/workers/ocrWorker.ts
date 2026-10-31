import { Worker, Job } from "bullmq";
import redis from "@/lib/redis";
import prisma from "@/lib/prisma";
import { OCR_QUEUE_NAME, OcrJobData } from "../queues/ocrQueue";
import { executeOcrBridge } from "../services/ocrBridge";
import { checkImageDuplicate } from "../services/antiFraudService";
import { downloadEvidenceImage, isExternalUrl } from "../services/evidenceDownloader";
import path from "path";
import { BASE_UPLOAD_DIR } from "@/lib/storage";

export function createOcrWorker(queueName: string = OCR_QUEUE_NAME) {
  const worker = new Worker<OcrJobData>(
    queueName,
    async (job: Job<OcrJobData>) => {
      console.log(`[OCR Worker] Processing job ${job.id} for reviewId: ${job.data.reviewId}`);
      const { reviewId, evidenceImagePath, expectedReviewerName } = job.data;

      // Check if review record still exists in DB
      const existingReview = await prisma.ratingReview.findUnique({
        where: { id: reviewId },
        select: { id: true, validationStatus: true, reviewRemarks: true, entryDate: true },
      });

      if (!existingReview) {
        console.warn(`[OCR Worker] Review ${reviewId} not found in database. Skipping job.`);
        return { success: false, error: "Review record not found in database" };
      }

      let absolutePath = "";
      if (isExternalUrl(evidenceImagePath)) {
        // Track state: Streaming/downloading evidence from external URL (e.g. Google Drive)
        await prisma.ratingReview.update({
          where: { id: reviewId },
          data: { ocrStatus: "DOWNLOADING" },
        }).catch(() => {});

        const dlResult = await downloadEvidenceImage(
          evidenceImagePath,
          existingReview.entryDate || new Date()
        );
        if (!dlResult.success || !dlResult.absolutePath) {
          console.error(`[OCR Worker] Failed OCR image fetch for reviewId: ${reviewId}`, dlResult.error);
          await prisma.ratingReview.update({
            where: { id: reviewId },
            data: {
              ocrStatus: "FAILED",
              validationStatus: "NEEDS_REVIEW",
              reviewRemarks: `OCR Gagal: Tautan gambar tidak dapat diakses (${dlResult.error || "Gagal unduh"})`,
            },
          }).catch(() => {});
          return { success: false, error: dlResult.error };
        }
        absolutePath = dlResult.absolutePath;
        if (dlResult.relativePath) {
          await prisma.ratingReview.update({
            where: { id: reviewId },
            data: { evidenceImagePath: dlResult.relativePath },
          }).catch(() => {});
        }
      } else {
        absolutePath = path.isAbsolute(evidenceImagePath)
          ? evidenceImagePath
          : path.join(BASE_UPLOAD_DIR, evidenceImagePath);
      }

      // Track state: Processing OCR extraction and fuzzy validation
      await prisma.ratingReview.update({
        where: { id: reviewId },
        data: { ocrStatus: "PROCESSING" },
      }).catch(() => {});

      // 1. Execute OCR and Fuzzy Matching through bridge
      const ocrResult = await executeOcrBridge(absolutePath, expectedReviewerName);

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

      // 2. Anti-Fraud Perceptual Hashing Check (Hamming Distance <= 5)
      const antiFraudResult = await checkImageDuplicate(reviewId, ocrResult.phash, 5);

      let finalStatus = ocrResult.recommended_status;
      let reviewRemarks = `Verifikasi Otomatis AI (Skor: ${ocrResult.similarity_score}%, Zona: ${ocrResult.zone})`;

      // If review was previously APPROVED (e.g. legacy verified supervisor data), retain APPROVED unless fraud detected
      if (existingReview.validationStatus === "APPROVED" && !antiFraudResult.isDuplicate) {
        finalStatus = "APPROVED";
        reviewRemarks = existingReview.reviewRemarks || reviewRemarks;
      }

      if (antiFraudResult.isDuplicate) {
        finalStatus = "REJECTED";
        reviewRemarks = `Terindikasi duplikasi visual dengan ID: ${antiFraudResult.duplicateOfId} (Hamming Distance: ${antiFraudResult.minDistance})`;
        console.warn(
          `[OCR Worker] Fraud Duplicate Detected! Review ${reviewId} matches ${antiFraudResult.duplicateOfId} (Distance: ${antiFraudResult.minDistance})`
        );
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
            reviewRemarks,
          },
        });
      } catch (updateErr: any) {
        console.warn(`[OCR Worker] Failed to update review ${reviewId}:`, updateErr.message);
      }

      console.log(
        `[OCR Worker] Successfully processed review ${reviewId}: Zone ${ocrResult.zone}, Score ${ocrResult.similarity_score}%, Status: ${finalStatus}, Dup: ${antiFraudResult.isDuplicate}`
      );

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
    },
    {
      connection: redis,
      concurrency: 4,
    }
  );

  worker.on("failed", (job, err) => {
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
