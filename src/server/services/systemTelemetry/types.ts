import type { EngineBridgeMetrics } from "@/server/services/evidenceVerification/types";

export type ServiceType =
  | "POSTGRES"
  | "REDIS"
  | "PYTHON_OCR"
  | "RUST_OCR"
  | "IMPORT_WORKER"
  | "OCR_WORKER"
  | "WEB_SERVER"
  | "CLI_TASK"
  | "OTHER";

export interface ServicePortInfo {
  name: string;
  port: number;
  serviceType: ServiceType;
  status: "UP" | "DOWN" | "DEGRADED";
  latencyMs?: number;
  recentLatencies?: number[];
  averageLatencyMs?: number;
  pid?: number;
  processCommand?: string;
  error?: string;
}

export interface ManagedProcess {
  pid: number;
  ppid: number;
  cpuPercent: number;
  memPercent: number;
  rssKb: number;
  status: string;
  elapsedTime: string;
  command: string;
  serviceType: ServiceType;
  isSafeToKill: boolean;
}

export interface SystemResources {
  cpuCount: number;
  cpuModel: string;
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemBytes: number;
  memUsagePercent: number;
  processUptimeSeconds: number;
  systemUptimeSeconds: number;
  nodeMemory: NodeJS.MemoryUsage;
  platform: string;
  arch: string;
}

export type QueueKey = "import" | "ocr";
export type TrafficTimeRange = "HOUR" | "DAY" | "MONTH" | "YEAR";
export type DownloaderEndpoint =
  | "endpointUc"
  | "endpointUserContent"
  | "endpointLh3"
  | "directUrl";
export type DownloaderRejectionReason =
  | "htmlResponse"
  | "invalidMagicBytes"
  | "timeoutAbort"
  | "httpError";

export interface NetworkTrafficPoint {
  timestamp: number;
  rateKbps: number;
  bytesDelta: number;
  latencyMs: number;
  requestsCount: number;
}

export interface DownloaderNetworkMetrics {
  totalRequests: number;
  successfulStreams: number;
  failedStreams: number;
  totalBytesStreamed: number;
  averageLatencyMs: number;
  candidateHits: {
    endpointUc: number;
    endpointUserContent: number;
    endpointLh3: number;
    directUrl: number;
  };
  rejectionReasons: {
    htmlResponse: number;
    invalidMagicBytes: number;
    timeoutAbort: number;
    httpError: number;
  };
  cacheStats: {
    hits: number;
    misses: number;
    cachedEntriesCount: number;
  };
  timeSeries?: NetworkTrafficPoint[];
  lastIncident?: {
    timestamp: string;
    url: string;
    error: string;
  };
}

export interface QueueThroughputStats {
  queueName: string;
  throughputJobsPerMinute: number;
  averageExecutionDurationMs: number;
  totalCompletedInWindow: number;
  totalFailedInWindow: number;
  stalledJobsCount: number;
  stalledJobIds: string[];
  lastCompletedJobAt?: string;
  lastFailedJobAt?: string;
}

export type TelemetryEvent =
  | {
      kind: "queue_job";
      queue: QueueKey | string;
      outcome: "completed" | "failed";
      durationMs?: number;
      timestamp?: number;
    }
  | {
      kind: "downloader_stream";
      outcome: "success" | "failure";
      bytes?: number;
      latencyMs: number;
      endpoint?: DownloaderEndpoint;
      rejections?: Partial<Record<DownloaderRejectionReason, number>>;
      incident?: { url: string; error: string };
      timestamp?: number;
    }
  | {
      kind: "downloader_rejection";
      reason: DownloaderRejectionReason;
      timestamp?: number;
    }
  | {
      kind: "downloader_cache";
      hit: boolean;
      cachedEntriesCount?: number;
      bytes?: number;
      endpoint?: DownloaderEndpoint;
      timestamp?: number;
    }
  | {
      kind: "ocr_bridge";
      transport: "http" | "cli";
      outcome: "success" | "failure";
      fallbackTriggered?: boolean;
      durationMs: number;
      timestamp?: number;
    };

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertCode =
  | "GDRIVE_RATE_LIMITED"
  | "QUEUE_STALLED"
  | "WORKER_MEMORY_HIGH"
  | "CORE_PORT_DOWN"
  | "ORPHAN_PROCESS_DETECTED";

export interface SystemAlert {
  id: string;
  code: AlertCode;
  severity: AlertSeverity;
  message: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface OperatorAlertSummary {
  hasActiveAlert: boolean;
  status: "NORMAL" | "WARNING" | "CRITICAL";
  userMessage: string;
  timestamp: string;
}

export interface VisionEngineProbeResult {
  status: "up" | "down";
  latencyMs?: number;
  backend?: "http" | "rust_cli" | "python_venv";
  error?: string;
}

export interface CoreHealthProbe {
  status: "healthy" | "degraded";
  isCriticalUp: boolean;
  timestamp: string;
  executionMs: number;
  database: { status: "up" | "down"; latencyMs?: number; error?: string };
  redis: { status: "up" | "down"; latencyMs?: number; error?: string };
  bullmq?: {
    status: "up" | "down";
    ocrWaiting?: number;
    ocrActive?: number;
    importWaiting?: number;
    importActive?: number;
    error?: string;
  };
  visionEngine?: VisionEngineProbeResult;
  storage?: {
    status: "up" | "down";
    writable: boolean;
    uploadDir: string;
    error?: string;
  };
  downloader?: DownloaderNetworkMetrics;
  ocrBridge?: EngineBridgeMetrics;
}

export interface QueueJobCountsSnapshot {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  prioritized: number;
}

export interface WorkerLiveSnapshot {
  redisStatus: { healthy: boolean; latencyMs: number };
  importQueue: Omit<QueueJobCountsSnapshot, "paused" | "prioritized">;
  ocrQueue: Omit<QueueJobCountsSnapshot, "paused" | "prioritized">;
  databaseMetrics: {
    totalReviews: number;
    pendingReviews: number;
    approvedReviews: number;
  };
}

export interface DetailedQueueSnapshot {
  name: string;
  displayName: string;
  isPaused: boolean;
  counts: QueueJobCountsSnapshot;
  throughput: {
    jobsPerMinute: number;
    averageDurationMs: number;
    completedInWindow: number;
    failedInWindow: number;
    lastCompletedAt?: string;
    lastFailedAt?: string;
  };
  stallDetection: {
    isStalled: boolean;
    stalledCount: number;
    stalledJobIds: string[];
  };
  activeJobs: Array<{
    id?: string;
    name: string;
    batchId?: string;
    filePath?: string;
    startRow?: number;
    reviewId?: string;
    expectedName?: string;
    timestamp: number;
    processedOn?: number;
  }>;
}

export interface DetailedWorkerSnapshot {
  redis: {
    healthy: boolean;
    latencyMs: number;
    version: string;
    usedMemory: string;
    peakMemory: string;
    fragmentationRatio: string;
    connectedClients: number;
    uptimeSeconds: number;
  };
  node: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    uptimeSeconds: number;
  };
  database: {
    totalReviews: number;
    pendingReviews: number;
    needsReviewReviews: number;
    approvedReviews: number;
    rejectedReviews: number;
  };
  gdriveDownloader: DownloaderNetworkMetrics;
  queues: {
    import: DetailedQueueSnapshot;
    ocr: DetailedQueueSnapshot;
  };
}

export interface HostPortsSnapshot {
  isHealthy: boolean;
  status: "OPERATIONAL" | "DEGRADED" | "DOWN";
  message: string;
  services: ServicePortInfo[];
  timestamp: string;
}

export interface HostOverviewSnapshot {
  services: ServicePortInfo[];
  resources: SystemResources;
  timestamp: string;
}

export interface HostProcessesSnapshot {
  processes: ManagedProcess[];
  totalCount: number;
  timestamp: string;
}

export interface NetworkTrafficHistorySnapshot {
  timeRange: TrafficTimeRange;
  points: Array<{
    timestamp: number;
    label: string;
    rateKbps: number;
    bytesDelta: number;
    latencyMs: number;
    requestsCount: number;
    completedCount: number;
    failedCount: number;
  }>;
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalBytes: number;
    peakRateKbps: number;
    averageLatencyMs: number;
  };
}

export type TelemetryNamespace = "downloader" | "ocr_bridge";

export interface QueueWindowSummary {
  completedCount: number;
  failedCount: number;
  avgDurationMs: number;
  lastCompletedAt?: string;
  lastFailedAt?: string;
}

export interface TelemetryStorePort {
  incrementCounters(
    namespace: TelemetryNamespace,
    increments: Record<string, number>
  ): Promise<void>;
  setFields(namespace: TelemetryNamespace, fields: Record<string, string>): Promise<void>;
  readNamespace(namespace: TelemetryNamespace): Promise<Record<string, string>>;
  recordQueueWindowEvent(
    queue: QueueKey,
    outcome: "completed" | "failed",
    timestamp: number,
    durationMs: number
  ): Promise<void>;
  readQueueWindow(
    queue: QueueKey,
    now: number,
    windowMs: number
  ): Promise<QueueWindowSummary>;
  appendDownloaderSeriesPoint(point: NetworkTrafficPoint, maxLength: number): Promise<void>;
  readDownloaderSeries(): Promise<NetworkTrafficPoint[]>;
  reset(scope?: "all" | "downloader" | "ocr_bridge" | "queues"): Promise<void>;
}

export interface VisionEngineProbePort {
  probe(): Promise<VisionEngineProbeResult>;
}

export interface HostProbePort {
  detectServicePorts(): Promise<ServicePortInfo[]>;
  listAppProcesses(): Promise<ManagedProcess[]>;
  getSystemResources(): SystemResources;
  isOrphanOrZombieProcess(proc: ManagedProcess): boolean;
}

export interface SystemTelemetryDeps {
  store?: TelemetryStorePort;
  visionEngineProbe?: VisionEngineProbePort;
  hostProbe?: HostProbePort;
  prisma?: any;
  redis?: any;
  queues?: { import?: any; ocr?: any };
  uploadDir?: string;
  now?: () => number;
  alertCooldownMs?: number;
}

export interface SystemTelemetry {
  record(event: TelemetryEvent): Promise<void>;
  getHealth(scope?: "ping" | "full"): Promise<CoreHealthProbe>;

  getWorkerTelemetry(detail: "live"): Promise<WorkerLiveSnapshot>;
  getWorkerTelemetry(
    detail: "detailed",
    opts?: { includeStalledIds?: boolean }
  ): Promise<DetailedWorkerSnapshot>;

  getHostTelemetry(scope: "ports"): Promise<HostPortsSnapshot>;
  getHostTelemetry(scope: "overview"): Promise<HostOverviewSnapshot>;
  getHostTelemetry(scope: "processes"): Promise<HostProcessesSnapshot>;

  evaluateAlerts(audience: "admin", opts?: { force?: boolean }): Promise<SystemAlert[]>;
  evaluateAlerts(
    audience: "operator",
    opts?: { force?: boolean }
  ): Promise<OperatorAlertSummary>;

  getTrafficHistory(timeRange?: TrafficTimeRange): Promise<NetworkTrafficHistorySnapshot>;
  getDownloaderMetrics(): Promise<DownloaderNetworkMetrics>;
  getEngineBridgeMetrics(): Promise<EngineBridgeMetrics>;
  reset(scope?: "all" | "downloader" | "ocr_bridge" | "queues" | "alerts"): Promise<void>;
}
