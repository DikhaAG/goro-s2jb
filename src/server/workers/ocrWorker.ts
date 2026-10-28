import { Worker, Job } from "bullmq";
import redis from "@/lib/redis";
import prisma from "@/lib/prisma";
import { OCR_QUEUE_NAME, OcrJobData } from "../queues/ocrQueue";
import { processEvidenceOcr } from "../services/ocrService";
import path from "path";
import { BASE_UPLOAD_DIR } from "@/lib/storage";

export function createOcrWorker() {
  const worker = new Worker<OcrJobData>(
    OCR_QUEUE_NAME,
    async (job: Job<OcrJobData>) => {
      console.log(`[OCR Worker] Processing job ${job.id} for reviewId: ${job.data.reviewId}`);
      const { reviewId, evidenceImagePath, expectedReviewerName } = job.data;

      const absolutePath = path.isAbsolute(evidenceImagePath)
        ? evidenceImagePath
        : path.join(BASE_UPLOAD_DIR, evidenceImagePath);

      const ocrResult = await processEvidenceOcr(absolutePath, expectedReviewerName);

      if (!ocrResult.success) {
        console.error(`[OCR Worker] Failed OCR for reviewId: ${reviewId}`, ocrResult.error);
        return { success: false, error: ocrResult.error };
      }

      // Check for image hash duplicate (pHash match)
      let isDuplicate = false;
      let duplicateOfId: string | null = null;

      if (ocrResult.phash) {
        const existingDuplicate = await prisma.ratingReview.findFirst({
          where: {
            evidenceImageHash: ocrResult.phash,
            id: { not: reviewId },
          },
          select: { id: true },
        });

        if (existingDuplicate) {
          isDuplicate = true;
          duplicateOfId = existingDuplicate.id;
          console.warn(
            `[OCR Worker] Duplicate image detected! Review ${reviewId} matches ${existingDuplicate.id}`
          );
        }
      }

      // Update review record
      await prisma.ratingReview.update({
        where: { id: reviewId },
        data: {
          extractedOcrText: ocrResult.extracted_text,
          evidenceImageHash: ocrResult.phash,
          confidenceScore: ocrResult.similarity_score,
          isDuplicate,
          duplicateOfId,
          validationStatus: isDuplicate ? "REJECTED" : ocrResult.recommended_status,
          reviewRemarks: isDuplicate
            ? `Terdeteksi duplikat gambar (pHash match dengan review ${duplicateOfId})`
            : `Hasil otomatis OCR & Fuzzy Match (Skor: ${ocrResult.similarity_score}%)`,
        },
      });

      console.log(
        `[OCR Worker] Successfully processed review ${reviewId}: Zone ${ocrResult.zone}, Score ${ocrResult.similarity_score}%, Status: ${ocrResult.recommended_status}`
      );

      return {
        success: true,
        reviewId,
        score: ocrResult.similarity_score,
        zone: ocrResult.zone,
        isDuplicate,
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

// If run directly via node / tsx
if (require.main === module) {
  console.log("🚀 Starting standalone GORO S2JB OCR Worker...");
  const worker = createOcrWorker();

  process.on("SIGINT", async () => {
    console.log("Shutting down OCR Worker...");
    await worker.close();
    process.exit(0);
  });
}
