import { router, operatorProcedure } from "../trpc";
import { z } from "zod";
import { importQueue } from "../queues/importQueue";
import { TRPCError } from "@trpc/server";

export const migrationRouter = router({
  startMigration: operatorProcedure
    .input(
      z.object({
        filePath: z.string().min(1),
        fileName: z.string().min(1),
        fileSize: z.number().int().positive(),
        targetType: z.enum(["FORM_RESPONSES_RAW", "HISTORICAL_REPORTS"]).default("FORM_RESPONSES_RAW"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // 1. Create MigrationBatch record
        const batch = await ctx.prisma.migrationBatch.create({
          data: {
            fileName: input.fileName,
            fileSize: input.fileSize,
            targetType: input.targetType,
            status: "PENDING",
            uploadedById: ctx.user?.id || null,
          },
        });

        // 2. Dispatch to BullMQ importQueue
        await importQueue.add("process-bulk-import", {
          importBatchId: batch.id,
          filePath: input.filePath,
          userId: ctx.user?.id || "admin_migration",
        });

        return {
          success: true,
          batchId: batch.id,
          message: "Berkas berhasil dijadwalkan untuk proses migrasi massal di latar belakang",
        };
      } catch (err: any) {
        console.error("Failed to start migration:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Gagal memulai migrasi berkas historis",
        });
      }
    }),

  getBatchStatus: operatorProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const batch = await ctx.prisma.migrationBatch.findUnique({
        where: { id: input.batchId },
        include: {
          errors: {
            take: 20,
            orderBy: { rowNumber: "asc" },
          },
        },
      });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      return batch;
    }),

  listBatches: operatorProcedure.query(async ({ ctx }) => {
    return ctx.prisma.migrationBatch.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { errors: true },
        },
      },
    });
  }),
});
