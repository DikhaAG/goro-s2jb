import { router, operatorProcedure } from "../trpc";
import { z } from "zod";
import {
  ValidationStatus,
  OcrProcessingStatus,
  Prisma,
  Role,
  ReviewSource,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { ocrQueue } from "../queues/ocrQueue";

export const reviewsRouter = router({
  /**
   * 1. Get Paginated and Filtered Reviews List
   * Provides advanced multidimensional search, sorting, and stats for the data grid.
   */
  getList: operatorProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(25),
        search: z.string().optional(),
        validationStatus: z
          .enum(["ALL", "PENDING", "APPROVED", "REJECTED"])
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
          .enum(["entryDate", "timestamp", "confidenceScore", "playstoreReviewerName"])
          .default("entryDate"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.RatingReviewWhereInput = {};

      // 1. Text Search across reviewer name, original name, OCR text, and notes
      if (input.search && input.search.trim().length > 0) {
        const query = input.search.trim();
        where.OR = [
          { playstoreReviewerName: { contains: query, mode: "insensitive" } },
          { originalReviewerName: { contains: query, mode: "insensitive" } },
          { extractedOcrText: { contains: query, mode: "insensitive" } },
          { fieldNotes: { contains: query, mode: "insensitive" } },
          { id: { contains: query, mode: "insensitive" } },
        ];
      }

      // 2. Validation Status Filter
      if (input.validationStatus && input.validationStatus !== "ALL") {
        where.validationStatus = input.validationStatus as ValidationStatus;
      }

      // 3. OCR Status Filter
      if (input.ocrStatus && input.ocrStatus !== "ALL") {
        where.ocrStatus = input.ocrStatus as OcrProcessingStatus;
      }

      // 3b. Source Filter (INTAKE vs MIGRATION)
      if (input.source && input.source !== "ALL") {
        where.source = input.source as ReviewSource;
      }

      // 4. Validation Confidence Zone Filter
      if (input.validationZone && input.validationZone !== "ALL") {
        if (input.validationZone === "GREEN") {
          where.confidenceScore = { gte: 90.0 };
        } else if (input.validationZone === "YELLOW") {
          where.confidenceScore = { gte: 70.0, lt: 90.0 };
        } else if (input.validationZone === "RED") {
          where.OR = [
            { confidenceScore: { lt: 70.0 } },
            { ocrStatus: OcrProcessingStatus.FAILED },
          ];
        }
      }

      // 5. Unit Hierarchy Filter
      if (input.up3Id) {
        where.up3Id = input.up3Id;
      }
      if (input.ulpId) {
        where.ulpId = input.ulpId;
      }

      // 6. Duplicate Flag Filter
      if (typeof input.isDuplicate === "boolean") {
        where.isDuplicate = input.isDuplicate;
      }

      // 7. Entry Date Range Filter
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

      // Compute Total Count and Paginated Items
      const skip = (input.page - 1) * input.pageSize;
      const [totalCount, items, totalApproved, totalRejected, totalPending, totalActiveOcr, totalDuplicates] =
        await Promise.all([
          ctx.prisma.ratingReview.count({ where }),
          ctx.prisma.ratingReview.findMany({
            where,
            skip,
            take: input.pageSize,
            orderBy: {
              [input.sortBy]: input.sortOrder,
            },
            include: {
              up3: { select: { id: true, code: true, name: true } },
              ulp: { select: { id: true, code: true, name: true } },
              appVersion: { select: { id: true, version: true } },
              verifiedBy: { select: { id: true, name: true, role: true } },
              duplicateOf: {
                select: {
                  id: true,
                  playstoreReviewerName: true,
                  originalReviewerName: true,
                  entryDate: true,
                  evidenceImagePath: true,
                  validationStatus: true,
                  confidenceScore: true,
                  up3: { select: { id: true, name: true } },
                  ulp: { select: { id: true, name: true } },
                },
              },
            },
          }),
          ctx.prisma.ratingReview.count({
            where: { ...where, validationStatus: ValidationStatus.APPROVED },
          }),
          ctx.prisma.ratingReview.count({
            where: { ...where, validationStatus: ValidationStatus.REJECTED },
          }),
          ctx.prisma.ratingReview.count({
            where: { ...where, validationStatus: ValidationStatus.PENDING },
          }),
          ctx.prisma.ratingReview.count({
            where: {
              ...where,
              ocrStatus: {
                in: [
                  OcrProcessingStatus.QUEUED,
                  OcrProcessingStatus.DOWNLOADING,
                  OcrProcessingStatus.PROCESSING,
                ],
              },
            },
          }),
          ctx.prisma.ratingReview.count({
            where: { ...where, isDuplicate: true },
          }),
        ]);

      return {
        items,
        totalCount,
        totalPages: Math.ceil(totalCount / input.pageSize) || 1,
        page: input.page,
        pageSize: input.pageSize,
        kpi: {
          total: totalCount,
          approved: totalApproved,
          rejected: totalRejected,
          pending: totalPending,
          activeOcr: totalActiveOcr,
          duplicates: totalDuplicates,
        },
      };
    }),

  /**
   * 2. Get Comprehensive Review Detail
   * Retrieves full relations and audit trail logs for slide-over inspection.
   */
  getDetail: operatorProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const review = await ctx.prisma.ratingReview.findUnique({
        where: { id: input.id },
        include: {
          up3: true,
          ulp: true,
          appVersion: true,
          duplicateOf: {
            select: {
              id: true,
              playstoreReviewerName: true,
              originalReviewerName: true,
              entryDate: true,
              evidenceImagePath: true,
              validationStatus: true,
              confidenceScore: true,
              up3: { select: { id: true, name: true } },
              ulp: { select: { id: true, name: true } },
            },
          },
          submittedBy: {
            select: { id: true, name: true, username: true, role: true },
          },
          verifiedBy: {
            select: { id: true, name: true, username: true, role: true },
          },
        },
      });

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Ulasan dengan ID ${input.id} tidak ditemukan.`,
        });
      }

      // Fetch audit logs for this specific review entity
      const auditLogs = await ctx.prisma.auditLog.findMany({
        where: {
          entityType: "RatingReview",
          entityId: input.id,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          user: {
            select: { id: true, name: true, role: true, username: true },
          },
        },
      });

      return {
        review,
        auditLogs,
      };
    }),

  /**
   * 3. Update Review Record (Curative Edit)
   * Modifies review fields, updates validation status, and records audit trail.
   */
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
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.ratingReview.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Ulasan dengan ID ${input.id} tidak ditemukan.`,
        });
      }

      // If unit changed, verify UP3 / ULP relationship
      if (input.ulpId && input.up3Id) {
        const validUlp = await ctx.prisma.uLP.findFirst({
          where: { id: input.ulpId, up3Id: input.up3Id },
        });
        if (!validUlp) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ULP yang dipilih tidak berada di bawah UP3 terkait.",
          });
        }
      }

      const updateData: Prisma.RatingReviewUpdateInput = {};

      if (input.playstoreReviewerName !== undefined) {
        updateData.playstoreReviewerName = input.playstoreReviewerName;
      }
      if (input.originalReviewerName !== undefined) {
        updateData.originalReviewerName = input.originalReviewerName;
      }
      if (input.up3Id !== undefined) {
        updateData.up3 = { connect: { id: input.up3Id } };
      }
      if (input.ulpId !== undefined) {
        updateData.ulp = { connect: { id: input.ulpId } };
      }
      if (input.entryDate !== undefined) {
        updateData.entryDate = new Date(input.entryDate);
      }
      if (input.appVersionId !== undefined) {
        updateData.appVersion = { connect: { id: input.appVersionId } };
      }
      if (input.reviewerCategory !== undefined) {
        updateData.reviewerCategory = input.reviewerCategory;
      }
      if (input.fieldNotes !== undefined) {
        updateData.fieldNotes = input.fieldNotes;
      }
      if (input.reviewRemarks !== undefined) {
        updateData.reviewRemarks = input.reviewRemarks;
      }
      if (input.isDuplicate !== undefined) {
        updateData.isDuplicate = input.isDuplicate;
      }
      if (input.validationStatus !== undefined) {
        updateData.validationStatus = input.validationStatus;
        updateData.verifiedBy = { connect: { id: ctx.user.id } };
        updateData.verifiedAt = new Date();
      }

      // Execute update and audit log in a transaction
      const [updatedReview] = await ctx.prisma.$transaction([
        ctx.prisma.ratingReview.update({
          where: { id: input.id },
          data: updateData,
          include: {
            up3: true,
            ulp: true,
            appVersion: true,
            verifiedBy: true,
          },
        }),
        ctx.prisma.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: "UPDATE_REVIEW_CURATIVE",
            entityType: "RatingReview",
            entityId: input.id,
            metadata: {
              actorRole: ctx.user.role,
              actorName: ctx.user.name,
              previous: {
                playstoreReviewerName: existing.playstoreReviewerName,
                up3Id: existing.up3Id,
                ulpId: existing.ulpId,
                validationStatus: existing.validationStatus,
                isDuplicate: existing.isDuplicate,
              },
              updatedFields: Object.keys(updateData),
            },
          },
        }),
      ]);

      return updatedReview;
    }),

  /**
   * 4. Bulk Update Reviews
   * Batch unit re-assignment, bulk status approval/rejection, or duplicate flag toggling.
   */
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
    .mutation(async ({ ctx, input }) => {
      // Validate UP3/ULP relationship if specified
      if (input.up3Id && input.ulpId) {
        const validUlp = await ctx.prisma.uLP.findFirst({
          where: { id: input.ulpId, up3Id: input.up3Id },
        });
        if (!validUlp) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ULP yang dipilih tidak valid untuk UP3 terkait.",
          });
        }
      }

      const updateData: Prisma.RatingReviewUncheckedUpdateManyInput = {};

      if (input.up3Id) updateData.up3Id = input.up3Id;
      if (input.ulpId) updateData.ulpId = input.ulpId;
      if (typeof input.isDuplicate === "boolean") updateData.isDuplicate = input.isDuplicate;
      if (input.validationStatus) {
        updateData.validationStatus = input.validationStatus;
        updateData.verifiedById = ctx.user.id;
        updateData.verifiedAt = new Date();
      }
      if (input.remarks) {
        updateData.reviewRemarks = input.remarks;
      }

      const [result] = await ctx.prisma.$transaction([
        ctx.prisma.ratingReview.updateMany({
          where: { id: { in: input.ids } },
          data: updateData,
        }),
        ctx.prisma.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: "BULK_UPDATE_REVIEWS",
            entityType: "RatingReview",
            metadata: {
              actorRole: ctx.user.role,
              targetCount: input.ids.length,
              targetIds: input.ids.slice(0, 50), // store up to 50 sample IDs
              updates: updateData,
            },
          },
        }),
      ]);

      return {
        success: true,
        count: result.count,
      };
    }),

  /**
   * 5. Retry OCR Processing for Single Review
   * Resets status to QUEUED and adds high-priority job to BullMQ ocrQueue.
   */
  retryOcr: operatorProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const review = await ctx.prisma.ratingReview.findUnique({
        where: { id: input.reviewId },
        select: {
          id: true,
          evidenceImagePath: true,
          playstoreReviewerName: true,
        },
      });

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ulasan tidak ditemukan.",
        });
      }

      await ctx.prisma.ratingReview.update({
        where: { id: input.reviewId },
        data: {
          ocrStatus: OcrProcessingStatus.QUEUED,
        },
      });

      const job = await ocrQueue.add(
        "process-ocr",
        {
          reviewId: review.id,
          evidenceImagePath: review.evidenceImagePath,
          expectedReviewerName: review.playstoreReviewerName,
        },
        {
          priority: 1, // Highest priority
          attempts: 3,
        }
      );

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: "RETRY_OCR",
          entityType: "RatingReview",
          entityId: review.id,
          metadata: {
            jobId: job.id,
            reviewerName: review.playstoreReviewerName,
          },
        },
      });

      return {
        success: true,
        jobId: job.id,
      };
    }),

  /**
   * 6. Bulk Retry OCR Processing
   * Enqueues multiple selected reviews to BullMQ ocrQueue.
   */
  bulkRetryOcr: operatorProcedure
    .input(
      z.object({
        reviewIds: z.array(z.string()).min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const reviews = await ctx.prisma.ratingReview.findMany({
        where: { id: { in: input.reviewIds } },
        select: {
          id: true,
          evidenceImagePath: true,
          playstoreReviewerName: true,
        },
      });

      if (reviews.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tidak ada ulasan yang ditemukan untuk diproses ulang.",
        });
      }

      // Mark all reviews as QUEUED in database
      await ctx.prisma.ratingReview.updateMany({
        where: { id: { in: input.reviewIds } },
        data: { ocrStatus: OcrProcessingStatus.QUEUED },
      });

      const jobs = reviews.map((r) => ({
        name: "process-ocr",
        data: {
          reviewId: r.id,
          evidenceImagePath: r.evidenceImagePath,
          expectedReviewerName: r.playstoreReviewerName,
        },
        opts: {
          priority: 1,
          attempts: 3,
        },
      }));

      await ocrQueue.addBulk(jobs);

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: "BULK_RETRY_OCR",
          entityType: "RatingReview",
          metadata: {
            totalEnqueued: jobs.length,
          },
        },
      });

      return {
        success: true,
        count: jobs.length,
      };
    }),

  /**
   * 7. Delete / Curative Action
   * Soft rejection (with reason) or permanent deletion (Super Admin exclusive).
   */
  delete: operatorProcedure
    .input(
      z.object({
        id: z.string(),
        mode: z.enum(["SOFT_REJECT", "PERMANENT"]),
        reason: z.string().min(3, "Alasan wajib diisi minimal 3 karakter"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const review = await ctx.prisma.ratingReview.findUnique({
        where: { id: input.id },
      });

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ulasan tidak ditemukan.",
        });
      }

      if (input.mode === "PERMANENT") {
        if (ctx.user.role !== Role.SUPER_ADMIN) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Hanya Super Admin yang berhak menghapus data ulasan secara permanen.",
          });
        }

        await ctx.prisma.$transaction([
          ctx.prisma.ratingReview.delete({
            where: { id: input.id },
          }),
          ctx.prisma.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: "PERMANENT_DELETE_REVIEW",
              entityType: "RatingReview",
              entityId: input.id,
              metadata: {
                reason: input.reason,
                deletedReviewName: review.playstoreReviewerName,
                deletedReviewDate: review.entryDate,
              },
            },
          }),
        ]);

        return { success: true, mode: "PERMANENT" };
      }

      // Mode SOFT_REJECT
      const updatedRemarks = review.reviewRemarks
        ? `${review.reviewRemarks} | Ditolak Kuratif: ${input.reason}`
        : `Ditolak Kuratif: ${input.reason}`;

      const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.ratingReview.update({
          where: { id: input.id },
          data: {
            validationStatus: ValidationStatus.REJECTED,
            reviewRemarks: updatedRemarks,
            verifiedById: ctx.user.id,
            verifiedAt: new Date(),
          },
        }),
        ctx.prisma.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: "SOFT_REJECT_REVIEW",
            entityType: "RatingReview",
            entityId: input.id,
            metadata: {
              reason: input.reason,
              previousStatus: review.validationStatus,
            },
          },
        }),
      ]);

      return { success: true, mode: "SOFT_REJECT", review: updated };
    }),

  /**
   * 8. Bulk Delete Reviews (Selected)
   * Soft reject in bulk or permanent deletion (Super Admin exclusive).
   */
  bulkDelete: operatorProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(500),
        mode: z.enum(["SOFT_REJECT", "PERMANENT"]),
        reason: z.string().min(3, "Alasan wajib diisi minimal 3 karakter"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.mode === "PERMANENT") {
        if (ctx.user.role !== Role.SUPER_ADMIN) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Hanya Super Admin yang berhak menghapus data ulasan secara permanen.",
          });
        }

        const [deleted] = await ctx.prisma.$transaction([
          ctx.prisma.ratingReview.deleteMany({
            where: { id: { in: input.ids } },
          }),
          ctx.prisma.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: "BULK_PERMANENT_DELETE_REVIEWS",
              entityType: "RatingReview",
              metadata: {
                count: input.ids.length,
                reason: input.reason,
                targetIds: input.ids.slice(0, 50),
              },
            },
          }),
        ]);

        return { success: true, mode: "PERMANENT", count: deleted.count };
      }

      // Mode SOFT_REJECT
      const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.ratingReview.updateMany({
          where: { id: { in: input.ids } },
          data: {
            validationStatus: ValidationStatus.REJECTED,
            reviewRemarks: `Ditolak Kuratif Massal: ${input.reason}`,
            verifiedById: ctx.user.id,
            verifiedAt: new Date(),
          },
        }),
        ctx.prisma.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: "BULK_SOFT_REJECT_REVIEWS",
            entityType: "RatingReview",
            metadata: {
              count: input.ids.length,
              reason: input.reason,
              targetIds: input.ids.slice(0, 50),
            },
          },
        }),
      ]);

      return { success: true, mode: "SOFT_REJECT", count: updated.count };
    }),

  /**
   * 9. Delete All Reviews (Purge / Reject All)
   * Purge all reviews or soft-reject all pending/approved reviews.
   */
  deleteAll: operatorProcedure
    .input(
      z.object({
        mode: z.enum(["SOFT_REJECT", "PERMANENT"]),
        reason: z.string().min(3, "Alasan wajib diisi minimal 3 karakter"),
        confirmText: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.confirmText !== "HAPUS SEMUA") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Konfirmasi teks harus tepat 'HAPUS SEMUA'.",
        });
      }

      if (input.mode === "PERMANENT") {
        if (ctx.user.role !== Role.SUPER_ADMIN && ctx.user.role !== Role.PEGAWAI) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Hanya Pegawai Operator atau Super Admin yang berhak menghapus data ulasan secara permanen.",
          });
        }

        const [deleted] = await ctx.prisma.$transaction([
          ctx.prisma.ratingReview.deleteMany({}),
          ctx.prisma.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: "PURGE_ALL_REVIEWS",
              entityType: "RatingReview",
              metadata: {
                reason: input.reason,
                purgedBy: ctx.user.name,
                purgedAt: new Date().toISOString(),
              },
            },
          }),
        ]);

        return { success: true, mode: "PERMANENT", count: deleted.count };
      }

      // Mode SOFT_REJECT: update all that are not REJECTED
      const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.ratingReview.updateMany({
          where: { validationStatus: { not: ValidationStatus.REJECTED } },
          data: {
            validationStatus: ValidationStatus.REJECTED,
            reviewRemarks: `Ditolak Kuratif Seluruh Data: ${input.reason}`,
            verifiedById: ctx.user.id,
            verifiedAt: new Date(),
          },
        }),
        ctx.prisma.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: "BULK_REJECT_ALL_REVIEWS",
            entityType: "RatingReview",
            metadata: {
              reason: input.reason,
              rejectedBy: ctx.user.name,
              rejectedAt: new Date().toISOString(),
            },
          },
        }),
      ]);

      return { success: true, mode: "SOFT_REJECT", count: updated.count };
    }),

  /**
   * 10. Get Filter Options
   * Helper to supply UP3, ULP, and AppVersion lists for filter bars and edit forms.
   */
  getFilterOptions: operatorProcedure.query(async ({ ctx }) => {
    const [up3s, ulps, appVersions] = await Promise.all([
      ctx.prisma.uP3.findMany({
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      }),
      ctx.prisma.uLP.findMany({
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true, up3Id: true },
      }),
      ctx.prisma.appVersion.findMany({
        where: { isActive: true },
        orderBy: { version: "desc" },
        select: { id: true, version: true },
      }),
    ]);

    return {
      up3s,
      ulps,
      appVersions,
    };
  }),
});
