import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createOsProcessControl,
  type ProcessControlPort,
} from "@/lib/processManager";
import {
  createInMemoryTelemetryStore,
  createSystemTelemetry,
  getPortLatencyHistory,
  isOrphanOrZombieProcess,
  recordPortLatency,
  resetPortLatencyHistory,
  type HostProbePort,
  type ManagedProcess,
} from "@/server/services/systemTelemetry";
import { createSystemProcessesRouter } from "@/server/routers/systemProcesses";
import * as auditService from "@/server/services/auditService";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

function createFakeHostProbe(processes: ManagedProcess[] = []): HostProbePort {
  return {
    detectServicePorts: vi.fn().mockResolvedValue([
      { name: "PostgreSQL Database", port: 5432, serviceType: "POSTGRES", status: "UP", latencyMs: 5 },
      { name: "Redis Broker", port: 6379, serviceType: "REDIS", status: "UP", latencyMs: 1 },
      { name: "Python OCR", port: 8001, serviceType: "PYTHON_OCR", status: "UP", latencyMs: 12 },
      { name: "Next.js Web", port: 3000, serviceType: "WEB_SERVER", status: "UP", latencyMs: 2 },
    ]),
    listAppProcesses: vi.fn().mockResolvedValue(processes),
    getSystemResources: vi.fn().mockReturnValue({
      cpuCount: 4,
      cpuModel: "Test CPU",
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
  };
}

function createFakeProcessControl(): ProcessControlPort {
  return {
    tailLogFile: vi.fn().mockResolvedValue({
      fileName: "worker_import.log",
      lines: [],
      totalLines: 0,
      sizeBytes: 0,
      lastModified: new Date().toISOString(),
    }),
    terminateProcess: vi.fn().mockResolvedValue({
      success: true,
      pid: 8888,
      signal: "SIGTERM",
    }),
    restartWorker: vi.fn().mockResolvedValue({
      success: true,
      message: "Worker restarted",
      newPid: 9999,
    }),
    cleanOrphanProcesses: vi.fn().mockResolvedValue({
      killedPids: [],
      count: 0,
      errors: [],
    }),
  };
}

describe("Process Manager, TCP Probing, & OS Zombie Cleanup Suite (Task 20.3)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetPortLatencyHistory();
  });

  describe("1. TCP Socket Latency Ring-Buffer History", () => {
    it("should accumulate up to 5 latest latency measurements in ring buffer", () => {
      const PORT = 8001;

      recordPortLatency(PORT, 10);
      recordPortLatency(PORT, 20);
      recordPortLatency(PORT, 30);
      recordPortLatency(PORT, 40);
      recordPortLatency(PORT, 50);

      let history = getPortLatencyHistory(PORT);
      expect(history).toEqual([10, 20, 30, 40, 50]);

      recordPortLatency(PORT, 60);
      history = getPortLatencyHistory(PORT);
      expect(history).toEqual([20, 30, 40, 50, 60]);
    });

    it("should calculate averageLatencyMs across recent socket handshakes", async () => {
      recordPortLatency(5432, 100);
      recordPortLatency(5432, 200);

      const history = getPortLatencyHistory(5432);
      const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
      expect(avg).toBe(150);
    });
  });

  describe("2. Dangerous PID Rejection & Process Protection Guard", () => {
    it("should strictly reject terminating PID <= 100 (Kernel / System Vital PIDs)", async () => {
      const processControl = createOsProcessControl(createFakeHostProbe());

      await expect(processControl.terminateProcess(1)).rejects.toThrow(
        "DILARANG KERAS: Tidak dapat menghentikan proses vital sistem operasi (PID <= 100)."
      );

      await expect(processControl.terminateProcess(42)).rejects.toThrow(
        "DILARANG KERAS: Tidak dapat menghentikan proses vital sistem operasi (PID <= 100)."
      );
    });

    it("should strictly reject terminating self Next.js server process (process.pid)", async () => {
      const processControl = createOsProcessControl(createFakeHostProbe());

      await expect(processControl.terminateProcess(process.pid)).rejects.toThrow(
        "DILARANG: Tidak dapat menghentikan proses server web sendiri."
      );
    });

    it("should strictly reject terminating parent process (process.ppid)", async () => {
      const processControl = createOsProcessControl(createFakeHostProbe());

      await expect(processControl.terminateProcess(process.ppid)).rejects.toThrow(
        "DILARANG: Tidak dapat menghentikan parent proses server web."
      );
    });
  });

  describe("3. Zombie & Orphan Process Auto-Cleaner", () => {
    it("should identify and clean defunct or orphan processes via injected HostProbePort", async () => {
      const mockProcesses: ManagedProcess[] = [
        {
          pid: 1234,
          ppid: 1,
          cpuPercent: 0,
          memPercent: 0.1,
          rssKb: 1024,
          status: "S",
          elapsedTime: "10:00",
          command: "node dist/ocrWorker.js",
          serviceType: "OCR_WORKER",
          isSafeToKill: true,
        },
        {
          pid: 5678,
          ppid: 999,
          cpuPercent: 0,
          memPercent: 0,
          rssKb: 0,
          status: "Z",
          elapsedTime: "05:00",
          command: "<defunct>",
          serviceType: "CLI_TASK",
          isSafeToKill: true,
        },
        {
          pid: 9999,
          ppid: 100,
          cpuPercent: 5.0,
          memPercent: 2.0,
          rssKb: 2048,
          status: "R",
          elapsedTime: "01:00",
          command: "next-server",
          serviceType: "WEB_SERVER",
          isSafeToKill: false,
        },
      ];

      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true as any);
      const processControl = createOsProcessControl(createFakeHostProbe(mockProcesses));

      const result = await processControl.cleanOrphanProcesses();

      expect(result.count).toBe(2);
      expect(result.killedPids).toContain(1234);
      expect(result.killedPids).toContain(5678);
      expect(result.killedPids).not.toContain(9999);
      expect(killSpy).toHaveBeenCalledWith(1234, "SIGTERM");
      expect(killSpy).toHaveBeenCalledWith(5678, "SIGTERM");
    });
  });

  describe("4. tRPC systemProcessesRouter & RBAC Enforcement", () => {
    it("should enforce strict SUPER_ADMIN access on terminateProcess and log audit event", async () => {
      const auditSpy = vi.spyOn(auditService, "logAuditEvent").mockResolvedValue({} as any);
      const router = createSystemProcessesRouter({
        telemetry: createSystemTelemetry({
          store: createInMemoryTelemetryStore(),
          hostProbe: createFakeHostProbe(),
        }),
        processControl: createFakeProcessControl(),
      });

      const superAdminCaller = router.createCaller({
        prisma,
        user: {
          id: "superadmin-user-id",
          name: "Super Admin",
          username: "superadmin",
          email: "superadmin@pln.co.id",
          role: Role.SUPER_ADMIN,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const result = await superAdminCaller.terminateProcess({
        pid: 8888,
        reason: "Restarting unresponsive worker instance",
        force: false,
      });

      expect(result.success).toBe(true);
      expect(result.result.signal).toBe("SIGTERM");

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "superadmin-user-id",
          action: "KILL_BACKGROUND_PROCESS",
          entityType: "Process",
          entityId: "8888",
          metadata: expect.objectContaining({
            pid: 8888,
            reason: "Restarting unresponsive worker instance",
          }),
        })
      );
    });

    it("should strictly reject PEGAWAI operator attempting to terminate process with 403 FORBIDDEN", async () => {
      const router = createSystemProcessesRouter({
        telemetry: createSystemTelemetry({
          store: createInMemoryTelemetryStore(),
          hostProbe: createFakeHostProbe(),
        }),
        processControl: createFakeProcessControl(),
      });

      const pegawaiCaller = router.createCaller({
        prisma,
        user: {
          id: "pegawai-user-id",
          name: "Budi Pegawai",
          username: "budipegawai",
          email: "budi@pln.co.id",
          role: Role.PEGAWAI,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      await expect(
        pegawaiCaller.terminateProcess({
          pid: 8888,
          reason: "Unauthorized attempt",
        })
      ).rejects.toThrow("Akses eksklusif Super Admin.");
    });

    it("should strictly reject PEGAWAI operator attempting to clean orphan processes with 403 FORBIDDEN", async () => {
      const router = createSystemProcessesRouter({
        telemetry: createSystemTelemetry({
          store: createInMemoryTelemetryStore(),
          hostProbe: createFakeHostProbe(),
        }),
        processControl: createFakeProcessControl(),
      });

      const pegawaiCaller = router.createCaller({
        prisma,
        user: {
          id: "pegawai-user-id",
          name: "Budi Pegawai",
          username: "budipegawai",
          email: "budi@pln.co.id",
          role: Role.PEGAWAI,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      await expect(pegawaiCaller.cleanOrphanProcesses()).rejects.toThrow(
        "Akses eksklusif Super Admin."
      );
    });

    it("should allow PEGAWAI operator to access getServiceHealthSummary without exposing OS PIDs", async () => {
      const router = createSystemProcessesRouter({
        telemetry: createSystemTelemetry({
          store: createInMemoryTelemetryStore(),
          hostProbe: createFakeHostProbe(),
        }),
        processControl: createFakeProcessControl(),
      });

      const pegawaiCaller = router.createCaller({
        prisma,
        user: {
          id: "pegawai-user-id",
          name: "Budi Pegawai",
          username: "budipegawai",
          email: "budi@pln.co.id",
          role: Role.PEGAWAI,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const summary = await pegawaiCaller.getServiceHealthSummary();

      expect(summary.isHealthy).toBe(true);
      expect(summary.status).toBe("OPERATIONAL");
      expect(summary.message).toBe("Semua layanan sistem berjalan normal.");
      expect((summary as any).processes).toBeUndefined();
      expect((summary as any).ports).toBeUndefined();
    });
  });
});
