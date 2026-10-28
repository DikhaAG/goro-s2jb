import { Worker, Job } from "bullmq";
import redis from "@/lib/redis";
import prisma from "@/lib/prisma";
import { OCR_QUEUE_NAME, OcrJobData } from "../queues/ocrQueue";
import { executeOcrBridge } from "../services/ocrBridge";
import { checkImageDuplicate } from "../services/antiFraudService";
import path from "path";
import { BASE_UPLOAD_DIR } from "@/lib/storage";

export function createOcrWorker(queueName: string = OCR_QUEUE_NAME) {
  const worker = new Worker<OcrJobData>(
    queueName,
    async (job: Job<OcrJobData>) => {
      console.log(`[OCR Worker] Processing job ${job.id} for reviewId: ${job.data.reviewId}`);
      const { reviewId, evidenceImagePath, expectedReviewerName } = job.data;

      const absolutePath = path.isAbsolute(evidenceImagePath)
        ? evidenceImagePath
        : path.join(BASE_UPLOAD_DIR, evidenceImagePath);

      // 1. Execute OCR and Fuzzy Matching through bridge
      const ocrResult = await executeOcrBridge(absolutePath, expectedReviewerName);

      if (!ocrResult.success) {
        console.error(`[OCR Worker] Failed OCR for reviewId: ${reviewId}`, ocrResult.error);
        await prisma.ratingReview.update({
          where: { id: reviewId },
          data: {
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

      if (antiFraudResult.isDuplicate) {
        finalStatus = "REJECTED";
        reviewRemarks = `Terindikasi duplikasi visual dengan ID: ${antiFraudResult.duplicateOfId} (Hamming Distance: ${antiFraudResult.minDistance})`;
        console.warn(
          `[OCR Worker] Fraud Duplicate Detected! Review ${reviewId} matches ${antiFraudResult.duplicateOfId} (Distance: ${antiFraudResult.minDistance})`
        );
      }

      // 3. Update RatingReview record atomically in PostgreSQL
      const updated = await prisma.ratingReview.update({
        where: { id: reviewId },
        data: {
          extractedOcrText: ocrResult.extracted_text,
          evidenceImageHash: ocrResult.phash,
          confidenceScore: ocrResult.similarity_score,
          isDuplicate: antiFraudResult.isDuplicate,
          duplicateOfId: antiFraudResult.duplicateOfId,
          validationStatus: finalStatus,
          reviewRemarks,
        },
      });

      console.log(
        `[OCR Worker] Successfully processed review ${reviewId}: Zone ${ocrResult.zone}, Score ${ocrResult.similarity_score}%, Status: ${finalStatus}, Dup: ${antiFraudResult.isDuplicate}`
      );

      return {
        success: true,
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
      concurrency: 2,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[OCR Worker] Job ${job?.id} failed with error:`, err);
  });

  return worker;
}

if (require.main === module) {
  console.log("🚀 Starting standalone GORO S2JB OCR Worker...");
  const worker = createOcrWorker();

  process.on("SIGINT", async () => {
    console.log("Shutting down OCR Worker...");
    await worker.close();
    process.exit(0);
  });
}
