import { router, operatorProcedure } from "../trpc";
import { z } from "zod";
import { importQueue } from "../queues/importQueue";
import { TRPCError } from "@trpc/server";
import fs from "fs";

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
        // 1. Create MigrationBatch record with filePath saved for recovery
        const batch = await ctx.prisma.migrationBatch.create({
          data: {
            fileName: input.fileName,
            fileSize: input.fileSize,
            filePath: input.filePath,
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
          startRowNumber: 0,
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

  getActiveOrInterruptedBatch: operatorProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    // Check if user has any active (PROCESSING, PENDING) or interrupted (PAUSED) batch
    const batch = await ctx.prisma.migrationBatch.findFirst({
      where: {
        ...(userId ? { uploadedById: userId } : {}),
        status: { in: ["PROCESSING", "PENDING", "PAUSED"] },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        errors: {
          take: 5,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return batch;
  }),

  resumeMigration: operatorProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const batch = await ctx.prisma.migrationBatch.findUnique({
        where: { id: input.batchId },
      });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      if (batch.status === "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Batch migrasi ini telah selesai",
        });
      }

      if (!batch.filePath || !fs.existsSync(batch.filePath)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Berkas sumber migrasi di server tidak ditemukan atau telah kedaluwarsa",
        });
      }

      // Update status to PROCESSING
      await ctx.prisma.migrationBatch.update({
        where: { id: batch.id },
        data: {
          status: "PROCESSING",
        },
      });

      // Dispatch to BullMQ with startRowNumber = batch.lastProcessedRow
      await importQueue.add("process-bulk-import", {
        importBatchId: batch.id,
        filePath: batch.filePath,
        userId: ctx.user?.id || batch.uploadedById || "admin_migration",
        startRowNumber: batch.lastProcessedRow,
      });

      return {
        success: true,
        batchId: batch.id,
        resumedFromRow: batch.lastProcessedRow,
        message: `Migrasi dilanjutkan dari baris ke-${batch.lastProcessedRow}`,
      };
    }),

  pauseMigration: operatorProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const batch = await ctx.prisma.migrationBatch.findUnique({
        where: { id: input.batchId },
      });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      await ctx.prisma.migrationBatch.update({
        where: { id: batch.id },
        data: {
          status: "PAUSED",
        },
      });

      return {
        success: true,
        message: "Migrasi dijeda",
      };
    }),

  cancelBatch: operatorProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const batch = await ctx.prisma.migrationBatch.findUnique({
        where: { id: input.batchId },
      });

      if (!batch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data batch migrasi tidak ditemukan",
        });
      }

      await ctx.prisma.migrationBatch.update({
        where: { id: batch.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: "Dibatalkan oleh pengguna",
        },
      });

      return {
        success: true,
        message: "Batch migrasi berhasil dibatalkan",
      };
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
