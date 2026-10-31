import { Queue } from "bullmq";
import redis from "@/lib/redis";

export interface OcrTrainingJobData {
  jobId: string;
  targetVersion: string;
  triggerType: "MANUAL" | "THRESHOLD" | "SCHEDULED_CRON";
  epochs: number;
  batchSize: number;
  learningRate: number;
  actorId?: string;
}

export const OCR_TRAINING_QUEUE_NAME = "ocr-training-queue";

export const ocrTrainingQueue = new Queue<OcrTrainingJobData>(
  OCR_TRAINING_QUEUE_NAME,
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  }
);

