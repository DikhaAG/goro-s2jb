import { router, operatorProcedure } from "../trpc";
import { z } from "zod";
import { ValidationStatus, Prisma } from "@prisma/client";

export const triageRouter = router({
  getQueue: operatorProcedure
    .input(
      z.object({
        up3Id: z.string().optional(),
        ulpId: z.string().optional(),
        status: z.enum(["ALL", "NEEDS_REVIEW", "APPROVED", "REJECTED", "PENDING"]).optional().default("NEEDS_REVIEW"),
        isDuplicateOnly: z.boolean().optional().default(false),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(200).optional().default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.RatingReviewWhereInput = {};

      if (input.status && input.status !== "ALL") {
        where.validationStatus = input.status as ValidationStatus;
      }

      if (input.isDuplicateOnly) {
        where.isDuplicate = true;
      }

      if (input.up3Id) {
        where.up3Id = input.up3Id;
      }

      if (input.ulpId) {
        where.ulpId = input.ulpId;
      }

      if (input.dateFrom || input.dateTo) {
        where.entryDate = {};
        if (input.dateFrom) {
          where.entryDate.gte = new Date(input.dateFrom);
        }
        if (input.dateTo) {
          const to = new Date(input.dateTo);
          to.setHours(23, 59, 59, 999);
          where.entryDate.lte = to;
        }
      }

      // Query items with FIFO ordering
      const items = await ctx.prisma.ratingReview.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: [
          { entryDate: "asc" },
          { timestamp: "asc" },
          { id: "asc" },
        ],
        include: {
          up3: { select: { id: true, code: true, name: true } },
          ulp: { select: { id: true, code: true, name: true } },
          appVersion: { select: { id: true, version: true } },
          duplicateOf: {
            select: {
              id: true,
              playstoreReviewerName: true,
              entryDate: true,
              evidenceImagePath: true,
              validationStatus: true,
            },
          },
          verifiedBy: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      // Calculate Tactical Metrics
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [yellowQueueCount, verifiedTodayCount, totalReviewsCount, autonomousCount] = await Promise.all([
        // 1. Antrean Zona Kuning (Pending Review)
        ctx.prisma.ratingReview.count({
          where: { validationStatus: ValidationStatus.NEEDS_REVIEW },
        }),
        // 2. Terverifikasi Hari Ini (Approve/Reject by human operator today)
        ctx.prisma.ratingReview.count({
          where: {
            verifiedAt: { gte: startOfToday },
          },
        }),
        // 3. Total submissions
        ctx.prisma.ratingReview.count(),
        // 4. Autonomous AI resolutions (Green + Red resolved without human verifiedById)
        ctx.prisma.ratingReview.count({
          where: {
            validationStatus: { in: [ValidationStatus.APPROVED, ValidationStatus.REJECTED] },
            verifiedById: null,
          },
        }),
      ]);

      const aiAutomationRate =
        totalReviewsCount > 0
          ? Math.round((autonomousCount / totalReviewsCount) * 1000) / 10
          : 0;

      return {
        items,
        nextCursor,
        metrics: {
          yellowQueueCount,
          verifiedTodayCount,
          aiAutomationRate,
          totalReviewsCount,
        },
      };
    }),

  submitDecision: operatorProcedure
    .input(
      z.object({
        reviewId: z.string(),
        decision: z.enum(["APPROVED", "REJECTED"]),
        remarks: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const defaultRemark =
        input.decision === "APPROVED"
          ? "Disetujui oleh Operator"
          : "Ditolak oleh Operator";

      const updated = await ctx.prisma.ratingReview.update({
        where: { id: input.reviewId },
        data: {
          validationStatus: input.decision as ValidationStatus,
          verifiedById: ctx.user.id,
          verifiedAt: new Date(),
          reviewRemarks: input.remarks || defaultRemark,
        },
        include: {
          verifiedBy: {
            select: { id: true, name: true, username: true },
          },
        },
      });

      return updated;
    }),

  undoDecision: operatorProcedure
    .input(
      z.object({
        reviewId: z.string(),
        previousStatus: z.enum(["NEEDS_REVIEW", "PENDING"]).optional().default("NEEDS_REVIEW"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const reverted = await ctx.prisma.ratingReview.update({
        where: { id: input.reviewId },
        data: {
          validationStatus: input.previousStatus as ValidationStatus,
          verifiedById: null,
          verifiedAt: null,
          reviewRemarks: "Keputusan dibatalkan (Undo)",
        },
      });

      return reverted;
    }),
});
