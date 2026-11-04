import { getDownloaderNetworkMetrics } from "./evidenceDownloader";
import { getQueueThroughputStatsSync } from "../queues/queueTelemetry";
import {
  detectServicePorts,
  listAppProcesses,
  getSystemResources,
} from "@/lib/processManager";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface SystemAlert {
  id: string;
  code:
    | "GDRIVE_RATE_LIMITED"
    | "QUEUE_STALLED"
    | "WORKER_MEMORY_HIGH"
    | "CORE_PORT_DOWN"
    | "ORPHAN_PROCESS_DETECTED";
  severity: AlertSeverity;
  message: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface OperatorAlertSummary {
  hasActiveAlert: boolean;
  status: "NORMAL" | "WARNING" | "CRITICAL";
  userMessage: string;
  timestamp: string;
}

// In-memory alert cache
let activeAlertsCache: SystemAlert[] = [];
let lastEvaluatedAt: number = 0;
const EVALUATION_COOLDOWN_MS = 5000;

/**
 * Evaluates real-time telemetry metrics and returns system anomaly alerts.
 */
export async function evaluateSystemAlerts(force: boolean = false): Promise<SystemAlert[]> {
  const now = Date.now();
  if (!force && now - lastEvaluatedAt < EVALUATION_COOLDOWN_MS && activeAlertsCache.length > 0) {
    return activeAlertsCache;
  }

  const alerts: SystemAlert[] = [];

  try {
    // 1. Evaluate Google Drive & Downloader Health
    const dlMetrics = getDownloaderNetworkMetrics();
    const totalDlReqs = dlMetrics.totalRequests;
    const failedDlStreams = dlMetrics.failedStreams;
    const dlFailureRatio = totalDlReqs > 0 ? failedDlStreams / totalDlReqs : 0;
    const isDlThrottled =
      dlMetrics.rejectionReasons.httpError > 2 ||
      dlMetrics.rejectionReasons.timeoutAbort > 2 ||
      (totalDlReqs >= 5 && dlFailureRatio > 0.2);

    if (isDlThrottled) {
      alerts.push({
        id: `alert-gdrive-${Date.now()}`,
        code: "GDRIVE_RATE_LIMITED",
        severity: "WARNING",
        message: `Terdeteksi pembatasan laju (throttling) atau kegagalan unduh Google Drive (${failedDlStreams} kegagalan dari ${totalDlReqs} permintaan).`,
        source: "evidenceDownloader",
        timestamp: new Date().toISOString(),
        metadata: {
          totalRequests: totalDlReqs,
          failedStreams: failedDlStreams,
          failureRatio: Number(dlFailureRatio.toFixed(2)),
          rejections: dlMetrics.rejectionReasons,
        },
      });
    }

    // 2. Evaluate BullMQ Queue Stall Telemetry
    const importTelemetry = getQueueThroughputStatsSync("import");
    const ocrTelemetry = getQueueThroughputStatsSync("ocr");
    const totalStalled = importTelemetry.stalledJobsCount + ocrTelemetry.stalledJobsCount;

    if (totalStalled > 0) {
      alerts.push({
        id: `alert-queue-stalled-${Date.now()}`,
        code: "QUEUE_STALLED",
        severity: "CRITICAL",
        message: `Terdeteksi ${totalStalled} job antrean terhenti (stalled > 180 detik) tanpa progres.`,
        source: "queueTelemetry",
        timestamp: new Date().toISOString(),
        metadata: {
          importStalled: importTelemetry.stalledJobsCount,
          ocrStalled: ocrTelemetry.stalledJobsCount,
          importStalledJobIds: importTelemetry.stalledJobIds,
          ocrStalledJobIds: ocrTelemetry.stalledJobIds,
        },
      });
    }

    // 3. Evaluate Core TCP Ports
    const services = await detectServicePorts();
    const downServices = services.filter((s) => s.status === "DOWN");

    if (downServices.length > 0) {
      const downNames = downServices.map((s) => `${s.name} (Port ${s.port})`).join(", ");
      alerts.push({
        id: `alert-port-down-${Date.now()}`,
        code: "CORE_PORT_DOWN",
        severity: "CRITICAL",
        message: `Layanan inti tidak dapat dihubungi atau port TCP tertutup: ${downNames}.`,
        source: "processManager.detectServicePorts",
        timestamp: new Date().toISOString(),
        metadata: {
          downPorts: downServices.map((s) => s.port),
          downServices: downServices.map((s) => s.name),
        },
      });
    }

    // 4. Evaluate OS Processes for High Memory or Zombie/Orphan
    const [processes, resources] = await Promise.all([
      listAppProcesses(),
      Promise.resolve(getSystemResources()),
    ]);

    const highMemProcs = processes.filter((p) => p.rssKb > 500 * 1024);
    if (highMemProcs.length > 0 || resources.memUsagePercent > 92) {
      alerts.push({
        id: `alert-high-mem-${Date.now()}`,
        code: "WORKER_MEMORY_HIGH",
        severity: "WARNING",
        message: `Penggunaan memori tinggi terdeteksi (${resources.memUsagePercent}% sistem terpakai). Terdapat ${highMemProcs.length} proses melebihi batas 500 MB.`,
        source: "processManager.getSystemResources",
        timestamp: new Date().toISOString(),
        metadata: {
          systemMemPercent: resources.memUsagePercent,
          highMemoryPids: highMemProcs.map((p) => ({
            pid: p.pid,
            memoryMb: Math.round(p.rssKb / 1024),
          })),
        },
      });
    }

    const orphanProcs = processes.filter((p) => p.status === "ORPHAN" || p.status === "ZOMBIE");
    if (orphanProcs.length > 0) {
      alerts.push({
        id: `alert-orphan-${Date.now()}`,
        code: "ORPHAN_PROCESS_DETECTED",
        severity: "WARNING",
        message: `Terdeteksi ${orphanProcs.length} proses detached atau zombie yang tidak terikat terminal aktif.`,
        source: "processManager.listAppProcesses",
        timestamp: new Date().toISOString(),
        metadata: {
          orphanPids: orphanProcs.map((p) => p.pid),
        },
      });
    }

    activeAlertsCache = alerts;
    lastEvaluatedAt = now;
  } catch (err: any) {
    console.error("Error evaluating system alerts:", err);
  }

  return activeAlertsCache;
}

/**
 * Returns current active alerts for administrators.
 */
export async function getActiveAlerts(): Promise<SystemAlert[]> {
  return evaluateSystemAlerts();
}

/**
 * Returns a sanitized, safe operational summary suitable for PEGAWAI (operators).
 * Strips technical kernel data, PIDs, internal ports, and stack traces.
 */
export async function getPublicOperatorAlertSummary(): Promise<OperatorAlertSummary> {
  const alerts = await evaluateSystemAlerts();

  if (alerts.length === 0) {
    return {
      hasActiveAlert: false,
      status: "NORMAL",
      userMessage: "Semua layanan sistem dan mesin ekstraksi beroperasi normal.",
      timestamp: new Date().toISOString(),
    };
  }

  const hasCritical = alerts.some((a) => a.severity === "CRITICAL");
  if (hasCritical) {
    return {
      hasActiveAlert: true,
      status: "CRITICAL",
      userMessage: "Pemrosesan otomatis ulasan sedang mengalami kendala. Tim administrator sedang menindaklanjuti.",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    hasActiveAlert: true,
    status: "WARNING",
    userMessage: "Pemrosesan otomatis ulasan sedang padat atau mengalami antrean. Anda tetap dapat melakukan verifikasi manual pada ulasan yang tersedia.",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Utility to reset alert cache for tests.
 */
export function resetAlertsCache(): void {
  activeAlertsCache = [];
  lastEvaluatedAt = 0;
}
