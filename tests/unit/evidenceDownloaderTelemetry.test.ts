import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  streamEvidenceImageBuffer,
  getDownloaderNetworkMetrics,
  resetDownloaderMetrics,
  extractGoogleDriveFileId,
  getCandidateImageUrls,
} from "@/server/services/evidenceDownloader";
import {
  executeOcrBridge,
  getOcrBridgeMetrics,
  resetOcrBridgeMetrics,
} from "@/server/services/ocrBridge";
import { GET as healthRouteGet } from "@/app/api/health/route";

describe("Evidence Downloader & Network Telemetry Suite (Task 20.1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetDownloaderMetrics();
    resetOcrBridgeMetrics();
  });

  describe("1. In-Memory Network Telemetry Accumulation", () => {
    it("should initialize with clean zeroed metrics", () => {
      const metrics = getDownloaderNetworkMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulStreams).toBe(0);
      expect(metrics.failedStreams).toBe(0);
      expect(metrics.totalBytesStreamed).toBe(0);
      expect(metrics.averageLatencyMs).toBe(0);
      expect(metrics.candidateHits.endpointUc).toBe(0);
      expect(metrics.candidateHits.endpointUserContent).toBe(0);
      expect(metrics.candidateHits.endpointLh3).toBe(0);
      expect(metrics.candidateHits.directUrl).toBe(0);
      expect(metrics.rejectionReasons.htmlResponse).toBe(0);
      expect(metrics.rejectionReasons.invalidMagicBytes).toBe(0);
      expect(metrics.rejectionReasons.timeoutAbort).toBe(0);
      expect(metrics.rejectionReasons.httpError).toBe(0);
    });

    it("should accurately track successful stream and candidate endpoint hits", async () => {
      // Mock valid JPEG binary header (FF D8 FF E0 ...)
      const mockJpegBytes = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("drive.google.com/uc")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "image/jpeg" }),
            arrayBuffer: () => Promise.resolve(mockJpegBytes.buffer),
          });
        }
        return Promise.reject(new Error("Unexpected URL"));
      });

      const result = await streamEvidenceImageBuffer(
        "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing"
      );

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.buffer).toBeDefined();

      const metrics = getDownloaderNetworkMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulStreams).toBe(1);
      expect(metrics.failedStreams).toBe(0);
      expect(metrics.totalBytesStreamed).toBe(mockJpegBytes.length);
      expect(metrics.candidateHits.endpointUc).toBe(1);
      expect(metrics.candidateHits.endpointUserContent).toBe(0);
      expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle multi-candidate failover from endpoint 1 to endpoint 2", async () => {
      const mockPngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      global.fetch = vi.fn().mockImplementation((url: string) => {
        // Endpoint 1 fails with HTTP 429 Too Many Requests
        if (url.includes("drive.google.com/uc")) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: new Headers(),
          });
        }
        // Endpoint 2 succeeds with valid PNG
        if (url.includes("drive.usercontent.google.com")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "image/png" }),
            arrayBuffer: () => Promise.resolve(mockPngBytes.buffer),
          });
        }
        return Promise.reject(new Error("Unexpected endpoint"));
      });

      const result = await streamEvidenceImageBuffer(
        "https://drive.google.com/open?id=failoverTestFileId"
      );

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe("image/png");

      const metrics = getDownloaderNetworkMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulStreams).toBe(1);
      expect(metrics.rejectionReasons.httpError).toBe(1);
      expect(metrics.candidateHits.endpointUc).toBe(0);
      expect(metrics.candidateHits.endpointUserContent).toBe(1);
    });
  });

  describe("2. Magic Bytes Rejection & Error Telemetry", () => {
    it("should reject HTML responses and record rejectionReasons.htmlResponse", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        arrayBuffer: () => Promise.resolve(Buffer.from("<html>Error Page</html>").buffer),
      });

      const result = await streamEvidenceImageBuffer(
        "https://drive.google.com/file/d/privateOrDeletedFileId/view"
      );

      expect(result.success).toBe(false);

      const metrics = getDownloaderNetworkMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedStreams).toBe(1);
      expect(metrics.rejectionReasons.htmlResponse).toBe(3); // All 3 candidates returned HTML
      expect(metrics.lastIncident).toBeDefined();
      expect(metrics.lastIncident?.url).toContain("privateOrDeletedFileId");
    });

    it("should reject corrupted/non-image binary buffers and record invalidMagicBytes", async () => {
      const corruptedBytes = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/octet-stream" }),
        arrayBuffer: () => Promise.resolve(corruptedBytes.buffer),
      });

      const result = await streamEvidenceImageBuffer(
        "https://drive.google.com/file/d/corruptedBinaryFileId/view"
      );

      expect(result.success).toBe(false);

      const metrics = getDownloaderNetworkMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedStreams).toBe(1);
      expect(metrics.rejectionReasons.invalidMagicBytes).toBe(3); // All 3 candidates rejected
    });
  });

  describe("3. Health Route Integration (/api/health)", () => {
    it("should include network_downloader and ocr_bridge telemetry in health route response", async () => {
      // Simulate 1 successful download before health check
      const mockWebpBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);

      global.fetch = vi.fn().mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "image/webp" }),
          arrayBuffer: () => Promise.resolve(mockWebpBytes.buffer),
        });
      });

      await streamEvidenceImageBuffer("https://lh3.googleusercontent.com/d/healthCheckSample");

      const response = await healthRouteGet();
      const body = await response.json();

      expect(body.services).toBeDefined();
      expect(body.services.network_downloader).toBeDefined();

      const dl = body.services.network_downloader;
      expect(dl.status).toBe("up");
      expect(dl.total_requests).toBe(1);
      expect(dl.successful_streams).toBe(1);
      expect(dl.failed_streams).toBe(0);
      expect(typeof dl.bytes_streamed_mb).toBe("number");
      expect(typeof dl.cache_hit_rate_pct).toBe("number");
      expect(dl.candidate_hits).toBeDefined();
      expect(dl.rejection_reasons).toBeDefined();

      expect(body.services.ocr_bridge).toBeDefined();
      expect(body.services.ocr_bridge.status).toBe("up");
      expect(typeof body.services.ocr_bridge.total_requests).toBe("number");
    });
  });

  describe("4. OCR Bridge Loopback Metrics", () => {
    it("should record httpSuccessCount when HTTP microservice responds successfully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            extracted_text: "Sample Reviewer Name",
            phash: "1010101010101010",
            similarity_score: 95.0,
            zone: "GREEN",
            recommended_status: "APPROVED",
            execution_time_ms: 120,
          }),
      });

      const result = await executeOcrBridge(
        Buffer.from("sample-image-data"),
        "Sample Reviewer Name"
      );

      expect(result.success).toBe(true);
      expect(result.zone).toBe("GREEN");

      const metrics = getOcrBridgeMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.httpSuccessCount).toBe(1);
      expect(metrics.cliFallbackCount).toBe(0);
      expect(metrics.averageExecutionMs).toBeGreaterThanOrEqual(0);
    });
  });
});
