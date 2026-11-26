import { Worker, Job } from "bullmq";
import redis from "@/lib/redis";
import { OCR_QUEUE_NAME, OcrJobData } from "../queues/ocrQueue";
import { verifyEvidence } from "../services/evidenceVerification";
import { recordJobCompleted, recordJobFailed } from "../queues/queueTelemetry";

export async function processOcrJob(job: Job<OcrJobData>, queueName: string = OCR_QUEUE_NAME) {
  const jobStartTime = Date.now();
  console.log(`[OCR Worker] Processing job ${job.id} for reviewId: ${job.data.reviewId}`);

  const maxAttempts = typeof job.opts?.attempts === "number" ? job.opts.attempts : 1;
  const attemptsMade = typeof job.attemptsMade === "number" ? job.attemptsMade : 0;
  const isFinalAttempt = attemptsMade + 1 >= maxAttempts;

  const result = await verifyEvidence({
    reviewId: job.data.reviewId,
    evidenceImagePath: job.data.evidenceImagePath,
    expectedReviewerName: job.data.expectedReviewerName,
    isFinalAttempt,
  });

  if (!result.success) {
    if (!result.skipped && !result.permanentFailure) {
      throw new Error(result.error || "Verifikasi Eviden gagal diproses");
    }
    if (result.permanentFailure && !result.skipped) {
      recordJobFailed(queueName);
    }
    return result;
  }

  console.log(
    `[OCR Worker] Successfully processed review ${result.reviewId}: Zone ${result.zone}, Score ${result.score}%, Status: ${result.status}, Dup: ${result.isDuplicate}`
  );

  const jobDurationMs = Date.now() - jobStartTime;
  recordJobCompleted(queueName, jobDurationMs);

  return result;
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
