import { router, executiveProcedure } from "../trpc";
import { z } from "zod";
import {
  getDailyReport,
  getH1Report,
  getMonthlyReport,
  getExecutiveKpis,
  getPacingData,
} from "../services/reportService";

export const reportRouter = router({
  getDaily: executiveProcedure
    .input(
      z
        .object({
          date: z.string().optional(),
          up3Id: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const targetDate = input?.date ? new Date(input.date) : new Date();
      return getDailyReport(targetDate, input?.up3Id);
    }),

  getH1: executiveProcedure
    .input(
      z
        .object({
          date: z.string().optional(),
          up3Id: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const targetDate = input?.date ? new Date(input.date) : new Date();
      return getH1Report(targetDate, input?.up3Id);
    }),

  getMonthly: executiveProcedure
    .input(
      z
        .object({
          year: z.number().optional(),
          month: z.number().min(1).max(12).optional(),
          up3Id: z.string().optional(),
          asOfDate: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const now = new Date();
      const year = input?.year || now.getFullYear();
      const month = input?.month || now.getMonth() + 1;
      const asOfDate = input?.asOfDate ? new Date(input.asOfDate) : undefined;
      return getMonthlyReport(year, month, input?.up3Id, asOfDate);
    }),

  getKpis: executiveProcedure
    .input(
      z
        .object({
          date: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const asOfDate = input?.date ? new Date(input.date) : new Date();
      return getExecutiveKpis(asOfDate);
    }),

  getPacing: executiveProcedure
    .input(
      z
        .object({
          year: z.number().optional(),
          month: z.number().min(1).max(12).optional(),
          up3Id: z.string().optional(),
          ulpId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const now = new Date();
      const year = input?.year || now.getFullYear();
      const month = input?.month || now.getMonth() + 1;
      return getPacingData(year, month, input?.up3Id, input?.ulpId);
    }),

  getSyncStatus: executiveProcedure.query(async ({ ctx }) => {
    // 1. Ambil data batch migrasi terbaru untuk deteksi perubahan status impor
    const latestBatch = await ctx.prisma.migrationBatch.findFirst({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        fileName: true,
        status: true,
        completedAt: true,
        updatedAt: true,
        processedRows: true,
        totalRows: true,
      },
    });

    // 2. Ambil tanggal ulasan disetujui (APPROVED) terbaru dan total ulasan
    const [latestApprovedReview, totalApprovedCount, totalReviewsCount] = await Promise.all([
      ctx.prisma.ratingReview.findFirst({
        where: { validationStatus: "APPROVED" },
        orderBy: { entryDate: "desc" },
        select: {
          id: true,
          entryDate: true,
          updatedAt: true,
        },
      }),
      ctx.prisma.ratingReview.count({
        where: { validationStatus: "APPROVED" },
      }),
      ctx.prisma.ratingReview.count(),
    ]);

    let redisTimestamp: string | null = null;
    try {
      const redis = (await import("@/lib/redis")).default;
      redisTimestamp = await redis.get("reports:last_update_timestamp");
    } catch {
      // Non-critical fallback
    }

    const lastDataUpdate = latestApprovedReview?.updatedAt
      ? new Date(latestApprovedReview.updatedAt).getTime()
      : latestBatch?.updatedAt
      ? new Date(latestBatch.updatedAt).getTime()
      : Date.now();

    return {
      lastSyncTimestamp: redisTimestamp || lastDataUpdate.toString(),
      latestBatch,
      latestApprovedReviewDate: latestApprovedReview?.entryDate
        ? new Date(latestApprovedReview.entryDate).toISOString()
        : null,
      totalApprovedCount,
      totalReviewsCount,
    };
  }),
});
