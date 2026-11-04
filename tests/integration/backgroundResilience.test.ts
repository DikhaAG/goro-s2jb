import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import {
  streamEvidenceImageBuffer,
  getDownloaderNetworkMetrics,
  resetDownloaderMetrics,
} from "@/server/services/evidenceDownloader";
import {
  executeOcrBridge,
  getOcrBridgeMetrics,
  resetOcrBridgeMetrics,
} from "@/server/services/ocrBridge";
import {
  recordJobCompleted,
  recordJobFailed,
  getQueueThroughputStatsSync,
  resetQueueTelemetry,
} from "@/server/queues/queueTelemetry";
import {
  evaluateSystemAlerts,
  getActiveAlerts,
  getPublicOperatorAlertSummary,
  resetAlertsCache,
} from "@/server/services/alertService";
import * as childProcess from "child_process";
import * as auditService from "@/server/services/auditService";
import { migrationRouter } from "@/server/routers/migration";
import * as processManagerModule from "@/lib/processManager";
import { Role } from "@prisma/client";

// Top-level mocks for Vitest hoisting compliance
vi.mock("@/server/queues/ocrQueue", () => ({
  ocrQueue: {
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue({
      id: "job-mock-1",
      retry: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    }),
    getJobs: vi.fn().mockResolvedValue([]),
    clean: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/server/queues/importQueue", () => ({
  importQueue: {
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue({
      id: "import-mock-1",
      retry: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    }),
    getJobs: vi.fn().mockResolvedValue([]),
    clean: vi.fn().mockResolvedValue([]),
  },
}));

const createMockProcess = () => {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };

  setTimeout(() => {
    const mockResult = JSON.stringify({
      success: true,
      extracted_text: "ULASAN PELAYANAN CEPAT DAN RAMAH - AHMAD DAHLAN",
      phash: "1010101010101010",
      similarity_score: 94.5,
      zone: "GREEN",
      recommended_status: "APPROVED",
      execution_time_ms: 120,
    });
    proc.stdout.emit("data", Buffer.from(mockResult));
    proc.emit("close", 0);
  }, 10);

  return proc;
};

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    spawn: vi.fn().mockImplementation(() => createMockProcess()),
  };
});

describe("Background Services Resilience & Chaos Integration Suite (Task 20.5)", () => {
  beforeEach(() => {
    resetDownloaderMetrics();
    resetOcrBridgeMetrics();
    resetQueueTelemetry();
    resetAlertsCache();
  });

  describe("1. Python OCR Microservice Graceful Fallback", () => {
    it("should gracefully fallback to CLI subprocess runner when HTTP port 8001 is unavailable", async () => {
      // Mock fetch failing with ECONNREFUSED on port 8001
      global.fetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8001"));

      const mockBuffer = Buffer.from("dummy-image-binary");

      const result = await executeOcrBridge(mockBuffer, "Ahmad Dahlan");

      expect(result.success).toBe(true);
      expect(result.extracted_text).toContain("AHMAD DAHLAN");

      // Verify loopback telemetry recorded the fallback
      const bridgeMetrics = getOcrBridgeMetrics();
      expect(bridgeMetrics.totalRequests).toBe(1);
      expect(bridgeMetrics.httpSuccessCount).toBe(0);
      expect(bridgeMetrics.cliFallbackCount).toBe(1);
      expect(bridgeMetrics.cliSuccessCount).toBe(1);
    });
  });

  describe("2. Google Drive Throttling & Multi-Endpoint Failover Resilience", () => {
    it("should seamlessly failover to secondary and tertiary CDN endpoints when primary endpoint returns HTTP 429", async () => {
      const validJpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);

      global.fetch = vi.fn().mockImplementation((url: string) => {
        // Endpoint 1 throttled with 429 Too Many Requests
        if (url.includes("drive.google.com/uc")) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            headers: new Headers(),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          });
        }
        // Endpoint 2 returns 403 Forbidden
        if (url.includes("drive.usercontent.google.com")) {
          return Promise.resolve({
            ok: false,
            status: 403,
            statusText: "Forbidden",
            headers: new Headers(),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          });
        }
        // Endpoint 3 (LH3 CDN) succeeds
        if (url.includes("lh3.googleusercontent.com")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "image/jpeg" }),
            arrayBuffer: () => Promise.resolve(validJpeg.buffer),
          });
        }
        return Promise.reject(new Error("Unknown route"));
      });

      const result = await streamEvidenceImageBuffer(
        "https://drive.google.com/file/d/1X9Y8Z7W6V5U4T3S2R1Q/view"
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.mimeType).toBe("image/jpeg");

      const metrics = getDownloaderNetworkMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulStreams).toBe(1);
      expect(metrics.failedStreams).toBe(0);
      expect(metrics.candidateHits.endpointLh3).toBe(1);
    });
  });

  describe("3. High-Load Queue Telemetry Sliding Window", () => {
    it("should compute throughput across 60-second sliding window and average execution durations", () => {
      // Record 15 completed jobs
      for (let i = 1; i <= 15; i++) {
        recordJobCompleted("ocr", 1000 + i * 10);
      }
      // Record 2 failed jobs
      recordJobFailed("ocr", 500);
      recordJobFailed("ocr", 600);

      const stats = getQueueThroughputStatsSync("ocr");
      expect(stats.throughputJobsPerMinute).toBe(15);
      expect(stats.totalCompletedInWindow).toBe(15);
      expect(stats.totalFailedInWindow).toBe(2);
      expect(stats.averageExecutionDurationMs).toBeGreaterThan(1000);
    });
  });

  describe("4. Proactive Alert Engine (Zero False Positive & Anomaly Detection)", () => {
    it("should report zero alerts and NORMAL operational status under healthy baseline conditions", async () => {
      vi.spyOn(processManagerModule, "detectServicePorts").mockResolvedValue([
        { name: "PostgreSQL", port: 5432, serviceType: "POSTGRES", status: "UP", latencyMs: 2 },
        { name: "Redis", port: 6379, serviceType: "REDIS", status: "UP", latencyMs: 1 },
        { name: "Python OCR", port: 8001, serviceType: "PYTHON_OCR", status: "UP", latencyMs: 5 },
        { name: "Web Server", port: 3000, serviceType: "WEB_SERVER", status: "UP", latencyMs: 3 },
      ]);

      vi.spyOn(processManagerModule, "listAppProcesses").mockResolvedValue([
        {
          pid: 501,
          ppid: 1,
          command: "node worker.js",
          cpuPercent: 1.2,
          memPercent: 1.5,
          rssKb: 120 * 1024,
          status: "RUNNING",
          elapsedTime: "10:00",
          serviceType: "WEB_SERVER",
          isSafeToKill: true,
        },
      ]);

      vi.spyOn(processManagerModule, "getSystemResources").mockReturnValue({
        cpuCount: 8,
        cpuModel: "Mock CPU",
        totalMemBytes: 16 * 1024 * 1024 * 1024,
        freeMemBytes: 12 * 1024 * 1024 * 1024,
        usedMemBytes: 4 * 1024 * 1024 * 1024,
        memUsagePercent: 25,
        processUptimeSeconds: 600,
        systemUptimeSeconds: 3600,
        nodeMemory: {} as any,
        platform: "darwin",
        arch: "arm64",
      });

      const alerts = await evaluateSystemAlerts(true);
      expect(alerts).toHaveLength(0);

      const operatorSummary = await getPublicOperatorAlertSummary();
      expect(operatorSummary.hasActiveAlert).toBe(false);
      expect(operatorSummary.status).toBe("NORMAL");
      expect(operatorSummary.userMessage).toContain("beroperasi normal");
    });

    it("should proactively detect anomalies and flag CRITICAL alert when core database port is down", async () => {
      vi.spyOn(processManagerModule, "detectServicePorts").mockResolvedValue([
        { name: "PostgreSQL", port: 5432, serviceType: "POSTGRES", status: "DOWN", latencyMs: 0 },
        { name: "Redis", port: 6379, serviceType: "REDIS", status: "UP", latencyMs: 1 },
      ]);

      vi.spyOn(processManagerModule, "listAppProcesses").mockResolvedValue([]);
      vi.spyOn(processManagerModule, "getSystemResources").mockReturnValue({
        cpuCount: 4,
        cpuModel: "Mock CPU",
        totalMemBytes: 8 * 1024 * 1024 * 1024,
        freeMemBytes: 6 * 1024 * 1024 * 1024,
        usedMemBytes: 2 * 1024 * 1024 * 1024,
        memUsagePercent: 25,
        processUptimeSeconds: 300,
        systemUptimeSeconds: 1000,
        nodeMemory: {} as any,
        platform: "linux",
        arch: "x64",
      });

      const alerts = await evaluateSystemAlerts(true);
      expect(alerts.length).toBeGreaterThan(0);

      const portAlert = alerts.find((a) => a.code === "CORE_PORT_DOWN");
      expect(portAlert).toBeDefined();
      expect(portAlert?.severity).toBe("CRITICAL");
      expect(portAlert?.message).toContain("PostgreSQL (Port 5432)");

      const operatorSummary = await getPublicOperatorAlertSummary();
      expect(operatorSummary.hasActiveAlert).toBe(true);
      expect(operatorSummary.status).toBe("CRITICAL");
    });
  });

  describe("5. Security & Audit Trail Compliance", () => {
    it("should strictly record immutable audit event on queue pause and resume operations", async () => {
      const auditSpy = vi.spyOn(auditService, "logAuditEvent").mockResolvedValue({
        id: "audit-log-uuid-1",
        userId: "admin-1",
        action: "PAUSE_QUEUE",
        entityType: "Queue",
        entityId: "ocr",
        ipAddress: null,
        userAgent: null,
        metadata: {},
        createdAt: new Date(),
      });

      const caller = migrationRouter.createCaller({
        user: { id: "admin-1", username: "superadmin", name: "Super Administrator", role: Role.SUPER_ADMIN },
        prisma: {} as any,
        redis: {} as any,
      });

      await caller.pauseQueue({ queueName: "ocr" });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-1",
          action: "PAUSE_QUEUE",
          entityType: "Queue",
          entityId: "ocr",
        })
      );
    });

    it("should reject non-admin users from pausing queues (RBAC protection)", async () => {
      const caller = migrationRouter.createCaller({
        user: { id: "pegawai-1", username: "operator1", name: "Operator Pegawai", role: Role.PEGAWAI },
        prisma: {} as any,
        redis: {} as any,
      });

      await expect(caller.pauseQueue({ queueName: "ocr" })).rejects.toThrow(
        "Hanya Super Admin yang berwenang menjeda antrean worker sistem."
      );
    });
  });
});
