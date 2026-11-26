import { Worker, Job } from "bullmq";
import redis from "@/lib/redis";
import { IMPORT_QUEUE_NAME, ImportJobData } from "../queues/importQueue";
import { migrationBatch } from "../services/migrationBatch";

export function createImportWorker() {
  const worker = new Worker<ImportJobData>(
    IMPORT_QUEUE_NAME,
    async (job: Job<ImportJobData>) => {
      const { importBatchId, filePath, userId, startRowNumber } = job.data;
      console.log(
        `[Import Worker] Starting batch ${importBatchId} for file ${filePath} (startRow: ${startRowNumber || 0})`
      );

      return migrationBatch.ingest({
        importBatchId,
        filePath,
        userId,
        startRowNumber,
        onProgress: async (progress) => {
          await job.updateProgress(progress);
        },
      });
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Import Worker] Job ${job?.id} failed with error:`, err);
  });

  worker.on("error", (err) => {
    console.error(`[Import Worker] BullMQ worker internal error:`, err);
  });

  return worker;
}

if (require.main === module) {
  console.log("🚀 Starting standalone GORO S2JB Import Worker...");
  const worker = createImportWorker();

  process.on("uncaughtException", (err) => {
    console.error("[Import Worker] Uncaught Exception:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Import Worker] Unhandled Rejection:", reason);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down Import Worker...");
    await worker.close();
    process.exit(0);
  });
}
