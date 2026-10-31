import { Worker, Job } from "bullmq";
import redis from "@/lib/redis";
import prisma from "@/lib/prisma";
import { OCR_TRAINING_QUEUE_NAME, OcrTrainingJobData } from "../queues/ocrTrainingQueue";
import { runOcrTrainingPipeline } from "../services/ocrTrainerService";

export const REDIS_TRAINING_ACTIVE_KEY = "ocr:training:active";
export const REDIS_TRAINING_LAST_RUN_KEY = "ocr:training:last_run_timestamp";
export const REDIS_TRAINING_CANCEL_PREFIX = "ocr:training:cancel:";

export function createOcrTrainingWorker(queueName: string = OCR_TRAINING_QUEUE_NAME) {
  const worker = new Worker<OcrTrainingJobData>(
    queueName,
    async (job: Job<OcrTrainingJobData>) => {
      const {
        jobId,
        targetVersion,
        epochs,
        batchSize,
        learningRate,
        triggerType,
        actorId,
      } = job.data;

      console.log(
        `[OCR Training Worker] Starting training job ${job.id} (target: ${targetVersion}, trigger: ${triggerType})`
      );

      // Set initial Redis active status
      await redis.set(
        REDIS_TRAINING_ACTIVE_KEY,
        JSON.stringify({
          jobId,
          targetVersion,
          status: "RUNNING",
          progressPercent: 0,
          currentEpoch: 0,
          totalEpochs: epochs,
          loss: null,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        "EX",
        7200 // 2 hours TTL safety
      );

      try {
        const result = await runOcrTrainingPipeline(
          {
            epochs,
            batchSize,
            learningRate,
            targetVersion,
            triggerType,
            actorId,
            onProgress: async (p) => {
              const progressPercent = Math.round((p.epoch / p.totalEpochs) * 100);
              await redis.set(
                REDIS_TRAINING_ACTIVE_KEY,
                JSON.stringify({
                  jobId,
                  targetVersion,
                  status: "RUNNING",
                  progressPercent,
                  currentEpoch: p.epoch,
                  totalEpochs: p.totalEpochs,
                  loss: p.loss,
                  elapsedSeconds: p.elapsedSeconds,
                  updatedAt: new Date().toISOString(),
                }),
                "EX",
                7200
              );
            },
          },
          prisma
        );

        // Record last successful training timestamp
        await redis.set(REDIS_TRAINING_LAST_RUN_KEY, Date.now().toString());
        await redis.del(REDIS_TRAINING_ACTIVE_KEY);

        console.log(`[OCR Training Worker] Successfully completed training job ${jobId}`);
        return result;
      } catch (err: any) {
        console.error(`[OCR Training Worker] Training job ${jobId} failed:`, err);
        await redis.del(REDIS_TRAINING_ACTIVE_KEY);
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 1, // Only 1 training job at a time to prevent hardware resource saturation
    }
  );

  return worker;
}

