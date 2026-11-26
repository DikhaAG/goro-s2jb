import {
  DownloaderNetworkMetrics,
  HostProbePort,
  OperatorAlertSummary,
  QueueThroughputStats,
  SystemAlert,
} from "./types";

export interface AlertEvaluationInput {
  now: number;
  downloader: DownloaderNetworkMetrics;
  importQueueStats: QueueThroughputStats;
  ocrQueueStats: QueueThroughputStats;
  hostProbe: HostProbePort;
}

export async function computeAnomalyAlerts(
  input: AlertEvaluationInput
): Promise<SystemAlert[]> {
  const { now, downloader, importQueueStats, ocrQueueStats, hostProbe } = input;
  const alerts: SystemAlert[] = [];
  const isoNow = new Date(now).toISOString();

  // 1. Google Drive & Downloader Health
  const totalDlReqs = downloader.totalRequests;
  const failedDlStreams = downloader.failedStreams;
  const dlFailureRatio = totalDlReqs > 0 ? failedDlStreams / totalDlReqs : 0;
  const isDlThrottled =
    downloader.rejectionReasons.httpError > 2 ||
    downloader.rejectionReasons.timeoutAbort > 2 ||
    (totalDlReqs >= 5 && dlFailureRatio > 0.2);

  if (isDlThrottled) {
    alerts.push({
      id: `alert-gdrive-${now}`,
      code: "GDRIVE_RATE_LIMITED",
      severity: "WARNING",
      message: `Terdeteksi pembatasan laju (throttling) atau kegagalan unduh Google Drive (${failedDlStreams} kegagalan dari ${totalDlReqs} permintaan).`,
      source: "evidenceDownloader",
      timestamp: isoNow,
      metadata: {
        totalRequests: totalDlReqs,
        failedStreams: failedDlStreams,
        failureRatio: Number(dlFailureRatio.toFixed(2)),
        rejections: downloader.rejectionReasons,
      },
    });
  }

  // 2. BullMQ Queue Stall Telemetry
  const totalStalled =
    importQueueStats.stalledJobsCount + ocrQueueStats.stalledJobsCount;
  if (totalStalled > 0) {
    alerts.push({
      id: `alert-queue-stalled-${now}`,
      code: "QUEUE_STALLED",
      severity: "CRITICAL",
      message: `Terdeteksi ${totalStalled} job antrean terhenti (stalled > 180 detik) tanpa progres.`,
      source: "systemTelemetry.queues",
      timestamp: isoNow,
      metadata: {
        importStalled: importQueueStats.stalledJobsCount,
        ocrStalled: ocrQueueStats.stalledJobsCount,
        importStalledJobIds: importQueueStats.stalledJobIds,
        ocrStalledJobIds: ocrQueueStats.stalledJobIds,
      },
    });
  }

  // 3. Core TCP Ports
  const services = await hostProbe.detectServicePorts();
  const downServices = services.filter((s) => s.status === "DOWN");
  if (downServices.length > 0) {
    const downNames = downServices.map((s) => `${s.name} (Port ${s.port})`).join(", ");
    alerts.push({
      id: `alert-port-down-${now}`,
      code: "CORE_PORT_DOWN",
      severity: "CRITICAL",
      message: `Layanan inti tidak dapat dihubungi atau port TCP tertutup: ${downNames}.`,
      source: "processManager.detectServicePorts",
      timestamp: isoNow,
      metadata: {
        downPorts: downServices.map((s) => s.port),
        downServices: downServices.map((s) => s.name),
      },
    });
  }

  // 4. OS Processes for High Memory or Zombie/Orphan (using canonical predicate)
  const [processes, resources] = await Promise.all([
    hostProbe.listAppProcesses(),
    Promise.resolve(hostProbe.getSystemResources()),
  ]);

  const highMemProcs = processes.filter((p) => p.rssKb > 500 * 1024);
  if (highMemProcs.length > 0 || resources.memUsagePercent > 92) {
    alerts.push({
      id: `alert-high-mem-${now}`,
      code: "WORKER_MEMORY_HIGH",
      severity: "WARNING",
      message: `Penggunaan memori tinggi terdeteksi (${resources.memUsagePercent}% sistem terpakai). Terdapat ${highMemProcs.length} proses melebihi batas 500 MB.`,
      source: "processManager.getSystemResources",
      timestamp: isoNow,
      metadata: {
        systemMemPercent: resources.memUsagePercent,
        highMemoryPids: highMemProcs.map((p) => ({
          pid: p.pid,
          memoryMb: Math.round(p.rssKb / 1024),
        })),
      },
    });
  }

  const orphanProcs = processes.filter((p) => hostProbe.isOrphanOrZombieProcess(p));
  if (orphanProcs.length > 0) {
    alerts.push({
      id: `alert-orphan-${now}`,
      code: "ORPHAN_PROCESS_DETECTED",
      severity: "WARNING",
      message: `Terdeteksi ${orphanProcs.length} proses detached atau zombie yang tidak terikat terminal aktif.`,
      source: "processManager.listAppProcesses",
      timestamp: isoNow,
      metadata: {
        orphanPids: orphanProcs.map((p) => p.pid),
      },
    });
  }

  return alerts;
}

export function toOperatorAlertSummary(
  alerts: SystemAlert[],
  now: number
): OperatorAlertSummary {
  const timestamp = new Date(now).toISOString();

  if (alerts.length === 0) {
    return {
      hasActiveAlert: false,
      status: "NORMAL",
      userMessage: "Semua layanan sistem dan mesin ekstraksi beroperasi normal.",
      timestamp,
    };
  }

  const hasCritical = alerts.some((a) => a.severity === "CRITICAL");
  if (hasCritical) {
    return {
      hasActiveAlert: true,
      status: "CRITICAL",
      userMessage:
        "Pemrosesan otomatis ulasan sedang mengalami kendala. Tim administrator sedang menindaklanjuti.",
      timestamp,
    };
  }

  return {
    hasActiveAlert: true,
    status: "WARNING",
    userMessage:
      "Pemrosesan otomatis ulasan sedang padat atau mengalami antrean. Anda tetap dapat melakukan verifikasi manual pada ulasan yang tersedia.",
    timestamp,
  };
}
