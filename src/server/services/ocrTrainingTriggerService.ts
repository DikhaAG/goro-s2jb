import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { ocrTrainingQueue, OcrTrainingJobData } from "../queues/ocrTrainingQueue";
import {
  REDIS_TRAINING_ACTIVE_KEY,
  REDIS_TRAINING_LAST_RUN_KEY,
  REDIS_TRAINING_CANCEL_PREFIX,
} from "../workers/ocrTrainingWorker";
import {
  OcrSampleInclusion,
  OcrTrainingJobStatus,
  PrismaClient,
} from "@prisma/client";

export const MIN_SAMPLES_THRESHOLD = 100;
export const COOLDOWN_HOURS = 6;
export const NIGHTLY_MIN_SAMPLES = 25;

export interface TriggerStatus {
  isTrainingActive: boolean;
  activeJobData: any | null;
  totalApprovedSamples: number;
  lastModelSamplesCount: number;
  newSamplesCount: number;
  threshold: number;
  canAutoTrain: boolean;
  isCooldownActive: boolean;
  cooldownRemainingSeconds: number;
  lastTrainedAt: Date | null;
}

/**
 * Computes trigger eligibility, active training status, and cooldown metrics.
 */
export async function getTriggerStatus(
  db: PrismaClient | any = prisma,
  redisClient: any = redis
): Promise<TriggerStatus> {
  // 1. Check if any training is currently running in Redis
  const activeJobRaw = await redisClient.get(REDIS_TRAINING_ACTIVE_KEY);
  const activeJobData = activeJobRaw ? JSON.parse(activeJobRaw) : null;
  const isTrainingActive = !!activeJobData;

  // 2. Check last completed training timestamp
  let lastTrainedTimestamp: number | null = null;
  const redisTimestamp = await redisClient.get(REDIS_TRAINING_LAST_RUN_KEY);
  if (redisTimestamp) {
    lastTrainedTimestamp = parseInt(redisTimestamp, 10);
  } else {
    const lastJob = await db.ocrTrainingJob.findFirst({
      where: { status: OcrTrainingJobStatus.COMPLETED },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    if (lastJob?.completedAt) {
      lastTrainedTimestamp = new Date(lastJob.completedAt).getTime();
    }
  }

  // 3. Compute Cooldown
  const now = Date.now();
  const cooldownMs = COOLDOWN_HOURS * 3600 * 1000;
  let isCooldownActive = false;
  let cooldownRemainingSeconds = 0;

  if (lastTrainedTimestamp) {
    const elapsed = now - lastTrainedTimestamp;
    if (elapsed < cooldownMs) {
      isCooldownActive = true;
      cooldownRemainingSeconds = Math.round((cooldownMs - elapsed) / 1000);
    }
  }

  // 4. Compute New Approved Samples vs Last Trained Model
  const [totalApprovedSamples, latestModel] = await Promise.all([
    db.ocrTrainingSample.count({
      where: { inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN },
    }),
    db.ocrModelRegistry.findFirst({
      orderBy: { createdAt: "desc" },
      select: { trainingSamplesCount: true, createdAt: true },
    }),
  ]);

  const lastModelSamplesCount = latestModel?.trainingSamplesCount || 0;
  const newSamplesCount = Math.max(0, totalApprovedSamples - lastModelSamplesCount);

  const canAutoTrain =
    !isTrainingActive &&
    !isCooldownActive &&
    newSamplesCount >= MIN_SAMPLES_THRESHOLD;

  return {
    isTrainingActive,
    activeJobData,
    totalApprovedSamples,
    lastModelSamplesCount,
    newSamplesCount,
    threshold: MIN_SAMPLES_THRESHOLD,
    canAutoTrain,
    isCooldownActive,
    cooldownRemainingSeconds,
    lastTrainedAt: lastTrainedTimestamp ? new Date(lastTrainedTimestamp) : null,
  };
}

/**
 * Automatic threshold-based trigger:
 * Triggered automatically when new samples exceed MIN_SAMPLES_THRESHOLD (>= 100)
 * and cooldown period (6 hours) is satisfied.
 */
export async function checkAndTriggerThresholdTraining(
  actorId?: string,
  db: PrismaClient | any = prisma,
  redisClient: any = redis,
  queue: any = ocrTrainingQueue
) {
  const status = await getTriggerStatus(db, redisClient);

  if (status.isTrainingActive) {
    return { triggered: false, reason: "ALREADY_ACTIVE" };
  }

  if (status.isCooldownActive) {
    return {
      triggered: false,
      reason: "COOLDOWN_ACTIVE",
      remainingSeconds: status.cooldownRemainingSeconds,
    };
  }

  if (status.newSamplesCount < MIN_SAMPLES_THRESHOLD) {
    return {
      triggered: false,
      reason: "BELOW_THRESHOLD",
      newSamplesCount: status.newSamplesCount,
      threshold: MIN_SAMPLES_THRESHOLD,
    };
  }

  const targetVersion = `v1.${Date.now().toString().slice(-4)}.0`;

  const job = await db.ocrTrainingJob.create({
    data: {
      status: OcrTrainingJobStatus.PENDING,
      triggerType: "THRESHOLD",
      modelTargetVersion: targetVersion,
      datasetSize: status.totalApprovedSamples,
      totalEpochs: 10,
      createdById: actorId || null,
    },
  });

  const jobPayload: OcrTrainingJobData = {
    jobId: job.id,
    targetVersion,
    triggerType: "THRESHOLD",
    epochs: 10,
    batchSize: 8,
    learningRate: 0.001,
    actorId,
  };

  await queue.add("run-training", jobPayload);

  return {
    triggered: true,
    reason: "THRESHOLD_MET",
    jobId: job.id,
    targetVersion,
    newSamplesCount: status.newSamplesCount,
  };
}

/**
 * Automatic nightly cron trigger:
 * Evaluates dataset during off-peak night hours (02:00 WIB) with lower threshold (>= 25).
 */
export async function checkAndTriggerNightlyCron(
  actorId?: string,
  db: PrismaClient | any = prisma,
  redisClient: any = redis,
  queue: any = ocrTrainingQueue
) {
  const status = await getTriggerStatus(db, redisClient);

  if (status.isTrainingActive) {
    return { triggered: false, reason: "ALREADY_ACTIVE" };
  }

  if (status.isCooldownActive) {
    return {
      triggered: false,
      reason: "COOLDOWN_ACTIVE",
      remainingSeconds: status.cooldownRemainingSeconds,
    };
  }

  if (status.newSamplesCount < NIGHTLY_MIN_SAMPLES) {
    return {
      triggered: false,
      reason: "BELOW_NIGHTLY_THRESHOLD",
      newSamplesCount: status.newSamplesCount,
      threshold: NIGHTLY_MIN_SAMPLES,
    };
  }

  const targetVersion = `v1.${Date.now().toString().slice(-4)}.0`;

  const job = await db.ocrTrainingJob.create({
    data: {
      status: OcrTrainingJobStatus.PENDING,
      triggerType: "SCHEDULED_CRON",
      modelTargetVersion: targetVersion,
      datasetSize: status.totalApprovedSamples,
      totalEpochs: 15, // deeper training during off-peak night
      createdById: actorId || null,
    },
  });

  const jobPayload: OcrTrainingJobData = {
    jobId: job.id,
    targetVersion,
    triggerType: "SCHEDULED_CRON",
    epochs: 15,
    batchSize: 8,
    learningRate: 0.0008,
    actorId,
  };

  await queue.add("run-training", jobPayload);

  return {
    triggered: true,
    reason: "NIGHTLY_CRON_MET",
    jobId: job.id,
    targetVersion,
    newSamplesCount: status.newSamplesCount,
  };
}

/**
 * Enqueues a manual training job directly to BullMQ, bypassing cooldown.
 */
export async function enqueueManualTraining(
  options: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
    targetVersion?: string;
  } = {},
  actorId?: string,
  db: PrismaClient | any = prisma,
  redisClient: any = redis,
  queue: any = ocrTrainingQueue
) {
  const activeJobRaw = await redisClient.get(REDIS_TRAINING_ACTIVE_KEY);
  if (activeJobRaw) {
    throw new Error(
      "Sedang ada proses training model OCR yang aktif berjalan. Mohon tunggu hingga selesai."
    );
  }

  const epochs = options.epochs || 5;
  const batchSize = options.batchSize || 8;
  const learningRate = options.learningRate || 0.001;
  const targetVersion =
    options.targetVersion || `v1.${Date.now().toString().slice(-4)}.0`;

  const totalSamples = await db.ocrTrainingSample.count({
    where: { inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN },
  });

  if (totalSamples === 0) {
    throw new Error("Tidak ada sampel data latih yang disetujui untuk ditraining.");
  }

  const job = await db.ocrTrainingJob.create({
    data: {
      status: OcrTrainingJobStatus.PENDING,
      triggerType: "MANUAL",
      modelTargetVersion: targetVersion,
      datasetSize: totalSamples,
      totalEpochs: epochs,
      createdById: actorId || null,
    },
  });

  const jobPayload: OcrTrainingJobData = {
    jobId: job.id,
    targetVersion,
    triggerType: "MANUAL",
    epochs,
    batchSize,
    learningRate,
    actorId,
  };

  await queue.add("run-training", jobPayload);

  return {
    success: true,
    jobId: job.id,
    targetVersion,
    datasetSize: totalSamples,
  };
}

/**
 * Cancels a running training job.
 */
export async function cancelTrainingJob(
  jobId: string,
  reason: string,
  actorId?: string,
  db: PrismaClient | any = prisma,
  redisClient: any = redis
) {
  await redisClient.set(`${REDIS_TRAINING_CANCEL_PREFIX}${jobId}`, "1", "EX", 3600);
  await redisClient.del(REDIS_TRAINING_ACTIVE_KEY);

  return db.ocrTrainingJob.update({
    where: { id: jobId },
    data: {
      status: OcrTrainingJobStatus.CANCELLED,
      errorMessage: `Dibatalkan oleh operator: ${reason}`,
      completedAt: new Date(),
    },
  });
}

