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
});
