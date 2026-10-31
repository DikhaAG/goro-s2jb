import prisma from "@/lib/prisma";
import {
  OcrSampleSource,
  OcrSampleInclusion,
  ValidationStatus,
  PrismaClient,
} from "@prisma/client";
import { checkAndTriggerThresholdTraining } from "./ocrTrainingTriggerService";

export interface HarvestOptions {
  source?: OcrSampleSource;
  actorId?: string;
  groundTruthOverride?: string;
}

export interface ColdStartOptions {
  batchSize?: number;
  actorId?: string;
}

export interface DatasetStats {
  totalSamples: number;
  approvedCount: number;
  pendingCount: number;
  excludedCount: number;
  bySource: Record<string, number>;
}

/**
 * Harvests a single approved review as a ground-truth training sample (Active Learning Hook).
 */
export async function harvestFromApprovedReview(
  reviewId: string,
  options: HarvestOptions = {},
  db: PrismaClient | any = prisma
) {
  const review = await db.ratingReview.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    return null;
  }

  // Only approved reviews with valid evidence image paths qualify as ground truth
  if (
    review.validationStatus !== ValidationStatus.APPROVED ||
    !review.evidenceImagePath ||
    review.evidenceImagePath.trim() === ""
  ) {
    return null;
  }

  // Idempotency: check if this review has already been harvested
  const existingSample = await db.ocrTrainingSample.findFirst({
    where: { reviewId: review.id },
  });

  if (existingSample) {
    return existingSample;
  }

  const groundTruthText =
    options.groundTruthOverride?.trim() ||
    review.playstoreReviewerName.trim();

  const sample = await db.ocrTrainingSample.create({
    data: {
      reviewId: review.id,
      imagePath: review.evidenceImagePath,
      imageHash: review.evidenceImageHash,
      groundTruthText,
      reviewerName: review.playstoreReviewerName,
      rawOcrText: review.extractedOcrText,
      confidenceScore: review.confidenceScore,
      source: options.source || OcrSampleSource.TRIAGE_VALIDATION,
      inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
      verifiedById: options.actorId || review.verifiedById,
    },
  });

  // Fire-and-forget threshold trigger check (Dual-Trigger active learning)
  checkAndTriggerThresholdTraining(options.actorId, db).catch(() => {});

  return sample;
}

/**
 * Cold-Start harvester: Extracts historical spreadsheet rows that were already
 * checked/approved by operators during initial data migration.
 */
export async function coldStartHarvestFromHistoricalSpreadsheet(
  options: ColdStartOptions = {},
  db: PrismaClient | any = prisma
): Promise<{ totalFound: number; totalImported: number; skippedExisting: number }> {
  const batchSize = options.batchSize || 500;

  // Find reviews with APPROVED status and evidence images
  const approvedReviews = await db.ratingReview.findMany({
    where: {
      validationStatus: ValidationStatus.APPROVED,
      evidenceImagePath: { not: "" },
    },
    take: batchSize,
    select: {
      id: true,
      evidenceImagePath: true,
      evidenceImageHash: true,
      playstoreReviewerName: true,
      extractedOcrText: true,
      confidenceScore: true,
      verifiedById: true,
    },
  });

  let totalImported = 0;
  let skippedExisting = 0;

  for (const r of approvedReviews) {
    const existing = await db.ocrTrainingSample.findFirst({
      where: { reviewId: r.id },
    });

    if (existing) {
      skippedExisting++;
      continue;
    }

    await db.ocrTrainingSample.create({
      data: {
        reviewId: r.id,
        imagePath: r.evidenceImagePath,
        imageHash: r.evidenceImageHash,
        groundTruthText: r.playstoreReviewerName.trim(),
        reviewerName: r.playstoreReviewerName,
        rawOcrText: r.extractedOcrText,
        confidenceScore: r.confidenceScore,
        source: OcrSampleSource.IMPORT_SPREADSHEET,
        inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
        verifiedById: options.actorId || r.verifiedById,
      },
    });

    totalImported++;
  }

  return {
    totalFound: approvedReviews.length,
    totalImported,
    skippedExisting,
  };
}

/**
 * Updates a training sample's inclusion status (e.g. exclude blurry / bad quality crops).
 */
export async function updateSampleInclusion(
  sampleId: string,
  inclusion: OcrSampleInclusion,
  exclusionReason?: string,
  actorId?: string,
  db: PrismaClient | any = prisma
) {
  return db.ocrTrainingSample.update({
    where: { id: sampleId },
    data: {
      inclusion,
      exclusionReason: inclusion === OcrSampleInclusion.EXCLUDED ? exclusionReason : null,
    },
  });
}

/**
 * Returns aggregated statistics for the OCR training dataset.
 */
export async function getTrainingDatasetStats(
  db: PrismaClient | any = prisma
): Promise<DatasetStats> {
  const [totalSamples, approvedCount, pendingCount, excludedCount, groupedSources] =
    await Promise.all([
      db.ocrTrainingSample.count(),
      db.ocrTrainingSample.count({
        where: { inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN },
      }),
      db.ocrTrainingSample.count({
        where: { inclusion: OcrSampleInclusion.PENDING_REVIEW },
      }),
      db.ocrTrainingSample.count({
        where: { inclusion: OcrSampleInclusion.EXCLUDED },
      }),
      db.ocrTrainingSample.groupBy({
        by: ["source"],
        _count: { id: true },
      }),
    ]);

  const bySource: Record<string, number> = {};
  for (const group of groupedSources) {
    bySource[group.source] = group._count.id;
  }

  return {
    totalSamples,
    approvedCount,
    pendingCount,
    excludedCount,
    bySource,
  };
}

