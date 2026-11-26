import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { BASE_UPLOAD_DIR } from "@/lib/storage";
import {
  acquireBytes,
  acquireForVerification,
  extractGoogleDriveFileId,
  getCandidateImageUrls,
  isExternalUrl,
  loadReviewEvidence,
  streamExternalEvidence,
  validateExternalEvidenceUrl,
} from "@/server/services/evidenceAcquisition";

describe("Akuisisi Eviden (evidenceAcquisition deep module)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("URL parsing and SSRF protection", () => {
    it("extracts Google Drive file IDs across supported URL patterns", () => {
      expect(
        extractGoogleDriveFileId("https://drive.google.com/open?id=1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp")
      ).toBe("1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp");
      expect(
        extractGoogleDriveFileId("https://drive.google.com/file/d/157qyJ-yAvYTTnPZcgM1qZ0cXpdfLrQqb/view?usp=drivesdk")
      ).toBe("157qyJ-yAvYTTnPZcgM1qZ0cXpdfLrQqb");
      expect(
        extractGoogleDriveFileId("https://drive.google.com/uc?id=1--6-2bJppAlOrXKfNgkP9IzUmagITwk8&export=download")
      ).toBe("1--6-2bJppAlOrXKfNgkP9IzUmagITwk8");
      expect(
        extractGoogleDriveFileId("https://lh3.googleusercontent.com/d/1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp")
      ).toBe("1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp");
      expect(extractGoogleDriveFileId("https://example.com/image.jpg")).toBeNull();
      expect(extractGoogleDriveFileId("")).toBeNull();
    });

    it("identifies external URLs and builds candidate Drive endpoints", () => {
      expect(isExternalUrl("https://drive.google.com/open?id=123")).toBe(true);
      expect(isExternalUrl("evidence/2026/07/02/eviden_123.jpg")).toBe(false);
      expect(getCandidateImageUrls("https://drive.google.com/open?id=test123")).toHaveLength(3);
      expect(getCandidateImageUrls("https://example.com/photo.png")).toEqual([
        "https://example.com/photo.png",
      ]);
      expect(getCandidateImageUrls("")).toEqual([]);
    });

    it("blocks loopback, private IPv4/IPv6, metadata hosts, credentials, and non-HTTP schemes", () => {
      const blocked = [
        "http://localhost:8001/health",
        "http://127.0.0.1:3000/api/health",
        "http://10.0.0.5/secret.jpg",
        "http://169.254.169.254/latest/meta-data/",
        "http://192.168.1.10/admin.png",
        "http://[::1]:8080/a.jpg",
        "http://[fe80::1]/a.jpg",
        "https://user:pass@drive.google.com/uc?id=abc",
        "file:///etc/passwd",
      ];

      for (const target of blocked) {
        expect(validateExternalEvidenceUrl(target).allowed).toBe(false);
      }

      expect(validateExternalEvidenceUrl("https://drive.google.com/open?id=abc").allowed).toBe(true);
      expect(validateExternalEvidenceUrl("https://lh3.googleusercontent.com/d/abc").allowed).toBe(true);
    });
  });

  describe("Zero-storage streaming and magic-byte validation", () => {
    it("streams valid image bytes via injected fetchFn adapter and records telemetry", async () => {
      const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const recordTelemetry = vi.fn().mockResolvedValue(undefined);
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        url: "https://drive.google.com/uc?id=file1&export=download",
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => jpegBytes.buffer.slice(jpegBytes.byteOffset, jpegBytes.byteOffset + jpegBytes.byteLength),
      });

      const res = await streamExternalEvidence("https://drive.google.com/open?id=file1", {
        fetchFn: fetchFn as any,
        recordTelemetry,
      });

      expect(res.success).toBe(true);
      expect(res.mimeType).toBe("image/jpeg");
      expect(res.buffer).toEqual(jpegBytes);
      expect(recordTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "downloader_stream",
          outcome: "success",
          endpoint: "endpointUc",
        })
      );
    });

    it("rejects redirects to loopback/private hosts before reading bytes", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        url: "http://127.0.0.1:8001/internal.jpg",
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => Buffer.from([0xff, 0xd8, 0xff, 0xe0]).buffer,
      });

      const res = await streamExternalEvidence("https://example.com/redirect", {
        fetchFn: fetchFn as any,
        recordTelemetry: vi.fn().mockResolvedValue(undefined),
      });

      expect(res.success).toBe(false);
    });

    it("rejects HTML error pages and invalid magic bytes", async () => {
      const htmlFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: async () => Buffer.from("<html>Denied</html>").buffer,
      });

      const htmlRes = await streamExternalEvidence("https://drive.google.com/open?id=denied", {
        fetchFn: htmlFetch as any,
        recordTelemetry: vi.fn().mockResolvedValue(undefined),
      });
      expect(htmlRes.success).toBe(false);

      const badBytesFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/octet-stream" }),
        arrayBuffer: async () => Buffer.from("not-an-image").buffer,
      });

      const badRes = await streamExternalEvidence("https://drive.google.com/open?id=corrupt", {
        fetchFn: badBytesFetch as any,
        recordTelemetry: vi.fn().mockResolvedValue(undefined),
      });
      expect(badRes.success).toBe(false);
    });
  });

  describe("Unified verification and review evidence acquisition", () => {
    it("returns local_path for Verifikasi Eviden and loads bytes for HTTP streaming", async () => {
      const testDir = path.join(BASE_UPLOAD_DIR, "evidence", "test-acq");
      await fs.promises.mkdir(testDir, { recursive: true });
      const filePath = path.join(testDir, "sample_acq.jpg");
      const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      await fs.promises.writeFile(filePath, jpegBytes);

      try {
        const relPath = "evidence/test-acq/sample_acq.jpg";
        const forVerify = await acquireForVerification(relPath);
        expect(forVerify).toMatchObject({
          ok: true,
          kind: "local_path",
          absolutePath: filePath,
          mimeType: "image/jpeg",
        });

        const bytesRes = await acquireBytes(relPath);
        expect(bytesRes).toMatchObject({
          ok: true,
          mimeType: "image/jpeg",
        });
        if (bytesRes.ok) {
          expect(bytesRes.buffer).toEqual(jpegBytes);
        }

        const reviewRes = await loadReviewEvidence("rev-local-1", {
          prisma: {
            ratingReview: {
              findUnique: vi.fn().mockResolvedValue({
                id: "rev-local-1",
                evidenceImagePath: relPath,
              }),
            } as any,
          },
        });
        expect(reviewRes.ok).toBe(true);
      } finally {
        await fs.promises.rm(testDir, { recursive: true, force: true });
      }
    });

    it("rejects traversal paths with 403", async () => {
      const res = await acquireBytes("../../etc/passwd");
      expect(res).toEqual({
        ok: false,
        status: 403,
        error: "Jalur berkas eviden tidak sah",
      });
    });
  });
});
