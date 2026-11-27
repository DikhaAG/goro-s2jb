import { router, operatorProcedure } from "../trpc";
import { z } from "zod";
import { PrismaClient, ValidationStatus } from "@prisma/client";
import { createReviewWorkflow } from "../services/reviewWorkflow";
import { createReportSyncStamp } from "../services/achievementReport";

function workflowFromCtx(ctx: { prisma: PrismaClient; redis?: any }) {
  return createReviewWorkflow({
    prisma: ctx.prisma,
    markReportsUpdated: createReportSyncStamp(() => ctx.redis).markUpdated,
  });
}

export const reviewsRouter = router({
  getList: operatorProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(25),
        search: z.string().optional(),
        validationStatus: z
          .enum(["ALL", "PENDING", "NEEDS_REVIEW", "APPROVED", "REJECTED"])
          .optional()
          .default("ALL"),
        ocrStatus: z
          .enum([
            "ALL",
            "QUEUED",
            "DOWNLOADING",
            "PROCESSING",
            "COMPLETED",
            "FAILED",
          ])
          .optional()
          .default("ALL"),
        validationZone: z
          .enum(["ALL", "GREEN", "YELLOW", "RED"])
          .optional()
          .default("ALL"),
        source: z
          .enum(["ALL", "INTAKE", "MIGRATION"])
          .optional()
          .default("ALL"),
        up3Id: z.string().optional(),
        ulpId: z.string().optional(),
        isDuplicate: z.boolean().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        sortBy: z
          .enum([
            "entryDate",
            "timestamp",
            "confidenceScore",
            "playstoreReviewerName",
          ])
          .default("entryDate"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(({ ctx, input }) => workflowFromCtx(ctx).getList(input)),

  getDetail: operatorProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => workflowFromCtx(ctx).getDetail(input.id)),

  submitDecision: operatorProcedure
    .input(
      z.object({
        reviewId: z.string(),
        decision: z.enum(["APPROVED", "REJECTED"]),
        remarks: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      workflowFromCtx(ctx).submitDecision(input, ctx.user)
    ),

  undoDecision: operatorProcedure
    .input(
      z.object({
        reviewId: z.string(),
        previousStatus: z
          .enum(["NEEDS_REVIEW", "PENDING", "APPROVED", "REJECTED"])
          .optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      workflowFromCtx(ctx).undoDecision(input, ctx.user)
    ),

  update: operatorProcedure
    .input(
      z.object({
        id: z.string(),
        playstoreReviewerName: z.string().min(1).optional(),
        originalReviewerName: z.string().nullable().optional(),
        up3Id: z.string().optional(),
        ulpId: z.string().optional(),
        entryDate: z.string().datetime().or(z.date()).optional(),
        appVersionId: z.string().optional(),
        reviewerCategory: z.string().optional(),
        fieldNotes: z.string().nullable().optional(),
        reviewRemarks: z.string().nullable().optional(),
        validationStatus: z.nativeEnum(ValidationStatus).optional(),
        isDuplicate: z.boolean().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      workflowFromCtx(ctx).update(input, ctx.user)
    ),

  bulkUpdate: operatorProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(500),
        up3Id: z.string().optional(),
        ulpId: z.string().optional(),
        validationStatus: z.nativeEnum(ValidationStatus).optional(),
        isDuplicate: z.boolean().optional(),
        remarks: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      workflowFromCtx(ctx).bulkUpdate(input, ctx.user)
    ),

  retryOcr: operatorProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(({ ctx, input }) =>
      workflowFromCtx(ctx).retryOcr(input.reviewId, ctx.user)
    ),

  bulkRetryOcr: operatorProcedure
    .input(
      z.object({
        reviewIds: z.array(z.string()).min(1).max(200),
      })
    )
    .mutation(({ ctx, input }) =>
      workflowFromCtx(ctx).bulkRetryOcr(input.reviewIds, ctx.user)
    ),

  delete: operatorProcedure
    .input(
      z.object({
        id: z.string(),
        mode: z.enum(["SOFT_REJECT", "PERMANENT"]),
        reason: z.string().min(3, "Alasan wajib diisi minimal 3 karakter"),
      })
    )
    .mutation(({ ctx, input }) =>
      workflowFromCtx(ctx).delete(input, ctx.user)
    ),

  bulkDelete: operatorProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(500),
        mode: z.enum(["SOFT_REJECT", "PERMANENT"]),
        reason: z.string().min(3, "Alasan wajib diisi minimal 3 karakter"),
      })
    )
    .mutation(({ ctx, input }) =>
      workflowFromCtx(ctx).bulkDelete(input, ctx.user)
    ),

  deleteAll: operatorProcedure
    .input(
      z.object({
        mode: z.enum(["SOFT_REJECT", "PERMANENT"]),
        reason: z.string().min(3, "Alasan wajib diisi minimal 3 karakter"),
        confirmText: z.string(),
      })
    )
    .mutation(({ ctx, input }) =>
      workflowFromCtx(ctx).deleteAll(input, ctx.user)
    ),

  getFilterOptions: operatorProcedure.query(({ ctx }) =>
    workflowFromCtx(ctx).getFilterOptions()
  ),
});
