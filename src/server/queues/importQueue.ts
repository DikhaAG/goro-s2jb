import { Queue } from "bullmq";
import redis from "@/lib/redis";

export interface ImportJobData {
  importBatchId: string;
  filePath: string;
  userId: string;
  startRowNumber?: number;
}

export const IMPORT_QUEUE_NAME = "import-processing-queue";

export const importQueue = new Queue<ImportJobData>(IMPORT_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});
