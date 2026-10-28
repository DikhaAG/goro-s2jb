import { router, fieldProcedure } from "../trpc";
import { intakeReviewSchema } from "@/lib/validators/intake";
import { saveEvidenceFile } from "@/lib/storage";
import { ocrQueue } from "../queues/ocrQueue";
import { TRPCError } from "@trpc/server";
import { checkUploadRateLimit } from "@/lib/rateLimit";
import { logAuditEvent } from "../services/auditService";

export const intakeRouter = router({
  submitReview: fieldProcedure
    .input(intakeReviewSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Anti-Flooding Upload Rate Limiter (max 60/min per field officer)
      const rateLimitRes = await checkUploadRateLimit(ctx.user.id);
      if (!rateLimitRes.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Batas frekuensi unggahan terlampaui (maksimal 60 berkas per menit).",
        });
      }

      const startTime = Date.now();

      try {
        // 1. Decode base64 evidence image
        let buffer: Buffer;
        let mimeType = "image/jpeg";
        let rawFilename = input.evidenceFilename || "eviden.jpg";

        if (input.evidenceImageBase64.startsWith("data:")) {
          const parts = input.evidenceImageBase64.split(";base64,");
          const mimeMatch = parts[0].match(/data:(.*)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
          buffer = Buffer.from(parts[1], "base64");
        } else {
          buffer = Buffer.from(input.evidenceImageBase64, "base64");
        }

        // 2. Save physical file to local storage (uploads/evidence/YYYY/MM/DD)
        const entryDateObj = new Date(input.entryDate);
        const { relativePath, absolutePath } = await saveEvidenceFile(
          buffer,
          rawFilename,
          mimeType,
          entryDateObj
        );

        // 3. Insert record to database with PENDING status
        const review = await ctx.prisma.ratingReview.create({
          data: {
            timestamp: new Date(),
            up3Id: input.up3Id,
            ulpId: input.ulpId,
            playstoreReviewerName: input.playstoreReviewerName,
            entryDate: entryDateObj,
            evidenceImagePath: relativePath,
            appVersionId: input.appVersionId,
            originalReviewerName: input.originalReviewerName || input.playstoreReviewerName,
            reviewerCategory: input.reviewerCategory || "Pelanggan",
            fieldNotes: input.fieldNotes || null,
            validationStatus: "PENDING",
            isDuplicate: false,
            submittedById: ctx.user?.id || null,
          },
        });

        // 4. Asynchronously dispatch job to OCR BullMQ Queue
        await ocrQueue.add(
          "process-ocr",
          {
            reviewId: review.id,
            evidenceImagePath: absolutePath,
            expectedReviewerName: input.playstoreReviewerName,
          },
          {
            priority: 1, // High priority for fresh field submissions
          }
        );

        const latencyMs = Date.now() - startTime;

        return {
          success: true,
          reviewId: review.id,
          evidencePath: relativePath,
          latencyMs,
          message: "Eviden rating berhasil dicatat dan sedang diverifikasi sistem",
        };
      } catch (err: any) {
        console.error("Error submitting field review:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Gagal menyimpan ulasan eviden lapangan",
        });
      }
    }),
});
