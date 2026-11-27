import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type {
  HostProbePort,
  ManagedProcess,
  NetworkTrafficHistorySnapshot,
  ServicePortInfo,
  ServiceType,
  SystemResources,
  TrafficTimeRange,
  VisionEngineProbePort,
  VisionEngineProbeResult,
} from "./types";

const execAsync = promisify(exec);
const OCR_HEALTH_TIMEOUT_MS = 3500;

const portLatencyHistory = new Map<number, number[]>();

export function recordPortLatency(port: number, latencyMs: number): void {
  const list = portLatencyHistory.get(port) || [];
  list.push(Math.max(0, latencyMs));
  if (list.length > 5) {
    list.splice(0, list.length - 5);
  }
  portLatencyHistory.set(port, list);
}

export function getPortLatencyHistory(port: number): number[] {
  return [...(portLatencyHistory.get(port) || [])];
}

export function resetPortLatencyHistory(): void {
  portLatencyHistory.clear();
}

/**
 * Checks TCP socket connectivity to determine latency and reachability of a service port.
 */
export async function checkPortConnectivity(
  port: number,
  host: string = "127.0.0.1",
  timeoutMs: number = 800
): Promise<{ isReachable: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let resolved = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      if (resolved) return;
      resolved = true;
      const latencyMs = Date.now() - startTime;
      recordPortLatency(port, latencyMs);
      cleanup();
      resolve({ isReachable: true, latencyMs });
    });

    socket.once("timeout", () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ isReachable: false, latencyMs: timeoutMs });
    });

    socket.once("error", () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ isReachable: false, latencyMs: 0 });
    });

    socket.connect(port, host);
  });
}

/**
 * Finds the process PID currently binding a given network port using lsof/netstat.
 */
export async function getPidForPort(port: number): Promise<number | null> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execAsync(`netstat -ano -p tcp | findstr :${port}`);
      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        if (line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(pid) && pid > 0) return pid;
        }
      }
      return null;
    }

    const { stdout } = await execAsync(
      `lsof -ti :${port} -sTCP:LISTEN 2>/dev/null || lsof -ti :${port} 2>/dev/null`
    );
    const pids = stdout
      .trim()
      .split("\n")
      .map((p) => parseInt(p.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    return pids.length > 0 ? pids[0] : null;
  } catch {
    return null;
  }
}

/**
 * Parses host and port from a service connection URL (e.g. DATABASE_URL, REDIS_URL,
 * OCR_SERVICE_URL), normalizing wildcard bind hosts to defaultHost.
 */
export function resolveServiceEndpoint(
  rawUrl: string | undefined,
  defaultHost: string,
  defaultPort: number
): { host: string; port: number } {
  if (!rawUrl || !rawUrl.trim()) {
    return { host: defaultHost, port: defaultPort };
  }

  try {
    const parsed = new URL(rawUrl.trim());
    const hostname = parsed.hostname?.trim();
    const host =
      !hostname || hostname === "0.0.0.0" || hostname === "::"
        ? defaultHost
        : hostname;

    let port = defaultPort;
    if (parsed.port) {
      const parsedPort = parseInt(parsed.port, 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        port = parsedPort;
      }
    } else if (parsed.protocol === "https:") {
      port = 443;
    } else if (parsed.protocol === "http:") {
      port = 80;
    }

    return { host, port };
  } catch {
    return { host: defaultHost, port: defaultPort };
  }
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1"
  );
}

/**
 * Inspects all 4 core services to determine endpoint reachability, latency, and local PID.
 */
export async function detectServicePorts(): Promise<ServicePortInfo[]> {
  const pgEndpoint = resolveServiceEndpoint(process.env.DATABASE_URL, "127.0.0.1", 5432);
  const redisEndpoint = resolveServiceEndpoint(process.env.REDIS_URL, "127.0.0.1", 6379);
  const ocrEndpoint = resolveServiceEndpoint(process.env.OCR_SERVICE_URL, "127.0.0.1", 8001);
  const parsedWebPort = parseInt(process.env.PORT || "3000", 10);
  const webPort = !isNaN(parsedWebPort) && parsedWebPort > 0 ? parsedWebPort : 3000;

  const serviceDefs: Array<{
    name: string;
    host: string;
    port: number;
    serviceType: ServiceType;
  }> = [
    {
      name: "PostgreSQL Database",
      host: pgEndpoint.host,
      port: pgEndpoint.port,
      serviceType: "POSTGRES",
    },
    {
      name: "Redis In-Memory Broker",
      host: redisEndpoint.host,
      port: redisEndpoint.port,
      serviceType: "REDIS",
    },
    {
      name: "Rust Native Vision Engine",
      host: ocrEndpoint.host,
      port: ocrEndpoint.port,
      serviceType: "RUST_OCR",
    },
    {
      name: "Next.js Web Application",
      host: "127.0.0.1",
      port: webPort,
      serviceType: "WEB_SERVER",
    },
  ];

  const results: ServicePortInfo[] = await Promise.all(
    serviceDefs.map(async (svc) => {
      const conn = await checkPortConnectivity(svc.port, svc.host);
      const pid = isLoopbackHost(svc.host) ? await getPidForPort(svc.port) : null;

      const recentLatencies = getPortLatencyHistory(svc.port);
      let averageLatencyMs: number | undefined;
      if (recentLatencies.length > 0) {
        const sum = recentLatencies.reduce((a, b) => a + b, 0);
        averageLatencyMs = Math.round(sum / recentLatencies.length);
      } else if (conn.isReachable) {
        averageLatencyMs = conn.latencyMs;
      }

      let status: "UP" | "DOWN" | "DEGRADED" = "DOWN";
      if (conn.isReachable) {
        status =
          (averageLatencyMs && averageLatencyMs > 300) || conn.latencyMs > 300
            ? "DEGRADED"
            : "UP";
      }

      let processCommand: string | undefined;
      let finalName = svc.name;

      if (pid) {
        try {
          let processCommandText = "";
          if (process.platform === "win32") {
            const { stdout } = await execAsync(
              `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\").CommandLine"`
            );
            processCommandText = stdout.trim();
          } else {
            const { stdout } = await execAsync(`ps -p ${pid} -o command= 2>/dev/null`);
            processCommandText = stdout.trim();
          }
          processCommand = processCommandText || undefined;
          if (
            svc.port === ocrEndpoint.port &&
            processCommand?.toLowerCase().includes("goro-engine")
          ) {
            finalName = "Rust Native Vision Engine (goro-engine)";
          }
        } catch {
          // ignore error fetching command
        }
      }

      return {
        name: finalName,
        port: svc.port,
        serviceType: svc.serviceType,
        status,
        latencyMs: conn.isReachable ? conn.latencyMs : undefined,
        recentLatencies,
        averageLatencyMs,
        pid: pid || undefined,
        processCommand,
      };
    })
  );

  return results;
}

/**
 * Classifies an OS process based on command string into an application ServiceType.
 */
export function classifyServiceType(command: string): {
  serviceType: ServiceType;
  isSafeToKill: boolean;
} {
  const lower = command.toLowerCase();

  if (lower.includes("importworker.ts") || lower.includes("worker:import")) {
    return { serviceType: "IMPORT_WORKER", isSafeToKill: true };
  }
  if (lower.includes("ocrworker.ts") || lower.includes("worker:ocr")) {
    return { serviceType: "OCR_WORKER", isSafeToKill: true };
  }
  if (lower.includes("goro-engine")) {
    return { serviceType: "RUST_OCR", isSafeToKill: true };
  }
  if (lower.includes("scripts/start-mac.sh") || lower.includes("scripts/start-windows.ps1")) {
    return { serviceType: "CLI_TASK", isSafeToKill: true };
  }
  if (lower.includes("next dev") || lower.includes("next-server") || lower.includes("next start")) {
    return { serviceType: "WEB_SERVER", isSafeToKill: false };
  }
  if (lower.includes("redis-server")) {
    return { serviceType: "REDIS", isSafeToKill: false };
  }
  if (lower.includes("postgres")) {
    return { serviceType: "POSTGRES", isSafeToKill: false };
  }
  if (lower.includes("goro-s2jb")) {
    return { serviceType: "CLI_TASK", isSafeToKill: true };
  }

  return { serviceType: "OTHER", isSafeToKill: false };
}

function isRelatedProcessCommand(command: string): boolean {
  return (
    command.includes("goro-s2jb") ||
    command.includes("goro-engine") ||
    command.includes("importWorker.ts") ||
    command.includes("ocrWorker.ts") ||
    command.includes("worker:import") ||
    command.includes("worker:ocr") ||
    command.includes("redis-server") ||
    command.includes("postgres")
  );
}

function buildManagedProcess(
  pid: number,
  ppid: number,
  cpuPercent: number,
  memPercent: number,
  rssKb: number,
  status: string,
  elapsedTime: string,
  command: string,
  currentPid: number
): ManagedProcess {
  const { serviceType, isSafeToKill } = classifyServiceType(command);
  const safe = isSafeToKill && pid !== currentPid && pid > 100;
  return {
    pid,
    ppid,
    cpuPercent,
    memPercent,
    rssKb,
    status,
    elapsedTime,
    command,
    serviceType,
    isSafeToKill: safe,
  };
}

/**
 * Lists running processes on the host operating system filtered specifically for GORO S2JB ecosystem.
 */
export async function listAppProcesses(): Promise<ManagedProcess[]> {
  try {
    if (process.platform === "win32") {
      try {
        const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine -like '*goro*' -or $_.CommandLine -like '*node*' -or $_.CommandLine -like '*redis*' -or $_.CommandLine -like '*postgres*') } | Select-Object ProcessId, ParentProcessId, CommandLine | ConvertTo-Json -Compress"`;
        const { stdout } = await execAsync(psCmd);
        if (!stdout.trim()) return [];

        const parsed = JSON.parse(stdout.trim());
        const rawList = Array.isArray(parsed) ? parsed : [parsed];
        const processes: ManagedProcess[] = [];
        const currentPid = process.pid;

        for (const item of rawList) {
          const pid = Number(item.ProcessId);
          const ppid = Number(item.ParentProcessId) || 0;
          const command = String(item.CommandLine || "");
          if (!command || isNaN(pid) || pid <= 0 || !isRelatedProcessCommand(command)) {
            continue;
          }

          processes.push(
            buildManagedProcess(pid, ppid, 0, 0, 0, "RUNNING", "N/A", command, currentPid)
          );
        }

        return processes;
      } catch (winErr) {
        console.error("Error querying Windows processes:", winErr);
        return [];
      }
    }

    const processes: ManagedProcess[] = [];
    const currentPid = process.pid;

    try {
      const { stdout } = await execAsync(
        "ps -axo pid,ppid,pcpu,pmem,rss,stat,etime,command 2>/dev/null"
      );
      const lines = stdout.trim().split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const match = line.match(
          /^(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/
        );
        if (!match) continue;

        const command = match[8];
        if (!isRelatedProcessCommand(command)) continue;

        processes.push(
          buildManagedProcess(
            parseInt(match[1], 10),
            parseInt(match[2], 10),
            parseFloat(match[3]),
            parseFloat(match[4]),
            parseInt(match[5], 10),
            match[6],
            match[7],
            command,
            currentPid
          )
        );
      }
    } catch {
      const { stdout } = await execAsync("ps -o pid,ppid,stat,args 2>/dev/null");
      const lines = stdout.trim().split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/);
        if (!match) continue;

        const command = match[4];
        if (!isRelatedProcessCommand(command)) continue;

        processes.push(
          buildManagedProcess(
            parseInt(match[1], 10),
            parseInt(match[2], 10),
            0,
            0,
            0,
            match[3],
            "N/A",
            command,
            currentPid
          )
        );
      }
    }

    return processes.sort((a, b) => b.cpuPercent - a.cpuPercent);
  } catch {
    return [];
  }
}

/**
 * Returns overall hardware and operating system telemetry.
 */
export function getSystemResources(): SystemResources {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 10000) / 100;

  return {
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model || "Unknown CPU",
    totalMemBytes: totalMem,
    freeMemBytes: freeMem,
    usedMemBytes: usedMem,
    memUsagePercent,
    processUptimeSeconds: Math.floor(process.uptime()),
    systemUptimeSeconds: Math.floor(os.uptime()),
    nodeMemory: process.memoryUsage(),
    platform: os.platform(),
    arch: os.arch(),
  };
}

/**
 * Canonical orphan/zombie predicate shared between OS process cleanup and Peringatan Anomali.
 */
export function isOrphanOrZombieProcess(proc: ManagedProcess): boolean {
  const isDetachedCli = proc.serviceType === "CLI_TASK" && proc.isSafeToKill;
  const isDefunct = proc.status.includes("Z");
  const isOrphanWorker =
    (proc.serviceType === "IMPORT_WORKER" || proc.serviceType === "OCR_WORKER") &&
    (proc.ppid === 1 || proc.status.includes("Z"));
  return isDetachedCli || isDefunct || isOrphanWorker;
}

export function createDefaultVisionEngineProbe(): VisionEngineProbePort {
  return {
    async probe(): Promise<VisionEngineProbeResult> {
      const start = Date.now();
      const ocrUrl = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001";
      let isUp = false;
      let backend: VisionEngineProbeResult["backend"];

      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort(new DOMException("OCR health check timed out", "TimeoutError"));
      }, OCR_HEALTH_TIMEOUT_MS);

      try {
        const res = await fetch(`${ocrUrl}/health`, { signal: controller.signal });
        if (res.ok) {
          isUp = true;
          backend = "http";
        }
      } catch {
        // HTTP not reachable; check native binary fallback
      } finally {
        clearTimeout(timeout);
      }

      if (!isUp) {
        const isWindows = process.platform === "win32";
        const rustBin = path.resolve(
          process.cwd(),
          "rust-services",
          "goro-engine",
          "target",
          "release",
          isWindows ? "goro-engine.exe" : "goro-engine"
        );
        if (fs.existsSync(rustBin)) {
          try {
            await execAsync(`"${rustBin}" --version`, { timeout: 2000 });
            isUp = true;
            backend = "rust_cli";
          } catch {
            // Binary present but not runnable
          }
        }
      }

      if (isUp) {
        return {
          status: "up",
          latencyMs: Date.now() - start,
          backend,
        };
      }

      return {
        status: "down",
        error: "OCR engine is offline and no executable binary found",
      };
    },
  };
}

export function createDefaultHostProbe(): HostProbePort {
  return {
    detectServicePorts,
    listAppProcesses,
    getSystemResources,
    isOrphanOrZombieProcess,
  };
}

export function parseRedisInfo(
  infoMemory: string,
  infoServer: string,
  infoClients: string
) {
  const findVal = (str: string, key: string) => {
    const match = str.match(new RegExp(`^${key}:(.+)$`, "m"));
    return match ? match[1].trim() : "";
  };

  return {
    version: findVal(infoServer, "redis_version") || "7.0.x",
    usedMemory: findVal(infoMemory, "used_memory_human") || "N/A",
    peakMemory: findVal(infoMemory, "used_memory_peak_human") || "N/A",
    fragmentationRatio: findVal(infoMemory, "mem_fragmentation_ratio") || "1.0",
    connectedClients: parseInt(findVal(infoClients, "connected_clients") || "1", 10),
    uptimeSeconds: parseInt(findVal(infoServer, "uptime_in_seconds") || "0", 10),
  };
}

export async function detectStalledJobs(
  queue: any,
  maxActiveDurationMs: number,
  nowMs: number
): Promise<{ stalledCount: number; stalledJobIds: string[] }> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const activeJobs = await Promise.race([
      queue.getJobs(["active"]) as Promise<any[]>,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Queue active jobs timed out")), 1500);
      }),
    ]);
    const stalledJobIds: string[] = [];
    for (const job of activeJobs) {
      if (job.processedOn && nowMs - job.processedOn > maxActiveDurationMs) {
        if (job.id) stalledJobIds.push(String(job.id));
      }
    }
    return {
      stalledCount: stalledJobIds.length,
      stalledJobIds,
    };
  } catch {
    return { stalledCount: 0, stalledJobIds: [] };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface RawTrafficRow {
  bucket: Date;
  processed_count: number;
  completed_count: number;
  failed_count: number;
}

export async function queryNetworkTrafficHistory(
  prisma: any,
  timeRange: TrafficTimeRange,
  nowMs: number
): Promise<NetworkTrafficHistorySnapshot> {
  const now = new Date(nowMs);
  const points: NetworkTrafficHistorySnapshot["points"] = [];

  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let totalBytes = 0;
  let peakRateKbps = 0;

  if (timeRange === "HOUR") {
    const hourlyRaw: RawTrafficRow[] = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('hour', "updatedAt") AS bucket,
        COUNT(CASE WHEN "ocrStatus" IN ('COMPLETED', 'FAILED') THEN 1 END)::int AS processed_count,
        COUNT(CASE WHEN "ocrStatus" = 'COMPLETED' THEN 1 END)::int AS completed_count,
        COUNT(CASE WHEN "ocrStatus" = 'FAILED' THEN 1 END)::int AS failed_count
      FROM "RatingReview"
      WHERE "updatedAt" >= NOW() - INTERVAL '24 hours'
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const hourMap = new Map<string, RawTrafficRow>();
    for (const r of hourlyRaw) {
      const d = new Date(r.bucket);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
      hourMap.set(key, r);
    }

    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600 * 1000);
      d.setUTCMinutes(0, 0, 0);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
      const r = hourMap.get(key);
      const processed = r ? r.processed_count : 0;
      const completed = r ? r.completed_count : 0;
      const failed = r ? r.failed_count : 0;
      const bytes = completed * 280000;
      const rateKbps = Math.round(bytes / 1024 / 3600);

      totalRequests += processed;
      successfulRequests += completed;
      failedRequests += failed;
      totalBytes += bytes;
      if (rateKbps > peakRateKbps) peakRateKbps = rateKbps;

      points.push({
        timestamp: d.getTime(),
        label: d.toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        rateKbps,
        bytesDelta: bytes,
        latencyMs: processed > 0 ? 420 : 0,
        requestsCount: processed,
        completedCount: completed,
        failedCount: failed,
      });
    }
  } else if (timeRange === "DAY") {
    const dailyRaw: RawTrafficRow[] = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "updatedAt") AS bucket,
        COUNT(CASE WHEN "ocrStatus" IN ('COMPLETED', 'FAILED') THEN 1 END)::int AS processed_count,
        COUNT(CASE WHEN "ocrStatus" = 'COMPLETED' THEN 1 END)::int AS completed_count,
        COUNT(CASE WHEN "ocrStatus" = 'FAILED' THEN 1 END)::int AS failed_count
      FROM "RatingReview"
      WHERE "updatedAt" >= NOW() - INTERVAL '30 days'
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const dayMap = new Map<string, RawTrafficRow>();
    for (const r of dailyRaw) {
      const d = new Date(r.bucket);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      dayMap.set(key, r);
    }

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400 * 1000);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const r = dayMap.get(key);
      const processed = r ? r.processed_count : 0;
      const completed = r ? r.completed_count : 0;
      const failed = r ? r.failed_count : 0;
      const bytes = completed * 280000;
      const rateKbps = Math.round(bytes / 1024 / 86400);

      totalRequests += processed;
      successfulRequests += completed;
      failedRequests += failed;
      totalBytes += bytes;
      if (rateKbps > peakRateKbps) peakRateKbps = rateKbps;

      points.push({
        timestamp: d.getTime(),
        label: d.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          day: "2-digit",
          month: "short",
        }),
        rateKbps,
        bytesDelta: bytes,
        latencyMs: processed > 0 ? 420 : 0,
        requestsCount: processed,
        completedCount: completed,
        failedCount: failed,
      });
    }
  } else if (timeRange === "MONTH") {
    const monthlyRaw: RawTrafficRow[] = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "updatedAt") AS bucket,
        COUNT(CASE WHEN "ocrStatus" IN ('COMPLETED', 'FAILED') THEN 1 END)::int AS processed_count,
        COUNT(CASE WHEN "ocrStatus" = 'COMPLETED' THEN 1 END)::int AS completed_count,
        COUNT(CASE WHEN "ocrStatus" = 'FAILED' THEN 1 END)::int AS failed_count
      FROM "RatingReview"
      WHERE "updatedAt" >= NOW() - INTERVAL '12 months'
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const monthMap = new Map<string, RawTrafficRow>();
    for (const r of monthlyRaw) {
      const d = new Date(r.bucket);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, r);
    }

    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const r = monthMap.get(key);
      const processed = r ? r.processed_count : 0;
      const completed = r ? r.completed_count : 0;
      const failed = r ? r.failed_count : 0;
      const bytes = completed * 280000;
      const rateKbps = Math.round(bytes / 1024 / (30 * 86400));

      totalRequests += processed;
      successfulRequests += completed;
      failedRequests += failed;
      totalBytes += bytes;
      if (rateKbps > peakRateKbps) peakRateKbps = rateKbps;

      points.push({
        timestamp: d.getTime(),
        label: d.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          month: "short",
          year: "numeric",
        }),
        rateKbps,
        bytesDelta: bytes,
        latencyMs: processed > 0 ? 420 : 0,
        requestsCount: processed,
        completedCount: completed,
        failedCount: failed,
      });
    }
  } else {
    const yearlyRaw: RawTrafficRow[] = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('year', "updatedAt") AS bucket,
        COUNT(CASE WHEN "ocrStatus" IN ('COMPLETED', 'FAILED') THEN 1 END)::int AS processed_count,
        COUNT(CASE WHEN "ocrStatus" = 'COMPLETED' THEN 1 END)::int AS completed_count,
        COUNT(CASE WHEN "ocrStatus" = 'FAILED' THEN 1 END)::int AS failed_count
      FROM "RatingReview"
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const yearMap = new Map<string, RawTrafficRow>();
    for (const r of yearlyRaw) {
      const d = new Date(r.bucket);
      yearMap.set(d.getUTCFullYear().toString(), r);
    }

    const currentYear = now.getUTCFullYear();
    for (let y = currentYear - 4; y <= currentYear; y++) {
      const d = new Date(Date.UTC(y, 0, 1));
      const key = y.toString();
      const r = yearMap.get(key);
      const processed = r ? r.processed_count : 0;
      const completed = r ? r.completed_count : 0;
      const failed = r ? r.failed_count : 0;
      const bytes = completed * 280000;
      const rateKbps = Math.round(bytes / 1024 / (365 * 86400));

      totalRequests += processed;
      successfulRequests += completed;
      failedRequests += failed;
      totalBytes += bytes;
      if (rateKbps > peakRateKbps) peakRateKbps = rateKbps;

      points.push({
        timestamp: d.getTime(),
        label: key,
        rateKbps,
        bytesDelta: bytes,
        latencyMs: processed > 0 ? 420 : 0,
        requestsCount: processed,
        completedCount: completed,
        failedCount: failed,
      });
    }
  }

  return {
    timeRange,
    points,
    summary: {
      totalRequests,
      successfulRequests,
      failedRequests,
      totalBytes,
      peakRateKbps,
      averageLatencyMs: totalRequests > 0 ? 420 : 0,
    },
  };
}
