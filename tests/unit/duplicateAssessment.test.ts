import { describe, it, expect, vi } from "vitest";
import {
  assessDuplicateBatch,
  assessDuplicatePair,
  DEFAULT_DUPLICATE_HASH_THRESHOLD,
  extractGoogleDriveFileId,
  normalizeDuplicateSourcePreview,
} from "@/lib/duplicateAssessment";

describe("Multimodal Duplicate Assessment (duplicateAssessment deep module)", () => {
  describe("assessDuplicatePair", () => {
    it("confirms duplicate for matching pHash and identical or minor-typo reviewer name", () => {
      const result = assessDuplicatePair(
        {
          evidenceImageHash: "8ecd433b9191b1b9",
          playstoreReviewerName: "Ahmad Fauzi",
          extractedOcrText: "Aplikasi PLN Mobile membantu bayar listrik",
        },
        {
          evidenceImageHash: "8ecd433b9191b1b9",
          playstoreReviewerName: "Achmad Fauzi",
          extractedOcrText: "Aplikasi membantu",
        }
      );

      expect(result.hammingDistance).toBe(0);
      expect(result.visualSimilarity).toBe(100);
      expect(result.isVisualMatch).toBe(true);
      expect(result.isReviewerMatch).toBe(true);
      expect(result.reviewerSimilarity).toBeGreaterThanOrEqual(75);
      expect(result.verdict).toBe("CONFIRMED_DUPLICATE");
    });

    it("detects Play Store UI template collision when visual matches but reviewer and filtered text differ", () => {
      const result = assessDuplicatePair(
        {
          evidenceImageHash: "aa853f6a4a5af207",
          playstoreReviewerName: "Cella Adinda",
          extractedOcrText:
            "PLN Mobile aplikasi ulasan anda terakhir diupdate sangat membantu saat diluar kota",
          evidenceImagePath: "https://drive.google.com/uc?id=1AbCdefGHIjklmNOPqrsTUVwxYZ12345",
        },
        {
          evidenceImageHash: "aa853f6a4a5af206",
          playstoreReviewerName: "Cia Marsha",
          extractedOcrText:
            "PLN Mobile aplikasi ulasan anda terakhir diupdate fitur lengkap memudahkan pembelian token",
          evidenceImagePath: "https://drive.google.com/uc?id=9ZyXwvUTSrqPONmlkjIHGfedCBA54321",
        }
      );

      expect(result.hammingDistance).toBe(1);
      expect(result.visualSimilarity).toBeGreaterThanOrEqual(90);
      expect(result.isVisualMatch).toBe(true);
      expect(result.isTextMatch).toBe(false);
      expect(result.isReviewerMatch).toBe(false);
      expect(result.verdict).toBe("TEMPLATE_COLLISION");
    });

    it("confirms duplicate when both records reference the same Google Drive file ID", () => {
      const result = assessDuplicatePair(
        {
          evidenceImageHash: "0000000000000000",
          playstoreReviewerName: "Pengulas Satu",
          extractedOcrText: "Teks berbeda jauh",
          evidenceImagePath:
            "https://drive.google.com/file/d/1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp/view?usp=sharing",
        },
        {
          evidenceImageHash: "ffffffffffffffff",
          playstoreReviewerName: "Orang Lain",
          extractedOcrText: "Komentar lain",
          evidenceImagePath:
            "https://drive.google.com/open?id=1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp",
        }
      );

      expect(result.isSameDriveFile).toBe(true);
      expect(result.verdict).toBe("CONFIRMED_DUPLICATE");
      expect(result.matchReason).toBe("Berkas Eviden Identik");
    });

    it("returns DISTINCT for visually dissimilar hashes or missing inputs", () => {
      const inverted = assessDuplicatePair(
        {
          evidenceImageHash: "0000000000000000",
          playstoreReviewerName: "Budi",
          extractedOcrText: "Bagus",
        },
        {
          evidenceImageHash: "ffffffffffffffff",
          playstoreReviewerName: "Budi",
          extractedOcrText: "Bagus",
        }
      );

      expect(inverted.hammingDistance).toBe(64);
      expect(inverted.visualSimilarity).toBe(0);
      expect(inverted.isVisualMatch).toBe(false);
      expect(inverted.verdict).toBe("DISTINCT");

      const missing = assessDuplicatePair(null, {
        evidenceImageHash: "8ecd433b9191b1b9",
      });
      expect(missing.hammingDistance).toBe(64);
      expect(missing.visualSimilarity).toBe(0);
      expect(missing.verdict).toBe("DISTINCT");
    });
  });

  describe("assessDuplicateBatch", () => {
    it("dismisses template collisions and finds the later confirmed duplicate with root duplicateOfId", () => {
      const onDismissed = vi.fn();

      const res = assessDuplicateBatch(
        {
          reviewId: "rev-new",
          imageHash: "aa853f6a4a5af207",
          threshold: DEFAULT_DUPLICATE_HASH_THRESHOLD,
          reviewerName: "Budi Santoso",
          extractedText: "Layanan cepat sekali terima kasih",
          evidenceImagePath: "evidence/2026/11/27/budi.jpg",
          candidates: [
            {
              id: "rev-template",
              evidenceImageHash: "aa853f6a4a5af206",
              duplicateOfId: null,
              playstoreReviewerName: "Siti Aminah",
              extractedOcrText: "Sering mati lampu tolong diperbaiki",
              evidenceImagePath: "evidence/2026/11/26/siti.jpg",
            },
            {
              id: "rev-dup-child",
              evidenceImageHash: "aa853f6a4a5af207",
              duplicateOfId: "rev-root-master",
              playstoreReviewerName: "Budi Santoso",
              extractedOcrText: "Layanan cepat sekali",
              evidenceImagePath: "evidence/2026/11/25/budi-orig.jpg",
            },
          ],
        },
        { onTemplateCollisionDismissed: onDismissed }
      );

      expect(onDismissed).toHaveBeenCalledTimes(1);
      expect(onDismissed).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewId: "rev-new",
          candidateId: "rev-template",
        })
      );
      expect(res.isDuplicate).toBe(true);
      expect(res.duplicateOfId).toBe("rev-root-master");
      expect(res.matchReason).toBe("Nama Pengulas & Visual Identik");
    });

    it("falls back to visual-only duplicate when neither reviewer nor text metadata exists", () => {
      const res = assessDuplicateBatch({
        reviewId: "rev-no-meta",
        imageHash: "8ecd433b9191b1b9",
        candidates: [
          {
            id: "rev-master",
            evidenceImageHash: "8ecd433b9191b1b9",
            duplicateOfId: null,
            playstoreReviewerName: null,
            extractedOcrText: null,
            evidenceImagePath: "evidence/2026/11/20/master.jpg",
          },
        ],
      });

      expect(res.isDuplicate).toBe(true);
      expect(res.duplicateOfId).toBe("rev-master");
      expect(res.matchReason).toBe("Citra Visual Identik");
    });

    it("returns non-duplicate safely for invalid target pHash", () => {
      const res = assessDuplicateBatch({
        reviewId: "rev-bad-hash",
        imageHash: "short",
        candidates: [
          {
            id: "rev-1",
            evidenceImageHash: "8ecd433b9191b1b9",
            duplicateOfId: null,
            playstoreReviewerName: "Budi",
            extractedOcrText: "Bagus",
            evidenceImagePath: "evidence/a.jpg",
          },
        ],
      });

      expect(res.isDuplicate).toBe(false);
      expect(res.duplicateOfId).toBeNull();
      expect(res.minDistance).toBe(64);
    });
  });

  describe("normalizeDuplicateSourcePreview & extractGoogleDriveFileId", () => {
    it("normalizes partial duplicateOf summaries and full records into one consistent preview shape", () => {
      expect(normalizeDuplicateSourcePreview(null)).toBeNull();

      const partial = normalizeDuplicateSourcePreview({
        id: "orig-1",
        playstoreReviewerName: "Budi Santoso",
        entryDate: "2026-11-20T00:00:00.000Z",
        evidenceImagePath: "evidence/2026/11/20/orig.jpg",
        validationStatus: "APPROVED",
        up3: { name: "UP3 Palembang" },
        ulp: null,
      });

      expect(partial).toEqual({
        id: "orig-1",
        source: "MIGRATION",
        timestamp: null,
        createdAt: null,
        playstoreReviewerName: "Budi Santoso",
        originalReviewerName: null,
        entryDate: "2026-11-20T00:00:00.000Z",
        evidenceImagePath: "evidence/2026/11/20/orig.jpg",
        evidenceImageHash: null,
        extractedOcrText: null,
        confidenceScore: null,
        ocrStatus: "COMPLETED",
        validationStatus: "APPROVED",
        isDuplicate: false,
        fieldNotes: null,
        reviewRemarks: null,
        up3: { id: "", code: "", name: "UP3 Palembang" },
        ulp: { id: "", code: "", name: "-" },
        appVersion: { id: "", version: "-" },
      });
    });

    it("extracts Google Drive IDs across supported URL shapes", () => {
      expect(
        extractGoogleDriveFileId("https://drive.google.com/open?id=1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp")
      ).toBe("1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp");
      expect(
        extractGoogleDriveFileId(
          "https://lh3.googleusercontent.com/d/1--6-2bJppAlOrXKfNgkP9IzUmagITwk8"
        )
      ).toBe("1--6-2bJppAlOrXKfNgkP9IzUmagITwk8");
      expect(extractGoogleDriveFileId("evidence/2026/11/local.jpg")).toBeNull();
    });
  });
});
