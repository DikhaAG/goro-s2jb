import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSystemProcessesRouter } from "@/server/routers/systemProcesses";
import prisma from "@/lib/prisma";
import type { ProcessControlPort } from "@/lib/processManager";
import {
  createInMemoryTelemetryStore,
  createSystemTelemetry,
  isOrphanOrZombieProcess,
  type HostProbePort,
} from "@/server/services/systemTelemetry";
import * as auditService from "@/server/services/auditService";
import { Role } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/auditService", () => ({
  logAuditEvent: vi.fn(),
}));

function buildFakeRouter(overrides: {
  hostProbe?: Partial<HostProbePort>;
  processControl?: Partial<ProcessControlPort>;
} = {}) {
  const hostProbe: HostProbePort = {
    detectServicePorts: vi.fn().mockResolvedValue([
      {
        name: "PostgreSQL Database",
        port: 5432,
        serviceType: "POSTGRES",
        status: "UP",
        latencyMs: 12,
        pid: 892,
      },
    ]),
    listAppProcesses: vi.fn().mockResolvedValue([
      {
        pid: 12345,
        ppid: 1,
        cpuPercent: 0.5,
        memPercent: 1.2,
        rssKb: 45000,
        status: "S",
        elapsedTime: "10:00",
        command: "node src/server/workers/importWorker.ts",
        serviceType: "IMPORT_WORKER",
        isSafeToKill: true,
      },
    ]),
    getSystemResources: vi.fn().mockReturnValue({
      cpuCount: 4,
      cpuModel: "Virtual CPU",
      totalMemBytes: 8 * 1024 ** 3,
      freeMemBytes: 4 * 1024 ** 3,
      usedMemBytes: 4 * 1024 ** 3,
      memUsagePercent: 50,
      processUptimeSeconds: 120,
      systemUptimeSeconds: 3600,
      nodeMemory: process.memoryUsage(),
      platform: "linux",
      arch: "x64",
    }),
    isOrphanOrZombieProcess,
    ...overrides.hostProbe,
  };

  const processControl: ProcessControlPort = {
    tailLogFile: vi.fn().mockResolvedValue({
      fileName: "worker_import.log",
      lines: ["[INFO] Batch 1 processed", "[INFO] Batch 2 processed"],
      totalLines: 2,
      sizeBytes: 1024,
      lastModified: new Date().toISOString(),
    }),
    terminateProcess: vi.fn().mockResolvedValue({
      success: true,
      pid: 12345,
      signal: "SIGTERM",
    }),
    restartWorker: vi.fn().mockResolvedValue({
      success: true,
      message: "Worker Impor berhasil dimulai ulang.",
      newPid: 99887,
    }),
    cleanOrphanProcesses: vi.fn().mockResolvedValue({
      killedPids: [],
      count: 0,
      errors: [],
    }),
    ...overrides.processControl,
  };

  return createSystemProcessesRouter({
    telemetry: createSystemTelemetry({
      store: createInMemoryTelemetryStore(),
      hostProbe,
    }),
    processControl,
  });
}

describe("systemProcessesRouter Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const superAdminContext = {
    prisma,
    user: {
      id: "admin-1",
      name: "Super Admin",
      username: "admin1",
      email: "admin@pln.co.id",
      role: Role.SUPER_ADMIN,
      up3Id: null,
      ulpId: null,
    },
    req: {} as any,
    res: {} as any,
  };

  const operatorContext = {
    prisma,
    user: {
      id: "op-1",
      name: "Operator Triase",
      username: "operator1",
      email: "operator@pln.co.id",
      role: Role.PEGAWAI,
      up3Id: null,
      ulpId: null,
    },
    req: {} as any,
    res: {} as any,
  };

  describe("1. RBAC and Authentication Guards", () => {
    it("should reject unauthenticated request with UNAUTHORIZED", async () => {
      const caller = buildFakeRouter().createCaller({
        prisma,
        user: null,
        req: {} as any,
        res: {} as any,
      } as any);

      await expect(caller.getSystemOverview()).rejects.toThrow("UNAUTHORIZED");
    });

    it("should reject PEGAWAI operator with FORBIDDEN (403)", async () => {
      const caller = buildFakeRouter().createCaller(operatorContext as any);
      await expect(caller.getSystemOverview()).rejects.toThrow("Akses eksklusif Super Admin.");
      await expect(caller.getRunningProcesses()).rejects.toThrow("Akses eksklusif Super Admin.");
      await expect(caller.getServiceLogs({ fileName: "worker_import.log", lines: 50 })).rejects.toThrow("Akses eksklusif Super Admin.");
    });
  });

  describe("2. Queries for Super Admin", () => {
    it("getSystemOverview should return services and host resources", async () => {
      const caller = buildFakeRouter().createCaller(superAdminContext as any);
      const result = await caller.getSystemOverview();

      expect(result.services).toBeDefined();
      expect(result.services.length).toBe(1);
      expect(result.resources).toBeDefined();
      expect(result.resources.cpuCount).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    it("getRunningProcesses should return managed processes list", async () => {
      const caller = buildFakeRouter().createCaller(superAdminContext as any);
      const result = await caller.getRunningProcesses();

      expect(result.processes.length).toBe(1);
      expect(result.processes[0].serviceType).toBe("IMPORT_WORKER");
      expect(result.totalCount).toBe(1);
    });

    it("getServiceLogs should tail target log file", async () => {
      const caller = buildFakeRouter().createCaller(superAdminContext as any);
      const result = await caller.getServiceLogs({ fileName: "worker_import.log", lines: 10 });

      expect(result.fileName).toBe("worker_import.log");
      expect(result.lines.length).toBe(2);
    });
  });

  describe("3. Mutations with Audit Trail", () => {
    it("terminateProcess should execute termination and log audit event", async () => {
      const caller = buildFakeRouter().createCaller(superAdminContext as any);
      const result = await caller.terminateProcess({
        pid: 12345,
        reason: "Stuck socket connection",
        force: false,
      });

      expect(result.success).toBe(true);
      expect(result.result.signal).toBe("SIGTERM");
      expect(auditService.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-1",
          action: "KILL_BACKGROUND_PROCESS",
          entityType: "Process",
          entityId: "12345",
        })
      );
    });

    it("restartWorker should restart worker and log audit event", async () => {
      const caller = buildFakeRouter().createCaller(superAdminContext as any);
      const result = await caller.restartWorker({
        workerType: "import",
        reason: "Manual restart",
      });

      expect(result.success).toBe(true);
      expect(result.newPid).toBe(99887);
      expect(auditService.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-1",
          action: "RESTART_WORKER_SERVICE",
          entityType: "Worker",
          entityId: "import",
        })
      );
    });
  });
});
