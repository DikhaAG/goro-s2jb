import {
  OcrProcessingStatus,
  Prisma,
  PrismaClient,
  ReviewSource,
  Role,
  ValidationStatus,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { enqueueEvidenceVerification } from "./evidenceVerification";

export interface ReviewActor {
  id: string;
  name: string;
  username?: string;
  role: Role;
}

export interface ReviewWorkflowDeps {
  prisma: PrismaClient;
  stampReportsCache?: () => Promise<void>;
  enqueueVerification?: typeof enqueueEvidenceVerification;
}

export type ValidationStatusFilter =
  | "ALL"
  | "PENDING"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type OcrStatusFilter =
  | "ALL"
  | "QUEUED"
  | "DOWNLOADING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type ValidationZoneFilter = "ALL" | "GREEN" | "YELLOW" | "RED";
export type ReviewSourceFilter = "ALL" | "INTAKE" | "MIGRATION";
export type ReviewSortField =
  | "entryDate"
  | "timestamp"
  | "confidenceScore"
  | "playstoreReviewerName";

export interface ReviewListQueryInput {
  page?: number;
  pageSize?: number;
  search?: string;
  validationStatus?: ValidationStatusFilter;
  ocrStatus?: OcrStatusFilter;
  validationZone?: ValidationZoneFilter;
  source?: ReviewSourceFilter;
  up3Id?: string;
  ulpId?: string;
  isDuplicate?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: ReviewSortField;
  sortOrder?: "asc" | "desc";
}

export interface SubmitDecisionInput {
  reviewId: string;
  decision: "APPROVED" | "REJECTED";
  remarks?: string;
}

export interface UndoDecisionInput {
  reviewId: string;
  previousStatus?: "NEEDS_REVIEW" | "PENDING" | "APPROVED" | "REJECTED";
}

export interface UpdateReviewInput {
  id: string;
  playstoreReviewerName?: string;
  originalReviewerName?: string | null;
  up3Id?: string;
  ulpId?: string;
  entryDate?: string | Date;
  appVersionId?: string;
  reviewerCategory?: string;
  fieldNotes?: string | null;
  reviewRemarks?: string | null;
  validationStatus?: ValidationStatus;
  isDuplicate?: boolean;
}

export interface BulkUpdateReviewsInput {
  ids: string[];
  up3Id?: string;
  ulpId?: string;
  validationStatus?: ValidationStatus;
  isDuplicate?: boolean;
  remarks?: string;
}

export interface DeleteReviewInput {
  id: string;
  mode: "SOFT_REJECT" | "PERMANENT";
  reason: string;
}

export interface BulkDeleteReviewsInput {
  ids: string[];
  mode: "SOFT_REJECT" | "PERMANENT";
  reason: string;
}

export interface DeleteAllReviewsInput {
  mode: "SOFT_REJECT" | "PERMANENT";
  reason: string;
  confirmText: string;
}

interface DecisionSnapshotMetadata {
  previousStatus?: string;
  previousVerifiedById?: string | null;
  previousVerifiedAt?: string | null;
  previousRemarks?: string | null;
}

const REPORTS_CACHE_KEY = "reports:last_update_timestamp";

const VALID_VALIDATION_STATUSES = new Set<string>(
  Object.values(ValidationStatus)
);

const duplicateOfSummarySelect = {
  id: true,
  playstoreReviewerName: true,
  originalReviewerName: true,
  entryDate: true,
  timestamp: true,
  source: true,
  createdAt: true,
  evidenceImagePath: true,
  evidenceImageHash: true,
  extractedOcrText: true,
  validationStatus: true,
  confidenceScore: true,
  up3: { select: { id: true, name: true } },
  ulp: { select: { id: true, name: true } },
} as const;

/**
 * Builds a non-critical Redis cache-stamp adapter from a Redis-like client.
 */
export function createRedisCacheStampAdapter(redisClient?: {
  set?: (key: string, value: string) => Promise<unknown>;
  status?: string;
} | null): () => Promise<void> {
  if (!redisClient || typeof redisClient.set !== "function") {
    return async () => {};
  }

  return async () => {
    try {
      if (redisClient.status === "end") return;
      await redisClient.set!(REPORTS_CACHE_KEY, Date.now().toString());
    } catch {
      // Non-critical cache stamp
    }
  };
}

/**
 * Composes RatingReview filter conditions without overwriting `where.OR`
 * when both text search and RED validation zone filters are active.
 */
export function buildReviewWhereClause(
  input: ReviewListQueryInput
): Prisma.RatingReviewWhereInput {
  const where: Prisma.RatingReviewWhereInput = {};
  const andConditions: Prisma.RatingReviewWhereInput[] = [];

  if (input.search && input.search.trim().length > 0) {
    const query = input.search.trim();
    andConditions.push({
      OR: [
        { playstoreReviewerName: { contains: query, mode: "insensitive" } },
        { originalReviewerName: { contains: query, mode: "insensitive" } },
        { extractedOcrText: { contains: query, mode: "insensitive" } },
        { fieldNotes: { contains: query, mode: "insensitive" } },
        { id: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  if (input.validationStatus && input.validationStatus !== "ALL") {
    where.validationStatus = input.validationStatus as ValidationStatus;
  }

  if (input.ocrStatus && input.ocrStatus !== "ALL") {
    where.ocrStatus = input.ocrStatus as OcrProcessingStatus;
  }

  if (input.source && input.source !== "ALL") {
    where.source = input.source as ReviewSource;
  }

  if (input.validationZone && input.validationZone !== "ALL") {
    if (input.validationZone === "GREEN") {
      where.confidenceScore = { gte: 90.0 };
    } else if (input.validationZone === "YELLOW") {
      where.confidenceScore = { gte: 70.0, lt: 90.0 };
    } else if (input.validationZone === "RED") {
      andConditions.push({
        OR: [
          { confidenceScore: { lt: 70.0 } },
          { ocrStatus: OcrProcessingStatus.FAILED },
        ],
      });
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  if (input.up3Id) {
    where.up3Id = input.up3Id;
  }
  if (input.ulpId) {
    where.ulpId = input.ulpId;
  }
  if (typeof input.isDuplicate === "boolean") {
    where.isDuplicate = input.isDuplicate;
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

  return where;
}

async function assertValidUnitPair(
  db: PrismaClient,
  up3Id: string | undefined,
  ulpId: string | undefined,
  errorMessage: string
): Promise<void> {
  if (!up3Id || !ulpId) return;
  const validUlp = await db.uLP.findFirst({
    where: { id: ulpId, up3Id },
  });
  if (!validUlp) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errorMessage,
    });
  }
}

/**
 * Deep module encapsulating Review Triage & Management ("Triase Ulasan")
 * query composition, state transitions, AuditLog recording, and report cache stamping.
 */
export function createReviewWorkflow(deps: ReviewWorkflowDeps) {
  const {
    prisma,
    stampReportsCache = async () => {},
    enqueueVerification = enqueueEvidenceVerification,
  } = deps;

  return {
    async getList(rawInput: ReviewListQueryInput = {}) {
      const page = rawInput.page ?? 1;
      const pageSize = rawInput.pageSize ?? 25;
      const sortBy = rawInput.sortBy ?? "entryDate";
      const sortOrder = rawInput.sortOrder ?? "desc";

      const where = buildReviewWhereClause(rawInput);
      const skip = (page - 1) * pageSize;

      const [
        totalCount,
        items,
        totalApproved,
        totalRejected,
        totalPending,
        totalNeedsReview,
        totalActiveOcr,
        totalDuplicates,
      ] = await Promise.all([
        prisma.ratingReview.count({ where }),
        prisma.ratingReview.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            up3: { select: { id: true, code: true, name: true } },
            ulp: { select: { id: true, code: true, name: true } },
            appVersion: { select: { id: true, version: true } },
            verifiedBy: { select: { id: true, name: true, role: true } },
            duplicateOf: { select: duplicateOfSummarySelect },
          },
        }),
        prisma.ratingReview.count({
          where: { ...where, validationStatus: ValidationStatus.APPROVED },
        }),
        prisma.ratingReview.count({
          where: { ...where, validationStatus: ValidationStatus.REJECTED },
        }),
        prisma.ratingReview.count({
          where: { ...where, validationStatus: ValidationStatus.PENDING },
        }),
        prisma.ratingReview.count({
          where: { ...where, validationStatus: ValidationStatus.NEEDS_REVIEW },
        }),
        prisma.ratingReview.count({
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
        prisma.ratingReview.count({
          where: { ...where, isDuplicate: true },
        }),
      ]);

      return {
        items,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
        page,
        pageSize,
        kpi: {
          total: totalCount,
          approved: totalApproved,
          rejected: totalRejected,
          pending: totalPending,
          needsReview: totalNeedsReview,
          activeOcr: totalActiveOcr,
          duplicates: totalDuplicates,
        },
      };
    },

    async getDetail(id: string) {
      const review = await prisma.ratingReview.findUnique({
        where: { id },
        include: {
          up3: true,
          ulp: true,
          appVersion: true,
          duplicateOf: { select: duplicateOfSummarySelect },
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
          message: `Ulasan dengan ID ${id} tidak ditemukan.`,
        });
      }

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: "RatingReview",
          entityId: id,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          user: {
            select: { id: true, name: true, role: true, username: true },
          },
        },
      });

      return { review, auditLogs };
    },

    async submitDecision(input: SubmitDecisionInput, actor: ReviewActor) {
      const existing = await prisma.ratingReview.findUnique({
        where: { id: input.reviewId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Ulasan dengan ID ${input.reviewId} tidak ditemukan.`,
        });
      }

      const defaultRemark =
        input.decision === "APPROVED"
          ? "Disetujui oleh Operator"
          : "Ditolak oleh Operator";
      const appliedRemarks = input.remarks || defaultRemark;

      const [updated] = await prisma.$transaction([
        prisma.ratingReview.update({
          where: { id: input.reviewId },
          data: {
            validationStatus: input.decision as ValidationStatus,
            verifiedById: actor.id,
            verifiedAt: new Date(),
            reviewRemarks: appliedRemarks,
          },
          include: {
            verifiedBy: {
              select: { id: true, name: true, username: true },
            },
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: actor.id,
            action: "SUBMIT_REVIEW_DECISION",
            entityType: "RatingReview",
            entityId: input.reviewId,
            metadata: {
              actorRole: actor.role,
              actorName: actor.name,
              decision: input.decision,
              remarks: appliedRemarks,
              previousStatus: existing.validationStatus,
              previousVerifiedById: existing.verifiedById ?? null,
              previousVerifiedAt: existing.verifiedAt
                ? new Date(existing.verifiedAt).toISOString()
                : null,
              previousRemarks: existing.reviewRemarks ?? null,
            },
          },
        }),
      ]);

      await stampReportsCache();
      return updated;
    },

    async undoDecision(input: UndoDecisionInput, actor: ReviewActor) {
      const existing = await prisma.ratingReview.findUnique({
        where: { id: input.reviewId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Ulasan dengan ID ${input.reviewId} tidak ditemukan.`,
        });
      }

      const recentDecisionLogs = await prisma.auditLog.findMany({
        where: {
          entityType: "RatingReview",
          entityId: input.reviewId,
          action: "SUBMIT_REVIEW_DECISION",
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      });

      const snapshot = (recentDecisionLogs[0]?.metadata ??
        null) as DecisionSnapshotMetadata | null;

      const snapshotStatus =
        snapshot?.previousStatus &&
        VALID_VALIDATION_STATUSES.has(snapshot.previousStatus)
          ? (snapshot.previousStatus as ValidationStatus)
          : null;

      const restoredStatus: ValidationStatus =
        snapshotStatus ??
        ((input.previousStatus as ValidationStatus | undefined) ??
          ValidationStatus.NEEDS_REVIEW);

      const isPreDecisionStatus =
        restoredStatus === ValidationStatus.PENDING ||
        restoredStatus === ValidationStatus.NEEDS_REVIEW;

      const restoredVerifiedById = snapshotStatus
        ? (snapshot?.previousVerifiedById ?? null)
        : isPreDecisionStatus
        ? null
        : (existing.verifiedById ?? null);

      const restoredVerifiedAt = snapshotStatus
        ? snapshot?.previousVerifiedAt
          ? new Date(snapshot.previousVerifiedAt)
          : null
        : isPreDecisionStatus
        ? null
        : (existing.verifiedAt ?? null);

      const restoredRemarks =
        snapshotStatus && snapshot?.previousRemarks !== undefined
          ? snapshot.previousRemarks
          : "Keputusan dibatalkan (Undo)";

      const [reverted] = await prisma.$transaction([
        prisma.ratingReview.update({
          where: { id: input.reviewId },
          data: {
            validationStatus: restoredStatus,
            verifiedById: restoredVerifiedById,
            verifiedAt: restoredVerifiedAt,
            reviewRemarks: restoredRemarks,
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: actor.id,
            action: "UNDO_REVIEW_DECISION",
            entityType: "RatingReview",
            entityId: input.reviewId,
            metadata: {
              actorRole: actor.role,
              actorName: actor.name,
              revertedFromStatus: existing.validationStatus,
              restoredStatus,
              usedServerSnapshot: Boolean(snapshotStatus),
            },
          },
        }),
      ]);

      await stampReportsCache();
      return reverted;
    },

    async update(input: UpdateReviewInput, actor: ReviewActor) {
      const existing = await prisma.ratingReview.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Ulasan dengan ID ${input.id} tidak ditemukan.`,
        });
      }

      await assertValidUnitPair(
        prisma,
        input.up3Id,
        input.ulpId,
        "ULP yang dipilih tidak berada di bawah UP3 terkait."
      );

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
        if (!input.isDuplicate) {
          updateData.duplicateOf = { disconnect: true };
        }
      }
      if (input.validationStatus !== undefined) {
        updateData.validationStatus = input.validationStatus;
        updateData.verifiedBy = { connect: { id: actor.id } };
        updateData.verifiedAt = new Date();
      }

      const [updatedReview] = await prisma.$transaction([
        prisma.ratingReview.update({
          where: { id: input.id },
          data: updateData,
          include: {
            up3: true,
            ulp: true,
            appVersion: true,
            verifiedBy: true,
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: actor.id,
            action: "UPDATE_REVIEW_CURATIVE",
            entityType: "RatingReview",
            entityId: input.id,
            metadata: {
              actorRole: actor.role,
              actorName: actor.name,
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

      await stampReportsCache();
      return updatedReview;
    },

    async bulkUpdate(input: BulkUpdateReviewsInput, actor: ReviewActor) {
      await assertValidUnitPair(
        prisma,
        input.up3Id,
        input.ulpId,
        "ULP yang dipilih tidak valid untuk UP3 terkait."
      );

      const updateData: Prisma.RatingReviewUncheckedUpdateManyInput = {};

      if (input.up3Id) updateData.up3Id = input.up3Id;
      if (input.ulpId) updateData.ulpId = input.ulpId;
      if (typeof input.isDuplicate === "boolean") {
        updateData.isDuplicate = input.isDuplicate;
      }
      if (input.validationStatus) {
        updateData.validationStatus = input.validationStatus;
        updateData.verifiedById = actor.id;
        updateData.verifiedAt = new Date();
      }
      if (input.remarks) {
        updateData.reviewRemarks = input.remarks;
      }

      const [result] = await prisma.$transaction([
        prisma.ratingReview.updateMany({
          where: { id: { in: input.ids } },
          data: updateData,
        }),
        prisma.auditLog.create({
          data: {
            userId: actor.id,
            action: "BULK_UPDATE_REVIEWS",
            entityType: "RatingReview",
            metadata: {
              actorRole: actor.role,
              targetCount: input.ids.length,
              targetIds: input.ids.slice(0, 50),
              updates: updateData,
            },
          },
        }),
      ]);

      await stampReportsCache();
      return {
        success: true,
        count: result.count,
      };
    },

    async retryOcr(reviewId: string, actor: ReviewActor) {
      const review = await prisma.ratingReview.findUnique({
        where: { id: reviewId },
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

      const enqueueResult = await enqueueVerification(
        {
          reviewId: review.id,
          evidenceImagePath: review.evidenceImagePath,
          expectedReviewerName: review.playstoreReviewerName,
        },
        {
          priority: 1,
          attempts: 3,
          prismaClient: prisma,
        }
      );

      const jobId = enqueueResult.jobIds[0];

      await prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: "RETRY_OCR",
          entityType: "RatingReview",
          entityId: review.id,
          metadata: {
            jobId,
            reviewerName: review.playstoreReviewerName,
          },
        },
      });

      return {
        success: true,
        jobId,
      };
    },

    async bulkRetryOcr(reviewIds: string[], actor: ReviewActor) {
      const reviews = await prisma.ratingReview.findMany({
        where: { id: { in: reviewIds } },
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

      const targets = reviews.map((r) => ({
        reviewId: r.id,
        evidenceImagePath: r.evidenceImagePath,
        expectedReviewerName: r.playstoreReviewerName,
      }));

      await enqueueVerification(targets, {
        priority: 1,
        attempts: 3,
        prismaClient: prisma,
      });

      await prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: "BULK_RETRY_OCR",
          entityType: "RatingReview",
          metadata: {
            totalEnqueued: targets.length,
          },
        },
      });

      return {
        success: true,
        count: targets.length,
      };
    },

    async delete(input: DeleteReviewInput, actor: ReviewActor) {
      const review = await prisma.ratingReview.findUnique({
        where: { id: input.id },
      });

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ulasan tidak ditemukan.",
        });
      }

      if (input.mode === "PERMANENT") {
        if (actor.role !== Role.SUPER_ADMIN) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Hanya Super Admin yang berhak menghapus data ulasan secara permanen.",
          });
        }

        await prisma.$transaction([
          prisma.ratingReview.delete({
            where: { id: input.id },
          }),
          prisma.auditLog.create({
            data: {
              userId: actor.id,
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

        await stampReportsCache();
        return { success: true as const, mode: "PERMANENT" as const };
      }

      const updatedRemarks = review.reviewRemarks
        ? `${review.reviewRemarks} | Ditolak Kuratif: ${input.reason}`
        : `Ditolak Kuratif: ${input.reason}`;

      const [updated] = await prisma.$transaction([
        prisma.ratingReview.update({
          where: { id: input.id },
          data: {
            validationStatus: ValidationStatus.REJECTED,
            reviewRemarks: updatedRemarks,
            verifiedById: actor.id,
            verifiedAt: new Date(),
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: actor.id,
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

      await stampReportsCache();
      return {
        success: true as const,
        mode: "SOFT_REJECT" as const,
        review: updated,
      };
    },

    async bulkDelete(input: BulkDeleteReviewsInput, actor: ReviewActor) {
      if (input.mode === "PERMANENT") {
        if (actor.role !== Role.SUPER_ADMIN) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Hanya Super Admin yang berhak menghapus data ulasan secara permanen.",
          });
        }

        const [deleted] = await prisma.$transaction([
          prisma.ratingReview.deleteMany({
            where: { id: { in: input.ids } },
          }),
          prisma.auditLog.create({
            data: {
              userId: actor.id,
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

        await stampReportsCache();
        return {
          success: true as const,
          mode: "PERMANENT" as const,
          count: deleted.count,
        };
      }

      const [updated] = await prisma.$transaction([
        prisma.ratingReview.updateMany({
          where: { id: { in: input.ids } },
          data: {
            validationStatus: ValidationStatus.REJECTED,
            reviewRemarks: `Ditolak Kuratif Massal: ${input.reason}`,
            verifiedById: actor.id,
            verifiedAt: new Date(),
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: actor.id,
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

      await stampReportsCache();
      return {
        success: true as const,
        mode: "SOFT_REJECT" as const,
        count: updated.count,
      };
    },

    async deleteAll(input: DeleteAllReviewsInput, actor: ReviewActor) {
      if (input.confirmText !== "HAPUS SEMUA") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Konfirmasi teks harus tepat 'HAPUS SEMUA'.",
        });
      }

      if (input.mode === "PERMANENT") {
        if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.PEGAWAI) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Hanya Pegawai Operator atau Super Admin yang berhak menghapus data ulasan secara permanen.",
          });
        }

        const [deleted] = await prisma.$transaction([
          prisma.ratingReview.deleteMany({}),
          prisma.auditLog.create({
            data: {
              userId: actor.id,
              action: "PURGE_ALL_REVIEWS",
              entityType: "RatingReview",
              metadata: {
                reason: input.reason,
                purgedBy: actor.name,
                purgedAt: new Date().toISOString(),
              },
            },
          }),
        ]);

        await stampReportsCache();
        return {
          success: true as const,
          mode: "PERMANENT" as const,
          count: deleted.count,
        };
      }

      const [updated] = await prisma.$transaction([
        prisma.ratingReview.updateMany({
          where: { validationStatus: { not: ValidationStatus.REJECTED } },
          data: {
            validationStatus: ValidationStatus.REJECTED,
            reviewRemarks: `Ditolak Kuratif Seluruh Data: ${input.reason}`,
            verifiedById: actor.id,
            verifiedAt: new Date(),
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: actor.id,
            action: "BULK_REJECT_ALL_REVIEWS",
            entityType: "RatingReview",
            metadata: {
              reason: input.reason,
              rejectedBy: actor.name,
              rejectedAt: new Date().toISOString(),
            },
          },
        }),
      ]);

      await stampReportsCache();
      return {
        success: true as const,
        mode: "SOFT_REJECT" as const,
        count: updated.count,
      };
    },

    async getFilterOptions() {
      const [up3s, ulps, appVersions] = await Promise.all([
        prisma.uP3.findMany({
          orderBy: { name: "asc" },
          select: { id: true, code: true, name: true },
        }),
        prisma.uLP.findMany({
          orderBy: { name: "asc" },
          select: { id: true, code: true, name: true, up3Id: true },
        }),
        prisma.appVersion.findMany({
          where: { isActive: true },
          orderBy: { version: "desc" },
          select: { id: true, version: true },
        }),
      ]);

      return { up3s, ulps, appVersions };
    },
  };
}
