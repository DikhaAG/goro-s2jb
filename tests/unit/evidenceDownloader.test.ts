import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractGoogleDriveFileId,
  isExternalUrl,
  getCandidateImageUrls,
  downloadEvidenceImage,
  streamEvidenceImageBuffer,
} from "@/server/services/evidenceDownloader";
import * as storage from "@/lib/storage";

describe("Evidence Downloader Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractGoogleDriveFileId", () => {
    it("should extract fileId from Google Drive open?id= URL", () => {
      const url = "https://drive.google.com/open?id=1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp";
      expect(extractGoogleDriveFileId(url)).toBe("1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp");
    });

    it("should extract fileId from Google Drive /file/d/ URL", () => {
      const url = "https://drive.google.com/file/d/157qyJ-yAvYTTnPZcgM1qZ0cXpdfLrQqb/view?usp=drivesdk";
      expect(extractGoogleDriveFileId(url)).toBe("157qyJ-yAvYTTnPZcgM1qZ0cXpdfLrQqb");
    });

    it("should extract fileId from Google Drive uc?id= URL", () => {
      const url = "https://drive.google.com/uc?id=1--6-2bJppAlOrXKfNgkP9IzUmagITwk8&export=download";
      expect(extractGoogleDriveFileId(url)).toBe("1--6-2bJppAlOrXKfNgkP9IzUmagITwk8");
    });

    it("should extract fileId from googleusercontent /d/ URL", () => {
      const url = "https://lh3.googleusercontent.com/d/1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp";
      expect(extractGoogleDriveFileId(url)).toBe("1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp");
    });

    it("should return null for non-Google Drive or invalid URLs", () => {
      expect(extractGoogleDriveFileId("https://example.com/image.jpg")).toBeNull();
      expect(extractGoogleDriveFileId("not-a-url")).toBeNull();
      expect(extractGoogleDriveFileId("")).toBeNull();
    });
  });

  describe("isExternalUrl", () => {
    it("should correctly identify HTTP and HTTPS URLs", () => {
      expect(isExternalUrl("http://example.com/img.jpg")).toBe(true);
      expect(isExternalUrl("https://drive.google.com/open?id=123")).toBe(true);
      expect(isExternalUrl("evidence/2026/07/02/eviden_123.jpg")).toBe(false);
      expect(isExternalUrl("/uploads/evidence.png")).toBe(false);
      expect(isExternalUrl("")).toBe(false);
    });
  });

  describe("downloadEvidenceImage", () => {
    it("should immediately return success for already local relative paths", async () => {
      const localPath = "evidence/2026/07/02/eviden_1793254227_test.jpg";
      const result = await downloadEvidenceImage(localPath);
      expect(result.success).toBe(true);
      expect(result.relativePath).toBe(localPath);
    });

    it("should return failure if input is empty", async () => {
      const result = await downloadEvidenceImage("");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should download valid image buffer and save it locally", async () => {
      // Mock JPEG header: FF D8 FF E0
      const fakeJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => fakeJpegBuffer.buffer,
      } as any);

      vi.spyOn(storage, "saveEvidenceFile").mockResolvedValueOnce({
        relativePath: "evidence/2026/07/02/eviden_mock_saved.jpg",
        absolutePath: "/mock/uploads/evidence/2026/07/02/eviden_mock_saved.jpg",
        filename: "eviden_mock_saved.jpg",
      });

      const result = await downloadEvidenceImage("https://drive.google.com/open?id=1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp");
      expect(result.success).toBe(true);
      expect(result.relativePath).toBe("evidence/2026/07/02/eviden_mock_saved.jpg");
    });

    it("should handle HTTP failures and return failure object gracefully", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
      } as any);

      const result = await downloadEvidenceImage("https://drive.google.com/open?id=non_existent_id");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Gagal mengunduh gambar");
    });

    it("should reject text/html response (e.g. Google Drive Access Denied)", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        arrayBuffer: async () => Buffer.from("<html><body>Access Denied</body></html>").buffer,
      } as any);

      const result = await downloadEvidenceImage("https://drive.google.com/open?id=restricted_id");
      expect(result.success).toBe(false);
    });
  });

  describe("streamEvidenceImageBuffer (Migration Zero-Storage)", () => {
    it("should stream image into memory buffer without calling saveEvidenceFile", async () => {
      const fakeJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => fakeJpegBuffer.buffer.slice(fakeJpegBuffer.byteOffset, fakeJpegBuffer.byteOffset + fakeJpegBuffer.byteLength),
      } as any);

      const saveSpy = vi.spyOn(storage, "saveEvidenceFile");

      const result = await streamEvidenceImageBuffer("https://drive.google.com/open?id=1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp");
      expect(result.success).toBe(true);
      expect(result.buffer).toBeDefined();
      expect(result.buffer?.length).toBe(fakeJpegBuffer.length);
      expect(result.mimeType).toBe("image/jpeg");
      // Must NOT save to disk!
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("should return failure for empty URL", async () => {
      const result = await streamEvidenceImageBuffer("");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject response when buffer magic bytes do not match valid image headers", async () => {
      const corruptBuffer = Buffer.from("this is a random text payload not an image");

      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/octet-stream" }),
        arrayBuffer: async () => corruptBuffer.buffer.slice(corruptBuffer.byteOffset, corruptBuffer.byteOffset + corruptBuffer.byteLength),
      } as any);

      const result = await streamEvidenceImageBuffer("https://drive.google.com/open?id=corrupt_payload");
      expect(result.success).toBe(false);
    });
  });

  describe("getCandidateImageUrls", () => {
    it("should return candidate URLs for Google Drive URL", () => {
      const urls = getCandidateImageUrls("https://drive.google.com/open?id=test12345");
      expect(urls).toHaveLength(3);
      expect(urls[0]).toContain("test12345");
      expect(urls[1]).toContain("test12345");
      expect(urls[2]).toContain("test12345");
    });

    it("should return single direct URL for non-Google Drive external link", () => {
      const urls = getCandidateImageUrls("https://example.com/photo.png");
      expect(urls).toEqual(["https://example.com/photo.png"]);
    });

    it("should return empty array for empty input", () => {
      expect(getCandidateImageUrls("")).toEqual([]);
    });
  });
});
