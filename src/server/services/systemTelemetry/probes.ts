import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as processManager from "@/lib/processManager";
import {
  HostProbePort,
  NetworkTrafficHistorySnapshot,
  TrafficTimeRange,
  VisionEngineProbePort,
  VisionEngineProbeResult,
} from "./types";

const execAsync = promisify(exec);
const OCR_HEALTH_TIMEOUT_MS = 3500;

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
            // Fall through to Python fallback check
          }
        }
      }

      if (!isUp) {
        const venvPaths = [
          path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3"),
          path.resolve(process.cwd(), "python-services/ocr/venv/bin/python"),
          path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python.exe"),
          path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python"),
        ];
        const foundVenv = venvPaths.find((p) => fs.existsSync(p));
        if (foundVenv) {
          try {
            await execAsync(`"${foundVenv}" -c "import rapidfuzz, PIL; print('OK')"`, {
              timeout: 3000,
            });
            isUp = true;
            backend = "python_venv";
          } catch {
            // Unavailable
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
    detectServicePorts: () => processManager.detectServicePorts(),
    listAppProcesses: () => processManager.listAppProcesses(),
    getSystemResources: () => processManager.getSystemResources(),
    isOrphanOrZombieProcess: (proc) => processManager.isOrphanOrZombieProcess(proc),
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
