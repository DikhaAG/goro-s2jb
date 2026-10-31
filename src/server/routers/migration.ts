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

      // Check RBAC permissions: Only SUPER_ADMIN or the batch creator can cancel
      const isSuperAdmin = ctx.user?.role === "SUPER_ADMIN";
      const isOwner = batch.uploadedById === ctx.user?.id;
      if (!isSuperAdmin && !isOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Anda tidak memiliki wewenang untuk membatalkan batch migrasi ini.",
        });
      }

      // 1. Set cancel token in Redis with 1 hour TTL so workers can abort immediately
      try {
        const { redis } = await import("@/lib/redis");
        await redis.set(`migration:cancel:${batch.id}`, "1", "EX", 3600);
      } catch (err) {
        console.warn("Failed to set Redis cancel key:", err);
      }

      // 2. Update status in database to CANCELLED
      await ctx.prisma.migrationBatch.update({
        where: { id: batch.id },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          errorMessage: `Dibatalkan oleh ${ctx.user?.name || "pengguna"}`,
        },
      });

      return {
        success: true,
        batchId: batch.id,
        message: "Proses migrasi berhasil dihentikan dan dibatalkan.",
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

  getMonitorBatches: operatorProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(10),
          status: z
            .enum(["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "PAUSED", "CANCELLED"])
            .default("ALL"),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const isSuperAdmin = ctx.user?.role === "SUPER_ADMIN";
      const userId = ctx.user?.id;

      // Filter by uploadedById if role is PEGAWAI (RBAC isolation)
      const whereClause: any = {};
      if (!isSuperAdmin) {
        whereClause.uploadedById = userId;
      }

      if (input.status !== "ALL") {
        whereClause.status = input.status;
      }

      const skip = (input.page - 1) * input.pageSize;

      const [batches, totalCount] = await Promise.all([
        ctx.prisma.migrationBatch.findMany({
          where: whereClause,
          skip,
          take: input.pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
              },
            },
            _count: {
              select: { errors: true },
            },
          },
        }),
        ctx.prisma.migrationBatch.count({
          where: whereClause,
        }),
      ]);

      return {
        batches,
        total: totalCount,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(totalCount / input.pageSize),
        isSuperAdmin,
      };
    }),

  getWorkerLiveMetrics: operatorProcedure.query(async ({ ctx }) => {
    const isSuperAdmin = ctx.user?.role === "SUPER_ADMIN";

    try {
      const { ocrQueue } = await import("../queues/ocrQueue");
      const { redis } = await import("@/lib/redis");

      // Ping Redis for latency
      const startPing = Date.now();
      await redis.ping();
      const redisLatencyMs = Date.now() - startPing;

      // BullMQ Queue Job Counts
      const [importJobCounts, ocrJobCounts] = await Promise.all([
        importQueue.getJobCounts(),
        ocrQueue.getJobCounts(),
      ]);

      // Database aggregated counts
      const [totalReviews, pendingReviews, approvedReviews] = await Promise.all([
        ctx.prisma.ratingReview.count(),
        ctx.prisma.ratingReview.count({ where: { validationStatus: "PENDING" } }),
        ctx.prisma.ratingReview.count({ where: { validationStatus: "APPROVED" } }),
      ]);

      return {
        isSuperAdmin,
        redisStatus: {
          healthy: true,
          latencyMs: redisLatencyMs,
        },
        importQueue: {
          active: importJobCounts.active || 0,
          waiting: importJobCounts.waiting || 0,
          completed: importJobCounts.completed || 0,
          failed: importJobCounts.failed || 0,
          delayed: importJobCounts.delayed || 0,
        },
        ocrQueue: {
          active: ocrJobCounts.active || 0,
          waiting: ocrJobCounts.waiting || 0,
          completed: ocrJobCounts.completed || 0,
          failed: ocrJobCounts.failed || 0,
          delayed: ocrJobCounts.delayed || 0,
        },
        databaseMetrics: {
          totalReviews,
          pendingReviews,
          approvedReviews,
        },
      };
    } catch (err: any) {
      console.error("Failed to query worker live metrics:", err);
      return {
        isSuperAdmin,
        redisStatus: {
          healthy: false,
          latencyMs: -1,
        },
        importQueue: { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0 },
        ocrQueue: { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0 },
        databaseMetrics: { totalReviews: 0, pendingReviews: 0, approvedReviews: 0 },
      };
    }
  }),

  listBatches: operatorProcedure.query(async ({ ctx }) => {
    const isSuperAdmin = ctx.user?.role === "SUPER_ADMIN";
    return ctx.prisma.migrationBatch.findMany({
      where: isSuperAdmin ? {} : { uploadedById: ctx.user?.id },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { errors: true },
        },
      },
    });
  }),

  getBatchErrorLogs: operatorProcedure
    .input(
      z.object({
        batchId: z.string().min(1),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.pageSize;
      const [errors, total] = await Promise.all([
        ctx.prisma.migrationErrorLog.findMany({
          where: { batchId: input.batchId },
          skip,
          take: input.pageSize,
          orderBy: { rowNumber: "asc" },
        }),
        ctx.prisma.migrationErrorLog.count({
          where: { batchId: input.batchId },
        }),
      ]);

      return {
        errors,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  getDetailedWorkerStatus: operatorProcedure.query(async ({ ctx }) => {
    const isSuperAdmin = ctx.user?.role === "SUPER_ADMIN";
    const { ocrQueue } = await import("../queues/ocrQueue");
    const { redis } = await import("@/lib/redis");

    // 1. Measure Redis ping latency
    const startPing = Date.now();
    let redisHealthy = true;
    let redisLatencyMs = 0;
    try {
      await redis.ping();
      redisLatencyMs = Date.now() - startPing;
    } catch {
      redisHealthy = false;
      redisLatencyMs = -1;
    }

    // 2. Fetch Queues status and counts
    const [importCounts, ocrCounts, importPaused, ocrPaused] = await Promise.all([
      importQueue.getJobCounts().catch(() => ({} as any)),
      ocrQueue.getJobCounts().catch(() => ({} as any)),
      importQueue.isPaused().catch(() => false),
      ocrQueue.isPaused().catch(() => false),
    ]);

    // 3. Fetch active jobs sample for real-time visualization
    const [importActiveJobs, ocrActiveJobs] = await Promise.all([
      importQueue.getJobs(["active"], 0, 5).catch(() => []),
      ocrQueue.getJobs(["active"], 0, 5).catch(() => []),
    ]);

    // 4. Parse Redis INFO for deep telemetry
    let redisInfoParsed = {
      version: "7.0.x",
      usedMemory: "N/A",
      peakMemory: "N/A",
      fragmentationRatio: "1.0",
      connectedClients: 1,
      uptimeSeconds: 0,
    };

    if (redisHealthy) {
      try {
        const [infoMemory, infoServer, infoClients] = await Promise.all([
          redis.info("memory"),
          redis.info("server"),
          redis.info("clients"),
        ]);

        const findVal = (str: string, key: string) => {
          const match = str.match(new RegExp(`^${key}:(.+)$`, "m"));
          return match ? match[1].trim() : "";
        };

        redisInfoParsed = {
          version: findVal(infoServer, "redis_version") || "7.0.x",
          usedMemory: findVal(infoMemory, "used_memory_human") || "N/A",
          peakMemory: findVal(infoMemory, "used_memory_peak_human") || "N/A",
          fragmentationRatio: findVal(infoMemory, "mem_fragmentation_ratio") || "1.0",
          connectedClients: parseInt(findVal(infoClients, "connected_clients") || "1", 10),
          uptimeSeconds: parseInt(findVal(infoServer, "uptime_in_seconds") || "0", 10),
        };
      } catch (e) {
        // Fallback
      }
    }

    // 5. Database Distribution
    const [totalReviews, pendingReviews, needsReviewReviews, approvedReviews, rejectedReviews] =
      await Promise.all([
        ctx.prisma.ratingReview.count(),
        ctx.prisma.ratingReview.count({ where: { validationStatus: "PENDING" } }),
        ctx.prisma.ratingReview.count({ where: { validationStatus: "NEEDS_REVIEW" } }),
        ctx.prisma.ratingReview.count({ where: { validationStatus: "APPROVED" } }),
        ctx.prisma.ratingReview.count({ where: { validationStatus: "REJECTED" } }),
      ]);

    // 6. Node.js process telemetry
    const memUsage = process.memoryUsage();
    const nodeTelemetry = {
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
      uptimeSeconds: Math.round(process.uptime()),
    };

    return {
      isSuperAdmin,
      redis: {
        healthy: redisHealthy,
        latencyMs: redisLatencyMs,
        ...redisInfoParsed,
      },
      node: nodeTelemetry,
      database: {
        totalReviews,
        pendingReviews,
        needsReviewReviews,
        approvedReviews,
        rejectedReviews,
      },
      queues: {
        import: {
          name: "import-processing-queue",
          displayName: "Worker Impor Data Massal",
          isPaused: importPaused,
          counts: {
            active: importCounts.active || 0,
            waiting: importCounts.waiting || 0,
            completed: importCounts.completed || 0,
            failed: importCounts.failed || 0,
            delayed: importCounts.delayed || 0,
            paused: importCounts.paused || 0,
          },
          activeJobs: importActiveJobs.map((j) => ({
            id: j.id || "unknown",
            name: j.name,
            batchId: j.data?.importBatchId,
            filePath: j.data?.filePath ? j.data.filePath.split("/").pop() : "unknown",
            startRow: j.data?.startRowNumber || 0,
            timestamp: j.timestamp,
            processedOn: j.processedOn,
          })),
        },
        ocr: {
          name: "ocr-processing-queue",
          displayName: "Worker OCR & AI Vision Eviden",
          isPaused: ocrPaused,
          counts: {
            active: ocrCounts.active || 0,
            waiting: ocrCounts.waiting || 0,
            completed: ocrCounts.completed || 0,
            failed: ocrCounts.failed || 0,
            delayed: ocrCounts.delayed || 0,
            paused: ocrCounts.paused || 0,
          },
          activeJobs: ocrActiveJobs.map((j) => ({
            id: j.id || "unknown",
            name: j.name,
            reviewId: j.data?.reviewId,
            expectedName: j.data?.expectedReviewerName,
            timestamp: j.timestamp,
            processedOn: j.processedOn,
          })),
        },
      },
    };
  }),

  getQueueJobs: operatorProcedure
    .input(
      z.object({
        queueName: z.enum(["import", "ocr"]),
        status: z.enum(["active", "waiting", "failed", "completed", "delayed"]).default("active"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { ocrQueue } = await import("../queues/ocrQueue");
      const targetQueue = input.queueName === "import" ? importQueue : ocrQueue;

      const counts = await targetQueue.getJobCounts();
      const totalCount = counts[input.status] || 0;

      const start = (input.page - 1) * input.pageSize;
      const end = start + input.pageSize - 1;

      const rawJobs = await targetQueue.getJobs([input.status], start, end, true);

      const jobs = rawJobs.map((job) => ({
        id: job.id || "unknown",
        name: job.name,
        data: job.data,
        progress: job.progress,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason || null,
        stacktrace: job.stacktrace ? job.stacktrace.slice(0, 3) : [],
      }));

      return {
        jobs,
        total: totalCount,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(totalCount / input.pageSize),
      };
    }),

  pauseQueue: operatorProcedure
    .input(z.object({ queueName: z.enum(["import", "ocr"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Hanya Super Admin yang berwenang menjeda antrean worker sistem.",
        });
      }

      const { ocrQueue } = await import("../queues/ocrQueue");
      const targetQueue = input.queueName === "import" ? importQueue : ocrQueue;
      await targetQueue.pause();

      return {
        success: true,
        message: `Antrean worker ${input.queueName.toUpperCase()} berhasil dijeda.`,
      };
    }),

  resumeQueue: operatorProcedure
    .input(z.object({ queueName: z.enum(["import", "ocr"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Hanya Super Admin yang berwenang melanjutkan antrean worker sistem.",
        });
      }

      const { ocrQueue } = await import("../queues/ocrQueue");
      const targetQueue = input.queueName === "import" ? importQueue : ocrQueue;
      await targetQueue.resume();

      return {
        success: true,
        message: `Antrean worker ${input.queueName.toUpperCase()} berhasil dilanjutkan.`,
      };
    }),

  retryJob: operatorProcedure
    .input(
      z.object({
        queueName: z.enum(["import", "ocr"]),
        jobId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Hanya Super Admin yang berwenang mencoba ulang job worker.",
        });
      }

      const { ocrQueue } = await import("../queues/ocrQueue");
      const targetQueue = input.queueName === "import" ? importQueue : ocrQueue;
      const job = await targetQueue.getJob(input.jobId);

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Job dengan ID ${input.jobId} tidak ditemukan di antrean.`,
        });
      }

      await job.retry();

      return {
        success: true,
        message: `Job ${input.jobId} berhasil dijadwalkan ulang untuk dieksekusi.`,
      };
    }),

  removeJob: operatorProcedure
    .input(
      z.object({
        queueName: z.enum(["import", "ocr"]),
        jobId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Hanya Super Admin yang berwenang menghapus job worker.",
        });
      }

      const { ocrQueue } = await import("../queues/ocrQueue");
      const targetQueue = input.queueName === "import" ? importQueue : ocrQueue;
      const job = await targetQueue.getJob(input.jobId);

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Job dengan ID ${input.jobId} tidak ditemukan di antrean.`,
        });
      }

      await job.remove();

      return {
        success: true,
        message: `Job ${input.jobId} berhasil dihapus dari antrean.`,
      };
    }),

  retryAllFailedJobs: operatorProcedure
    .input(z.object({ queueName: z.enum(["import", "ocr"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Hanya Super Admin yang berwenang mencoba ulang seluruh job gagal.",
        });
      }

      const { ocrQueue } = await import("../queues/ocrQueue");
      const targetQueue = input.queueName === "import" ? importQueue : ocrQueue;
      const failedJobs = await targetQueue.getJobs(["failed"], 0, 100);

      await Promise.all(failedJobs.map((j) => j.retry().catch(() => {})));

      return {
        success: true,
        retriedCount: failedJobs.length,
        message: `${failedJobs.length} job gagal berhasil dijadwalkan ulang.`,
      };
    }),

  cleanQueue: operatorProcedure
    .input(
      z.object({
        queueName: z.enum(["import", "ocr"]),
        type: z.enum(["failed", "completed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Hanya Super Admin yang berwenang membersihkan riwayat antrean.",
        });
      }

      const { ocrQueue } = await import("../queues/ocrQueue");
      const targetQueue = input.queueName === "import" ? importQueue : ocrQueue;
      await targetQueue.clean(0, 1000, input.type);

      return {
        success: true,
        message: `Riwayat job ${input.type} pada ${input.queueName.toUpperCase()} berhasil dibersihkan.`,
      };
    }),
});
