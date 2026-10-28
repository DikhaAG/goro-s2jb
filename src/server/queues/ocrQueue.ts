import { Queue } from "bullmq";
import redis from "@/lib/redis";

export interface OcrJobData {
  reviewId: string;
  evidenceImagePath: string;
  expectedReviewerName: string;
}

export const OCR_QUEUE_NAME = "ocr-processing-queue";

export const ocrQueue = new Queue<OcrJobData>(OCR_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
