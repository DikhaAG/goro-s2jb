import { ReviewSource, type PrismaClient } from "@prisma/client";
import { detectImageMimeFromBuffer } from "./evidenceAcquisition";
import { enqueueEvidenceVerification } from "./evidenceVerification";
import { isValidUnitPair } from "./unitHierarchy";
import { discardEvidenceImage, storeEvidenceImage, type EvidenceImageType } from "@/lib/storage";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/validators/intake";

export interface IntakeOfficer {
  id: string;
  up3Id?: string | null;
  ulpId?: string | null;
}

export interface EvidenceSubmission {
  up3Id: string;
  ulpId: string;
  playstoreReviewerName: string;
  /** YYYY-MM-DD */
  entryDate: string;
  appVersionId: string;
  originalReviewerName?: string;
  reviewerCategory?: string;
  fieldNotes?: string;
  evidence: Buffer;
}

export type IntakeRejection =
  | { ok: false; reason: "quota-exceeded"; retryAfterSeconds: number }
  | { ok: false; reason: "invalid-file" }
  | { ok: false; reason: "invalid-unit-pair" }
  /** `cause` is for server logs only. It carries infrastructure detail that officers must not see. */
  | { ok: false; reason: "queue-unavailable"; cause: unknown };

export type IntakeResult = { ok: true; reviewId: string; evidencePath: string } | IntakeRejection;

export interface EvidenceIntakeDeps {
  prisma: Pick<PrismaClient, "ratingReview" | "uLP">;
  storageRoot: string;
  uploadQuota: { consume(officerId: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> };
  enqueueVerification?: typeof enqueueEvidenceVerification;
}

/**
 * Pengumpulan Eviden: accepts or rejects an Eviden Ulasan submitted by a Petugas Lapangan.
 */
export function createEvidenceIntake(deps: EvidenceIntakeDeps) {
  const { prisma, storageRoot, uploadQuota, enqueueVerification = enqueueEvidenceVerification } = deps;

  /** The bytes decide the type. Client-declared MIME types and filenames are never trusted. */
  function detectEvidenceType(bytes: Buffer): EvidenceImageType | null {
    if (bytes.length === 0 || bytes.length > MAX_FILE_SIZE_BYTES) return null;
    const mime = detectImageMimeFromBuffer(bytes);
    return mime && ACCEPTED_IMAGE_TYPES.includes(mime) ? mime : null;
  }

  return {
    async submit(officer: IntakeOfficer, input: EvidenceSubmission): Promise<IntakeResult> {
      const quota = await uploadQuota.consume(officer.id);
      if (!quota.allowed) {
        return { ok: false, reason: "quota-exceeded", retryAfterSeconds: quota.retryAfterSeconds };
      }

      const mime = detectEvidenceType(input.evidence);
      if (!mime) return { ok: false, reason: "invalid-file" };

      if (!(await isValidUnitPair(prisma, input.up3Id, input.ulpId))) {
        return { ok: false, reason: "invalid-unit-pair" };
      }

      const evidencePath = await storeEvidenceImage(storageRoot, input.evidence, mime, input.entryDate);

      let review: { id: string };
      try {
        review = await prisma.ratingReview.create({
          data: {
            timestamp: new Date(),
            up3Id: input.up3Id,
            ulpId: input.ulpId,
            playstoreReviewerName: input.playstoreReviewerName,
            entryDate: new Date(input.entryDate),
            evidenceImagePath: evidencePath,
            appVersionId: input.appVersionId,
            originalReviewerName: input.originalReviewerName || input.playstoreReviewerName,
            reviewerCategory: input.reviewerCategory || "Pelanggan",
            fieldNotes: input.fieldNotes || null,
            validationStatus: "PENDING",
            isDuplicate: false,
            source: ReviewSource.INTAKE,
            submittedById: officer.id,
          },
        });
      } catch (err) {
        await discardEvidenceImage(storageRoot, evidencePath);
        throw err;
      }

      try {
        await enqueueVerification(
          {
            reviewId: review.id,
            evidenceImagePath: evidencePath,
            expectedReviewerName: input.playstoreReviewerName,
          },
          { priority: 1, markQueuedInDb: false, prismaClient: prisma }
        );
      } catch (cause) {
        await prisma.ratingReview.delete({ where: { id: review.id } }).catch(() => {});
        await discardEvidenceImage(storageRoot, evidencePath);
        return { ok: false, reason: "queue-unavailable", cause };
      }

      return { ok: true, reviewId: review.id, evidencePath };
    },
  };
}
