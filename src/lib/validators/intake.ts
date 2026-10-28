import { z } from "zod";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const intakeReviewSchema = z.object({
  up3Id: z.string().min(1, "UP3 wajib dipilih"),
  ulpId: z.string().min(1, "ULP wajib dipilih"),
  playstoreReviewerName: z
    .string()
    .trim()
    .min(1, "Nama pengulas Play Store wajib diisi")
    .max(150, "Nama pengulas maksimal 150 karakter"),
  entryDate: z
    .string()
    .min(1, "Tanggal entri wajib diisi")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  appVersionId: z.string().min(1, "Versi PLN Mobile wajib dipilih"),
  originalReviewerName: z.string().trim().max(150).optional().default(""),
  reviewerCategory: z.string().trim().default("Pelanggan"),
  fieldNotes: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().default(""),
  evidenceImageBase64: z
    .string()
    .min(1, "Foto bukti eviden wajib diunggah")
    .refine(
      (data) => {
        // Basic check for data URL or base64 length
        if (data.startsWith("data:")) {
          const match = data.match(/^data:([^;]+);base64,(.+)$/);
          if (!match) return false;
          const mime = match[1];
          if (!ACCEPTED_IMAGE_TYPES.includes(mime)) return false;
          // Approximate size from base64 length
          const base64Content = match[2];
          const approxSize = (base64Content.length * 3) / 4;
          return approxSize <= MAX_FILE_SIZE_BYTES;
        }
        return true;
      },
      {
        message: "File eviden harus berupa gambar JPG/PNG/WebP dengan ukuran maksimal 5 MB",
      }
    ),
  evidenceFilename: z.string().optional().default("eviden.jpg"),
});

export type IntakeReviewInput = z.infer<typeof intakeReviewSchema>;
