import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { OcrModelStatus, PrismaClient, Prisma } from "@prisma/client";

export const REDIS_ACTIVE_MODEL_KEY = "ocr:model:active";
export const REDIS_ACTIVE_MODEL_PATH_KEY = "ocr:model:active_path";
export const REDIS_ACTIVE_MODEL_VERSION_KEY = "ocr:model:active_version";

export interface ListModelsOptions {
  status?: OcrModelStatus;
  page?: number;
  pageSize?: number;
}

export interface ModelComparisonResult {
  modelA: any;
  modelB: any;
  delta: {
    cer: number;
    wer: number;
    accuracy: number;
    samples: number;
  };
  isModelBImprovement: boolean;
  verdict: "MODEL_B_BETTER" | "MODEL_A_BETTER" | "SIMILAR";
}

/**
 * Returns the currently active OCR model, querying Redis cache first with database fallback.
 */
export async function getActiveModel(
  db: PrismaClient | any = prisma,
  redisClient: any = redis
) {
  if (redisClient?.get) {
    try {
      const cached = await redisClient.get(REDIS_ACTIVE_MODEL_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Fallback silently to DB
    }
  }

  const activeModel = await db.ocrModelRegistry.findFirst({
    where: { status: OcrModelStatus.ACTIVE },
    include: {
      trainedBy: { select: { id: true, name: true, role: true } },
      activatedBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: { activatedAt: "desc" },
  });

  if (activeModel && redisClient?.set) {
    try {
      await redisClient.set(REDIS_ACTIVE_MODEL_KEY, JSON.stringify(activeModel));
      await redisClient.set(REDIS_ACTIVE_MODEL_PATH_KEY, activeModel.artifactPath);
      await redisClient.set(REDIS_ACTIVE_MODEL_VERSION_KEY, activeModel.version);
    } catch {
      // Non-fatal cache failure
    }
  }

  return activeModel;
}

/**
 * Returns the filesystem artifact path of the currently active OCR model.
 */
export async function getActiveModelPath(
  db: PrismaClient | any = prisma,
  redisClient: any = redis
): Promise<string | null> {
  if (redisClient?.get) {
    try {
      const cachedPath = await redisClient.get(REDIS_ACTIVE_MODEL_PATH_KEY);
      if (cachedPath) return cachedPath;
    } catch {
      // Fallback to database lookup
    }
  }

  const activeModel = await getActiveModel(db, redisClient);
  return activeModel?.artifactPath || null;
}

/**
 * Lists models registered in the OCR model catalog with pagination and optional status filter.
 */
export async function listModels(
  options: ListModelsOptions = {},
  db: PrismaClient | any = prisma
) {
  const page = Math.max(options.page || 1, 1);
  const pageSize = Math.min(Math.max(options.pageSize || 10, 1), 50);
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (options.status) {
    where.status = options.status;
  }

  const [items, totalCount] = await Promise.all([
    db.ocrModelRegistry.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        trainedBy: { select: { id: true, name: true, role: true } },
        activatedBy: { select: { id: true, name: true, role: true } },
        _count: { select: { trainingJobs: true } },
      },
    }),
    db.ocrModelRegistry.count({ where }),
  ]);

  return {
    items,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    page,
    pageSize,
  };
}

/**
 * Fetches single model registry details by ID.
 */
export async function getModelById(
  modelId: string,
  db: PrismaClient | any = prisma
) {
  const model = await db.ocrModelRegistry.findUnique({
    where: { id: modelId },
    include: {
      trainedBy: { select: { id: true, name: true, role: true } },
      activatedBy: { select: { id: true, name: true, role: true } },
      trainingJobs: {
        take: 5,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!model) {
    throw new Error(`Model OCR dengan ID "${modelId}" tidak ditemukan.`);
  }

  return model;
}

/**
 * Promotes a STAGING or ARCHIVED model to ACTIVE status (Hot-Reload).
 * Automatically archives previous active models and synchronizes Redis cache keys.
 */
export async function activateModel(
  modelId: string,
  actorId: string,
  db: PrismaClient | any = prisma,
  redisClient: any = redis
) {
  const targetModel = await db.ocrModelRegistry.findUnique({
    where: { id: modelId },
  });

  if (!targetModel) {
    throw new Error(`Model OCR dengan ID "${modelId}" tidak ditemukan.`);
  }

  if (targetModel.status === OcrModelStatus.ACTIVE) {
    return {
      success: true,
      alreadyActive: true,
      model: targetModel,
    };
  }

  // Atomically archive current active models and activate the selected model
  const updatedModel = await db.$transaction(async (tx: any) => {
    // 1. Archive previous active model(s)
    await tx.ocrModelRegistry.updateMany({
      where: { status: OcrModelStatus.ACTIVE },
      data: { status: OcrModelStatus.ARCHIVED },
    });

    // 2. Activate target model
    return tx.ocrModelRegistry.update({
      where: { id: modelId },
      data: {
        status: OcrModelStatus.ACTIVE,
        activatedById: actorId,
        activatedAt: new Date(),
      },
      include: {
        trainedBy: { select: { id: true, name: true, role: true } },
        activatedBy: { select: { id: true, name: true, role: true } },
      },
    });
  });

  // Synchronize Redis cache for zero-downtime hot-reload
  if (redisClient?.set) {
    try {
      await redisClient.set(REDIS_ACTIVE_MODEL_KEY, JSON.stringify(updatedModel));
      await redisClient.set(REDIS_ACTIVE_MODEL_PATH_KEY, updatedModel.artifactPath);
      await redisClient.set(REDIS_ACTIVE_MODEL_VERSION_KEY, updatedModel.version);
    } catch {
      // Non-fatal Redis write error
    }
  }

  return {
    success: true,
    alreadyActive: false,
    model: updatedModel,
  };
}

/**
 * Safely rolls back to a previous model checkpoint.
 * Archives current active model and reinstates the target version immediately.
 */
export async function rollbackModel(
  options: {
    targetModelId: string;
    reason: string;
  },
  actorId: string,
  db: PrismaClient | any = prisma,
  redisClient: any = redis
) {
  const targetModel = await db.ocrModelRegistry.findUnique({
    where: { id: options.targetModelId },
  });

  if (!targetModel) {
    throw new Error(`Model target rollback "${options.targetModelId}" tidak ditemukan.`);
  }

  if (targetModel.status === OcrModelStatus.ACTIVE) {
    throw new Error("Model target saat ini sudah berstatus aktif.");
  }

  const currentActive = await db.ocrModelRegistry.findFirst({
    where: { status: OcrModelStatus.ACTIVE },
  });

  const rolledBackModel = await db.$transaction(async (tx: any) => {
    // 1. Archive currently active model with rollback metadata
    if (currentActive) {
      const existingMeta = (currentActive.metadata as Record<string, any>) || {};
      await tx.ocrModelRegistry.update({
        where: { id: currentActive.id },
        data: {
          status: OcrModelStatus.ARCHIVED,
          metadata: {
            ...existingMeta,
            rolledBackToVersion: targetModel.version,
            rollbackReason: options.reason,
            rolledBackAt: new Date().toISOString(),
            rolledBackById: actorId,
          } as Prisma.InputJsonValue,
        },
      });
    }

    // Ensure any other stale active models are cleanly archived
    await tx.ocrModelRegistry.updateMany({
      where: {
        status: OcrModelStatus.ACTIVE,
        id: { not: options.targetModelId },
      },
      data: { status: OcrModelStatus.ARCHIVED },
    });

    // 2. Set target model to ACTIVE
    return tx.ocrModelRegistry.update({
      where: { id: options.targetModelId },
      data: {
        status: OcrModelStatus.ACTIVE,
        activatedById: actorId,
        activatedAt: new Date(),
      },
      include: {
        trainedBy: { select: { id: true, name: true, role: true } },
        activatedBy: { select: { id: true, name: true, role: true } },
      },
    });
  });

  // Synchronize Redis cache
  if (redisClient?.set) {
    try {
      await redisClient.set(REDIS_ACTIVE_MODEL_KEY, JSON.stringify(rolledBackModel));
      await redisClient.set(REDIS_ACTIVE_MODEL_PATH_KEY, rolledBackModel.artifactPath);
      await redisClient.set(REDIS_ACTIVE_MODEL_VERSION_KEY, rolledBackModel.version);
    } catch {
      // Non-fatal Redis write error
    }
  }

  return {
    success: true,
    previousModel: currentActive,
    activeModel: rolledBackModel,
  };
}

/**
 * Rejects a staging model that did not meet objective accuracy requirements.
 */
export async function rejectModel(
  modelId: string,
  reason: string,
  actorId: string,
  db: PrismaClient | any = prisma
) {
  const model = await db.ocrModelRegistry.findUnique({
    where: { id: modelId },
  });

  if (!model) {
    throw new Error(`Model OCR dengan ID "${modelId}" tidak ditemukan.`);
  }

  if (model.status === OcrModelStatus.ACTIVE) {
    throw new Error(
      "Tidak dapat menolak model yang sedang aktif di produksi. Lakukan rollback terlebih dahulu."
    );
  }

  const existingMeta = (model.metadata as Record<string, any>) || {};
  const updated = await db.ocrModelRegistry.update({
    where: { id: modelId },
    data: {
      status: OcrModelStatus.REJECTED,
      metadata: {
        ...existingMeta,
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
        rejectedById: actorId,
      } as Prisma.InputJsonValue,
    },
  });

  return {
    success: true,
    model: updated,
  };
}

/**
 * Compares two models side-by-side on CER, WER, and Accuracy scores.
 */
export async function compareModels(
  modelAId: string,
  modelBId: string,
  db: PrismaClient | any = prisma
): Promise<ModelComparisonResult> {
  const [modelA, modelB] = await Promise.all([
    getModelById(modelAId, db),
    getModelById(modelBId, db),
  ]);

  const cerA = modelA.cerScore ?? 100;
  const cerB = modelB.cerScore ?? 100;
  const werA = modelA.werScore ?? 100;
  const werB = modelB.werScore ?? 100;
  const accA = modelA.accuracyScore ?? 0;
  const accB = modelB.accuracyScore ?? 0;

  const delta = {
    cer: Math.round((cerB - cerA) * 100) / 100, // Negative is better
    wer: Math.round((werB - werA) * 100) / 100, // Negative is better
    accuracy: Math.round((accB - accA) * 100) / 100, // Positive is better
    samples: modelB.trainingSamplesCount - modelA.trainingSamplesCount,
  };

  const isModelBImprovement = delta.accuracy > 0 || (delta.cer < 0 && delta.accuracy >= 0);

  let verdict: "MODEL_B_BETTER" | "MODEL_A_BETTER" | "SIMILAR" = "SIMILAR";
  if (delta.accuracy > 0.5 || delta.cer < -0.5) {
    verdict = "MODEL_B_BETTER";
  } else if (delta.accuracy < -0.5 || delta.cer > 0.5) {
    verdict = "MODEL_A_BETTER";
  }

  return {
    modelA,
    modelB,
    delta,
    isModelBImprovement,
    verdict,
  };
}

