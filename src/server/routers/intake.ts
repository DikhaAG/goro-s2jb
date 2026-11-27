import { TRPCError } from "@trpc/server";
import { router, fieldProcedure } from "../trpc";
import { intakeReviewSchema } from "@/lib/validators/intake";
import { BASE_UPLOAD_DIR } from "@/lib/storage";
import { rateLimits } from "@/server/rateLimits/live";
import { createEvidenceIntake, type IntakeRejection } from "../services/evidenceIntake";

/** Accepts a data URL (`data:image/jpeg;base64,...`) or bare base64. */
function decodeEvidence(base64OrDataUrl: string): Buffer {
  const payload = base64OrDataUrl.startsWith("data:")
    ? base64OrDataUrl.slice(base64OrDataUrl.indexOf(",") + 1)
    : base64OrDataUrl;
  return Buffer.from(payload, "base64");
}

function toTrpcError(rejection: IntakeRejection): TRPCError {
  switch (rejection.reason) {
    case "quota-exceeded":
      return new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Batas frekuensi unggahan terlampaui (maksimal 60 berkas per menit).",
      });
    case "invalid-file":
      return new TRPCError({
        code: "BAD_REQUEST",
        message: "File eviden harus berupa gambar JPG/PNG/WebP dengan ukuran maksimal 5 MB",
      });
    case "invalid-unit-pair":
      return new TRPCError({
        code: "BAD_REQUEST",
        message: "ULP yang dipilih tidak berada di bawah UP3 terkait.",
      });
    case "queue-unavailable":
      console.error("Pengumpulan Eviden: Verifikasi Eviden could not be queued:", rejection.cause);
      return new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Sistem verifikasi sedang tidak tersedia, entri dibatalkan. Silakan coba lagi.",
      });
  }
}

export const intakeRouter = router({
  submitReview: fieldProcedure.input(intakeReviewSchema).mutation(async ({ ctx, input }) => {
    const startTime = Date.now();
    const intake = createEvidenceIntake({
      prisma: ctx.prisma,
      storageRoot: BASE_UPLOAD_DIR,
      uploadQuota: rateLimits.uploadQuota,
    });

    const { evidenceImageBase64, ...fields } = input;
    let result;
    try {
      result = await intake.submit(ctx.user, { ...fields, evidence: decodeEvidence(evidenceImageBase64) });
    } catch (err) {
      console.error("Pengumpulan Eviden failed unexpectedly:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Gagal menyimpan ulasan eviden lapangan",
      });
    }

    if (!result.ok) throw toTrpcError(result);

    return {
      success: true,
      reviewId: result.reviewId,
      evidencePath: result.evidencePath,
      latencyMs: Date.now() - startTime,
      message: "Eviden rating berhasil dicatat dan sedang diverifikasi sistem",
    };
  }),
});
