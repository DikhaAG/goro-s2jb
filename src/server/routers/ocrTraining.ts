import { z } from "zod";
import { router, operatorProcedure } from "../trpc";
import { OcrSampleSource, OcrSampleInclusion, Prisma } from "@prisma/client";
import {
  getTrainingDatasetStats,
  updateSampleInclusion,
  coldStartHarvestFromHistoricalSpreadsheet,
} from "../services/ocrDatasetHarvester";
import { runOcrTrainingPipeline } from "../services/ocrTrainerService";

export const ocrTrainingRouter = router({
  /**
   * 1. Get Training Dataset Aggregated Statistics
   */
  getDatasetStats: operatorProcedure.query(async ({ ctx }) => {
    return getTrainingDatasetStats(ctx.prisma);
  }),

  /**
   * 2. Get Paginated List of Training Samples with Multidimensional Filtering
   */
  getSamples: operatorProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(25),
        search: z.string().optional(),
        source: z.nativeEnum(OcrSampleSource).optional(),
        inclusion: z.nativeEnum(OcrSampleInclusion).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, source, inclusion } = input;
      const skip = (page - 1) * pageSize;

      const where: Prisma.OcrTrainingSampleWhereInput = {};

      if (source) {
        where.source = source;
      }

      if (inclusion) {
        where.inclusion = inclusion;
      }

      if (search && search.trim() !== "") {
        const query = search.trim();
        where.OR = [
          { reviewerName: { contains: query, mode: "insensitive" } },
          { groundTruthText: { contains: query, mode: "insensitive" } },
          { rawOcrText: { contains: query, mode: "insensitive" } },
        ];
      }

      const [items, totalCount] = await Promise.all([
        ctx.prisma.ocrTrainingSample.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            verifiedBy: {
              select: { id: true, name: true, role: true },
            },
            review: {
              select: {
                id: true,
                validationStatus: true,
                confidenceScore: true,
                up3: { select: { name: true } },
                ulp: { select: { name: true } },
              },
            },
          },
        }),
        ctx.prisma.ocrTrainingSample.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize) || 1;

      return {
        items,
        totalCount,
        totalPages,
        page,
        pageSize,
      };
    }),

  /**
   * 3. Update Training Sample Inclusion (Curate / Exclude)
   */
  updateSampleInclusion: operatorProcedure
    .input(
      z.object({
        sampleId: z.string(),
        inclusion: z.nativeEnum(OcrSampleInclusion),
        exclusionReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await updateSampleInclusion(
        input.sampleId,
        input.inclusion,
        input.exclusionReason,
        ctx.user.id,
        ctx.prisma
      );

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: "UPDATE_OCR_SAMPLE_INCLUSION",
          entityType: "OcrTrainingSample",
          entityId: input.sampleId,
          metadata: {
            actorRole: ctx.user.role,
            inclusion: input.inclusion,
            exclusionReason: input.exclusionReason || null,
          },
        },
      });

      return {
        success: true,
        sample: updated,
      };
    }),

  /**
   * 4. Trigger Cold-Start Harvesting from Historical Spreadsheet Data
   */
  triggerColdStartHarvest: operatorProcedure
    .input(
      z.object({
        batchSize: z.number().int().min(10).max(2000).default(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const stats = await coldStartHarvestFromHistoricalSpreadsheet(
        {
          batchSize: input.batchSize,
          actorId: ctx.user.id,
        },
        ctx.prisma
      );

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: "COLD_START_HARVEST_OCR_DATASET",
          entityType: "OcrTrainingSample",
          metadata: {
            actorRole: ctx.user.role,
            batchSize: input.batchSize,
            stats,
          },
        },
      });

      return {
        success: true,
        ...stats,
      };
    }),

  /**
   * 5. Trigger OCR Model Training (Manual on-demand)
   */
  triggerTraining: operatorProcedure
    .input(
      z.object({
        epochs: z.number().int().min(1).max(100).default(5),
        batchSize: z.number().int().min(2).max(64).default(8),
        learningRate: z.number().min(0.00001).max(0.1).default(0.001),
        targetVersion: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await runOcrTrainingPipeline(
        {
          epochs: input.epochs,
          batchSize: input.batchSize,
          learningRate: input.learningRate,
          targetVersion: input.targetVersion,
          triggerType: "MANUAL",
          actorId: ctx.user.id,
        },
        ctx.prisma
      );

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: "TRIGGER_MANUAL_OCR_TRAINING",
          entityType: "OcrTrainingJob",
          entityId: result.jobId,
          metadata: {
            actorRole: ctx.user.role,
            epochs: input.epochs,
            targetVersion: input.targetVersion,
            result: result as unknown as Prisma.InputJsonValue,
          },
        },
      });

      return result;
    }),

  /**
   * 6. Get Recent Training Jobs History
   */
  getJobs: operatorProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.ocrTrainingJob.findMany({
        take: input.limit,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
          modelRegistry: {
            select: {
              id: true,
              version: true,
              status: true,
              cerScore: true,
              werScore: true,
              accuracyScore: true,
            },
          },
        },
      });
    }),
});

