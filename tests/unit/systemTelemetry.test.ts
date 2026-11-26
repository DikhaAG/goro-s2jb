import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { importQueue } from "@/server/queues/importQueue";
import { ocrQueue } from "@/server/queues/ocrQueue";
import { migrationRouter } from "@/server/routers/migration";
import {
  createInMemoryTelemetryStore,
  createSystemTelemetry,
  systemTelemetry,
} from "@/server/services/systemTelemetry";
import { isOrphanOrZombieProcess } from "@/lib/processManager";

function createFakeQueue(overrides: Partial<{
  counts: Record<string, number>;
  paused: boolean;
  activeJobs: Array<{ id: string; name: string; timestamp: number; processedOn?: number; data: any }>;
}> = {}) {
  return {
    getJobCounts: vi.fn().mockResolvedValue(
      overrides.counts ?? { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0 }
    ),
    isPaused: vi.fn().mockResolvedValue(overrides.paused ?? false),
    getJobs: vi.fn().mockResolvedValue(overrides.activeJobs ?? []),
  };
}

function createFakeHostProbe(overrides: Partial<{
  ports: any[];
  processes: any[];
  memUsagePercent: number;
}> = {}) {
  return {
    detectServicePorts: vi.fn().mockResolvedValue(
      overrides.ports ?? [
        { name: "PostgreSQL", port: 5432, serviceType: "POSTGRES", status: "UP", latencyMs: 2 },
        { name: "Redis", port: 6379, serviceType: "REDIS", status: "UP", latencyMs: 1 },
      ]
    ),
    listAppProcesses: vi.fn().mockResolvedValue(overrides.processes ?? []),
    getSystemResources: vi.fn().mockReturnValue({
      cpuCount: 4,
      cpuModel: "Virtual CPU",
      totalMemBytes: 8 * 1024 ** 3,
      freeMemBytes: 4 * 1024 ** 3,
      usedMemBytes: 4 * 1024 ** 3,
      memUsagePercent: overrides.memUsagePercent ?? 50,
      processUptimeSeconds: 120,
      systemUptimeSeconds: 3600,
      nodeMemory: process.memoryUsage(),
      platform: "linux",
      arch: "x64",
    }),
    isOrphanOrZombieProcess,
  };
}

function createFakePrisma(overrides: Partial<{
  pingError: Error;
  counts: Record<string, number>;
}> = {}) {
  return {
    $queryRawUnsafe: overrides.pingError
      ? vi.fn().mockRejectedValue(overrides.pingError)
      : vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    ratingReview: {
      count: vi.fn().mockImplementation((args?: any) => {
        if (!args?.where) return Promise.resolve(overrides.counts?.total ?? 0);
        if (args.where.validationStatus) {
          return Promise.resolve(overrides.counts?.[args.where.validationStatus] ?? 0);
        }
        return Promise.resolve(0);
      }),
    },
  };
}

describe("systemTelemetry deep module", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await systemTelemetry.reset();
  });

  it("shares cross-process counters, 60s sliding windows, and time-series across separate instances via one store", async () => {
    let now = 1_700_000_000_000;
    const sharedStore = createInMemoryTelemetryStore();

    const workerOcr = createSystemTelemetry({
      store: sharedStore,
      now: () => now,
    });

    const webServer = createSystemTelemetry({
      store: sharedStore,
      now: () => now,
      prisma: createFakePrisma(),
      redis: { ping: vi.fn().mockResolvedValue("PONG") },
      queues: {
        import: createFakeQueue(),
        ocr: createFakeQueue({ counts: { active: 1, waiting: 2 } }),
      },
      visionEngineProbe: {
        probe: vi.fn().mockResolvedValue({ status: "up", latencyMs: 12, backend: "http" }),
      },
      hostProbe: createFakeHostProbe(),
    });

    // Worker records a 70s-old job, then advances clock and records 2 current jobs
    await workerOcr.record({ kind: "queue_job", queue: "ocr-processing-queue", outcome: "completed", durationMs: 500 });
    now += 70_000;
    await workerOcr.record({ kind: "queue_job", queue: "ocr-processing-queue", outcome: "completed", durationMs: 100 });
    await workerOcr.record({ kind: "queue_job", queue: "ocr", outcome: "completed", durationMs: 200 });
    await workerOcr.record({ kind: "queue_job", queue: "ocr", outcome: "failed" });

    await workerOcr.record({
      kind: "downloader_stream",
      outcome: "success",
      bytes: 256_000,
      latencyMs: 320,
      endpoint: "endpointLh3",
    });
    await workerOcr.record({
      kind: "ocr_bridge",
      transport: "http",
      outcome: "success",
      durationMs: 95,
    });

    const detailed = await webServer.getWorkerTelemetry("detailed", { includeStalledIds: true });
    expect(detailed.queues.ocr.throughput.jobsPerMinute).toBe(2);
    expect(detailed.queues.ocr.throughput.averageDurationMs).toBe(150);
    expect(detailed.queues.ocr.throughput.failedInWindow).toBe(1);

    expect(detailed.gdriveDownloader.totalRequests).toBe(1);
    expect(detailed.gdriveDownloader.successfulStreams).toBe(1);
    expect(detailed.gdriveDownloader.candidateHits.endpointLh3).toBe(1);
    expect(detailed.gdriveDownloader.timeSeries).toHaveLength(1);
    expect(detailed.gdriveDownloader.timeSeries?.[0].bytesDelta).toBe(256_000);

    const bridge = await webServer.getEngineBridgeMetrics();
    expect(bridge.totalRequests).toBe(1);
    expect(bridge.httpSuccessCount).toBe(1);
    expect(bridge.averageExecutionMs).toBe(95);
  });

  it("returns empty live timeSeries (never synthetic Math.sin() waves) when cold", async () => {
    const telemetry = createSystemTelemetry({
      store: createInMemoryTelemetryStore(),
      prisma: createFakePrisma(),
      redis: { ping: vi.fn().mockResolvedValue("PONG") },
      queues: {
        import: createFakeQueue(),
        ocr: createFakeQueue({ counts: { active: 3 } }),
      },
      hostProbe: createFakeHostProbe(),
    });

    const detailed = await telemetry.getWorkerTelemetry("detailed");
    expect(detailed.gdriveDownloader.timeSeries).toEqual([]);
  });

  it("fires all 5 Peringatan Anomali codes (including QUEUE_STALLED & ORPHAN_PROCESS_DETECTED) and sanitizes operator summary", async () => {
    const now = 1_700_000_500_000;
    const store = createInMemoryTelemetryStore();

    const telemetry = createSystemTelemetry({
      store,
      now: () => now,
      queues: {
        import: createFakeQueue(),
        ocr: createFakeQueue({
          activeJobs: [
            { id: "ocr-stalled-77", name: "verify", timestamp: now - 300_000, processedOn: now - 240_000, data: {} },
          ],
        }),
      },
      hostProbe: createFakeHostProbe({
        ports: [
          { name: "PostgreSQL", port: 5432, serviceType: "POSTGRES", status: "DOWN", latencyMs: 0 },
        ],
        processes: [
          {
            pid: 9001,
            ppid: 1,
            cpuPercent: 10,
            memPercent: 8,
            rssKb: 650 * 1024,
            status: "S",
            elapsedTime: "05:00",
            command: "tsx src/server/workers/ocrWorker.ts",
            serviceType: "OCR_WORKER",
            isSafeToKill: true,
          },
        ],
        memUsagePercent: 95,
      }),
    });

    // Trigger GDRIVE_RATE_LIMITED (>2 httpErrors)
    await telemetry.record({
      kind: "downloader_stream",
      outcome: "failure",
      latencyMs: 500,
      rejections: { httpError: 3 },
      incident: { url: "https://drive.google.com/file/d/secret/view", error: "429" },
    });

    const adminAlerts = await telemetry.evaluateAlerts("admin", { force: true });
    const codes = adminAlerts.map((a) => a.code);
    expect(codes).toContain("GDRIVE_RATE_LIMITED");
    expect(codes).toContain("QUEUE_STALLED");
    expect(codes).toContain("CORE_PORT_DOWN");
    expect(codes).toContain("WORKER_MEMORY_HIGH");
    expect(codes).toContain("ORPHAN_PROCESS_DETECTED");

    const stallAlert = adminAlerts.find((a) => a.code === "QUEUE_STALLED");
    expect(stallAlert?.metadata?.ocrStalledJobIds).toEqual(["ocr-stalled-77"]);

    const operatorSummary = await telemetry.evaluateAlerts("operator");
    expect(operatorSummary.hasActiveAlert).toBe(true);
    expect(operatorSummary.status).toBe("CRITICAL");
    expect(operatorSummary.userMessage).not.toContain("9001");
    expect(operatorSummary.userMessage).not.toContain("ocr-stalled-77");
    expect(operatorSummary.userMessage).not.toContain("5432");
  });

  it("reports degraded health when vision engine or Redis is down without throwing", async () => {
    const tmpUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "goro-telemetry-test-"));
    try {
      const telemetry = createSystemTelemetry({
        store: createInMemoryTelemetryStore(),
        prisma: createFakePrisma(),
        redis: { ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) },
        queues: { import: createFakeQueue(), ocr: createFakeQueue() },
        uploadDir: tmpUploadDir,
        visionEngineProbe: {
          probe: vi.fn().mockResolvedValue({ status: "down", error: "Offline" }),
        },
      });

      const full = await telemetry.getHealth("full");
      expect(full.isCriticalUp).toBe(false);
      expect(full.status).toBe("degraded");
      expect(full.redis.status).toBe("down");
      expect(full.visionEngine?.status).toBe("down");
      expect(full.storage?.status).toBe("up");
    } finally {
      fs.rmSync(tmpUploadDir, { recursive: true, force: true });
    }
  });

  it("exposes full stalledJobIds to SUPER_ADMIN and strips them for PEGAWAI via migration.getDetailedWorkerStatus", async () => {
    vi.spyOn(prisma.ratingReview, "count").mockResolvedValue(12);
    vi.spyOn(redis, "ping").mockResolvedValue("PONG");
    vi.spyOn(redis, "info").mockResolvedValue("");
    vi.spyOn(importQueue, "getJobCounts").mockResolvedValue({ active: 0, waiting: 0, completed: 1, failed: 0, delayed: 0, paused: 0, prioritized: 0 });
    vi.spyOn(ocrQueue, "getJobCounts").mockResolvedValue({ active: 1, waiting: 0, completed: 2, failed: 0, delayed: 0, paused: 0, prioritized: 0 });
    vi.spyOn(importQueue, "isPaused").mockResolvedValue(false);
    vi.spyOn(ocrQueue, "isPaused").mockResolvedValue(false);
    vi.spyOn(importQueue, "getJobs").mockResolvedValue([]);
    vi.spyOn(ocrQueue, "getJobs").mockResolvedValue([
      { id: "stalled-ocr-1", name: "verify", timestamp: Date.now() - 300_000, processedOn: Date.now() - 250_000, data: {} } as any,
    ]);

    await systemTelemetry.record({
      kind: "queue_job",
      queue: "ocr-processing-queue",
      outcome: "completed",
      durationMs: 250,
    });
    await systemTelemetry.record({
      kind: "queue_job",
      queue: "ocr-processing-queue",
      outcome: "completed",
      durationMs: 350,
    });

    const adminCaller = migrationRouter.createCaller({
      prisma,
      user: {
        id: "superadmin-1",
        name: "Super Admin",
        username: "superadmin",
        role: Role.SUPER_ADMIN,
        up3Id: null,
        ulpId: null,
      },
    } as any);

    const adminStatus = await adminCaller.getDetailedWorkerStatus();
    expect(adminStatus.isSuperAdmin).toBe(true);
    expect(adminStatus.queues.ocr.throughput.jobsPerMinute).toBe(2);
    expect(adminStatus.queues.ocr.throughput.averageDurationMs).toBe(300);
    expect(Array.isArray(adminStatus.queues.ocr.stallDetection.stalledJobIds)).toBe(true);

    const pegawaiCaller = migrationRouter.createCaller({
      prisma,
      user: {
        id: "pegawai-1",
        name: "Budi Operator",
        username: "budiop",
        role: Role.PEGAWAI,
        up3Id: null,
        ulpId: null,
      },
    } as any);

    const pegawaiStatus = await pegawaiCaller.getDetailedWorkerStatus();
    expect(pegawaiStatus.isSuperAdmin).toBe(false);
    expect(pegawaiStatus.queues.ocr.stallDetection.stalledJobIds).toEqual([]);
    expect(pegawaiStatus.queues.import.stallDetection.stalledJobIds).toEqual([]);
  });
});
