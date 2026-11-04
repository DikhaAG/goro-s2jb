import { z } from "zod";
import { router, adminProcedure, operatorProcedure } from "../trpc";
import {
  detectServicePorts,
  listAppProcesses,
  getSystemResources,
  tailLogFile,
  terminateProcess,
  restartWorker,
  cleanOrphanProcesses,
} from "@/lib/processManager";
import { logAuditEvent } from "@/server/services/auditService";
import { getActiveAlerts, getPublicOperatorAlertSummary } from "@/server/services/alertService";

export const systemProcessesRouter = router({
  /**
   * Proactive anomaly alerts for Super Admin dashboard.
   */
  getActiveSystemAlerts: adminProcedure.query(async () => {
    const alerts = await getActiveAlerts();
    return {
      alerts,
      totalCount: alerts.length,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Sanitized operator alert summary for PEGAWAI.
   */
  getOperatorAlertSummary: operatorProcedure.query(async () => {
    return await getPublicOperatorAlertSummary();
  }),

  /**
   * Lightweight operational status indicator accessible by PEGAWAI and SUPER_ADMIN.
   * Strips all internal OS kernel PIDs, ports, and memory data for safe operator consumption.
   */
  getServiceHealthSummary: operatorProcedure.query(async () => {
    const services = await detectServicePorts();
    const allUp = services.every((s) => s.status === "UP");
    const anyDegraded = services.some((s) => s.status === "DEGRADED");
    const anyDown = services.some((s) => s.status === "DOWN");

    let status: "OPERATIONAL" | "DEGRADED" | "DOWN" = "OPERATIONAL";
    let message = "Semua layanan sistem berjalan normal.";

    if (anyDown) {
      status = "DOWN";
      message = "Sebagian layanan sistem sedang mengalami gangguan.";
    } else if (anyDegraded) {
      status = "DEGRADED";
      message = "Layanan sistem beroperasi dengan latensi meningkat.";
    }

    return {
      isHealthy: allUp,
      status,
      message,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Returns overview of 4 primary service ports and machine telemetry.
   */
  getSystemOverview: adminProcedure.query(async () => {
    const [services, resources] = await Promise.all([
      detectServicePorts(),
      Promise.resolve(getSystemResources()),
    ]);

    return {
      services,
      resources,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Returns running OS processes filtered for GORO S2JB ecosystem.
   */
  getRunningProcesses: adminProcedure.query(async () => {
    const processes = await listAppProcesses();
    return {
      processes,
      totalCount: processes.length,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Tails lines from a target log file in the logs/ directory.
   */
  getServiceLogs: adminProcedure
    .input(
      z.object({
        fileName: z.string().default("worker_import.log"),
        lines: z.number().min(1).max(500).default(100),
      })
    )
    .query(async ({ input }) => {
      const result = await tailLogFile(input.fileName, input.lines);
      return result;
    }),

  /**
   * Terminates a specific application process safely with audit trail.
   */
  terminateProcess: adminProcedure
    .input(
      z.object({
        pid: z.number().int().positive(),
        reason: z.string().min(5, "Alasan penghentian proses wajib diisi minimal 5 karakter."),
        force: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await terminateProcess(input.pid, input.force);

      // Record immutable audit event
      await logAuditEvent({
        userId: ctx.user.id,
        action: "KILL_BACKGROUND_PROCESS",
        entityType: "Process",
        entityId: String(input.pid),
        metadata: {
          pid: input.pid,
          signal: result.signal,
          force: input.force,
          reason: input.reason,
          executor: ctx.user.username || ctx.user.name,
        },
      });

      return {
        success: true,
        message: `Proses PID ${input.pid} berhasil dihentikan (Sinyal: ${result.signal}).`,
        result,
      };
    }),

  /**
   * Restarts or launches an application worker in background with audit trail.
   */
  restartWorker: adminProcedure
    .input(
      z.object({
        workerType: z.enum(["import", "ocr", "python"]),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await restartWorker(input.workerType);

      // Record immutable audit event
      await logAuditEvent({
        userId: ctx.user.id,
        action: "RESTART_WORKER_SERVICE",
        entityType: "Worker",
        entityId: input.workerType,
        metadata: {
          workerType: input.workerType,
          newPid: result.newPid,
          reason: input.reason || "Pemicu restart manual oleh Super Admin",
          executor: ctx.user.username || ctx.user.name,
        },
      });

      return result;
    }),

  /**
   * Scans and cleans orphan or hanging background processes with audit trail.
   */
  cleanOrphanProcesses: adminProcedure
    .input(
      z
        .object({
          reason: z.string().optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      const result = await cleanOrphanProcesses();

      if (result.count > 0) {
        await logAuditEvent({
          userId: ctx.user.id,
          action: "CLEAN_ORPHAN_PROCESSES",
          entityType: "System",
          entityId: "orphans",
          metadata: {
            killedPids: result.killedPids,
            count: result.count,
            reason: input?.reason || "Pembersihan berkala proses zombie/hanging oleh Super Admin",
            executor: ctx.user.username || ctx.user.name,
          },
        });
      }

      return {
        success: true,
        message:
          result.count > 0
            ? `${result.count} proses menggantung / zombie berhasil dihentikan.`
            : "Tidak ditemukan proses menggantung atau zombie.",
        ...result,
      };
    }),
});

export type SystemProcessesRouter = typeof systemProcessesRouter;
