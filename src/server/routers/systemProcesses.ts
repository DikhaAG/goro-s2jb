import { z } from "zod";
import { router, adminProcedure, operatorProcedure } from "../trpc";
import {
  defaultProcessControl,
  type ProcessControlPort,
} from "@/lib/processManager";
import { logAuditEvent } from "@/server/services/auditService";
import {
  systemTelemetry,
  type SystemTelemetry,
} from "@/server/services/systemTelemetry";

export interface SystemProcessesRouterDeps {
  telemetry?: SystemTelemetry;
  processControl?: ProcessControlPort;
}

export function createSystemProcessesRouter(deps: SystemProcessesRouterDeps = {}) {
  const telemetry = deps.telemetry ?? systemTelemetry;
  const processControl = deps.processControl ?? defaultProcessControl;

  return router({
    /**
     * Proactive anomaly alerts for Super Admin dashboard.
     */
    getActiveSystemAlerts: adminProcedure.query(async () => {
      const alerts = await telemetry.evaluateAlerts("admin");
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
      return telemetry.evaluateAlerts("operator");
    }),

    /**
     * Lightweight operational status indicator accessible by PEGAWAI and SUPER_ADMIN.
     * Strips all internal OS kernel PIDs, ports, and memory data for safe operator consumption.
     */
    getServiceHealthSummary: operatorProcedure.query(async () => {
      const { isHealthy, status, message, timestamp } =
        await telemetry.getHostTelemetry("ports");
      return { isHealthy, status, message, timestamp };
    }),

    /**
     * Returns overview of 4 primary service ports and machine telemetry.
     */
    getSystemOverview: adminProcedure.query(async () => {
      return telemetry.getHostTelemetry("overview");
    }),

    /**
     * Returns running OS processes filtered for GORO S2JB ecosystem.
     */
    getRunningProcesses: adminProcedure.query(async () => {
      return telemetry.getHostTelemetry("processes");
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
        return processControl.tailLogFile(input.fileName, input.lines);
      }),

    /**
     * Terminates a specific application process safely with audit trail.
     */
    terminateProcess: adminProcedure
      .input(
        z.object({
          pid: z.number().int().positive(),
          reason: z
            .string()
            .min(5, "Alasan penghentian proses wajib diisi minimal 5 karakter."),
          force: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await processControl.terminateProcess(input.pid, input.force);

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
          workerType: z.enum(["import", "ocr", "rust"]),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await processControl.restartWorker(input.workerType);

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
        const result = await processControl.cleanOrphanProcesses();

        if (result.count > 0) {
          await logAuditEvent({
            userId: ctx.user.id,
            action: "CLEAN_ORPHAN_PROCESSES",
            entityType: "System",
            entityId: "orphans",
            metadata: {
              killedPids: result.killedPids,
              count: result.count,
              reason:
                input?.reason ||
                "Pembersihan berkala proses zombie/hanging oleh Super Admin",
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
}

export const systemProcessesRouter = createSystemProcessesRouter();
export type SystemProcessesRouter = typeof systemProcessesRouter;
