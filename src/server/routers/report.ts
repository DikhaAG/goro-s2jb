import { router, executiveProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Context } from "../context";
import { createAchievementReport, type AchievementReport } from "../services/achievementReport";

function reportFor(ctx: Context): AchievementReport {
  return createAchievementReport({ db: ctx.prisma, now: () => new Date() });
}

function posisiOrThrow(report: AchievementReport, input: string | undefined) {
  const parsed = report.parsePosisi(input);
  if (!parsed.ok) throw new TRPCError({ code: "BAD_REQUEST", message: parsed.error });
  return parsed.posisi;
}

const posisiInput = z
  .object({
    posisiTanggal: z.string().optional(),
    up3Id: z.string().optional(),
  })
  .optional();

export const reportRouter = router({
  getTargetCalendar: executiveProcedure
    .input(
      z.object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
      })
    )
    .query(async ({ ctx, input }) => {
      return reportFor(ctx).calendar(input.year, input.month);
    }),

  setTargetCalendar: executiveProcedure
    .input(
      z.object({
        entries: z
          .array(z.object({ date: z.string(), dailyTarget: z.number() }))
          .min(1)
          .max(62),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await reportFor(ctx).setCalendar(input.entries);
      if (!result.ok) {
        const dates = result.dates.join(", ");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            result.reason === "past_dates"
              ? `Target tanggal yang sudah lewat tidak dapat diubah: ${dates}.`
              : `Target harus bilangan bulat 0 sampai 10000: ${dates}.`,
        });
      }

      if (ctx.user?.id) {
        await ctx.prisma.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: "UPDATE_TARGET_CALENDAR",
            entityType: "TARGET_CALENDAR",
            metadata: { entries: input.entries },
          },
        });
      }
      try {
        await ctx.redis.set("reports:last_update_timestamp", Date.now().toString());
      } catch {
        // Live refresh is best effort; the reports read the calendar directly.
      }
      return result;
    }),

  getDaily: executiveProcedure.input(posisiInput).query(async ({ ctx, input }) => {
    const report = reportFor(ctx);
    return report.daily(posisiOrThrow(report, input?.posisiTanggal), { up3Id: input?.up3Id });
  }),

  getMonthly: executiveProcedure.input(posisiInput).query(async ({ ctx, input }) => {
    const report = reportFor(ctx);
    return report.monthly(posisiOrThrow(report, input?.posisiTanggal), { up3Id: input?.up3Id });
  }),

  getKpis: executiveProcedure
    .input(z.object({ posisiTanggal: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const report = reportFor(ctx);
      return report.kpis(posisiOrThrow(report, input?.posisiTanggal));
    }),

  getPacing: executiveProcedure
    .input(
      z
        .object({
          posisiTanggal: z.string().optional(),
          up3Id: z.string().optional(),
          ulpId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const report = reportFor(ctx);
      return report.pacing(posisiOrThrow(report, input?.posisiTanggal), {
        up3Id: input?.up3Id,
        ulpId: input?.ulpId,
      });
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
