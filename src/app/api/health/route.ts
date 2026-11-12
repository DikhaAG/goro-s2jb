import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { ocrQueue } from "@/server/queues/ocrQueue";
import { importQueue } from "@/server/queues/importQueue";
import { BASE_UPLOAD_DIR } from "@/lib/storage";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "@/lib/logger";
import { getDownloaderNetworkMetrics } from "@/server/services/evidenceDownloader";
import { getOcrBridgeMetrics } from "@/server/services/ocrBridge";

const execAsync = promisify(exec);
// Keep safely below Docker's 5s HEALTHCHECK timeout while tolerating transient OCR load.
const OCR_HEALTH_TIMEOUT_MS = 3500;

export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  const services: {
    database: { status: "up" | "down"; latency_ms?: number; error?: string };
    redis: { status: "up" | "down"; latency_ms?: number; error?: string };
    bullmq: {
      status: "up" | "down";
      ocr_waiting?: number;
      ocr_active?: number;
      import_waiting?: number;
      import_active?: number;
      error?: string;
    };
    python_ocr: { status: "up" | "down"; latency_ms?: number; error?: string };
    storage: {
      status: "up" | "down";
      writable: boolean;
      upload_dir: string;
      error?: string;
    };
    network_downloader?: {
      status: "up" | "degraded";
      total_requests: number;
      successful_streams: number;
      failed_streams: number;
      average_latency_ms: number;
      bytes_streamed_mb: number;
      cache_hit_rate_pct: number;
      candidate_hits: {
        endpoint_uc: number;
        endpoint_user_content: number;
        endpoint_lh3: number;
        direct_url: number;
      };
      rejection_reasons: {
        html_response: number;
        invalid_magic_bytes: number;
        timeout_abort: number;
        http_error: number;
      };
    };
    ocr_bridge?: {
      status: "up" | "degraded";
      total_requests: number;
      http_success_count: number;
      cli_fallback_count: number;
      cli_success_count: number;
      cli_failure_count: number;
      average_execution_ms: number;
      fallback_rate_pct: number;
    };
  } = {
    database: { status: "down" },
    redis: { status: "down" },
    bullmq: { status: "down" },
    python_ocr: { status: "down" },
    storage: { status: "down", writable: false, upload_dir: BASE_UPLOAD_DIR },
  };

  // 1. Check Database (PostgreSQL)
  try {
    const dbStart = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1");
    services.database = {
      status: "up",
      latency_ms: Date.now() - dbStart,
    };
  } catch (err: any) {
    services.database = {
      status: "down",
      error: err.message || "Database connection error",
    };
  }

  // 2. Check Redis
  try {
    const redisStart = Date.now();
    const pingRes = await redis.ping();
    if (pingRes === "PONG") {
      services.redis = {
        status: "up",
        latency_ms: Date.now() - redisStart,
      };
    }
  } catch (err: any) {
    services.redis = {
      status: "down",
      error: err.message || "Redis ping failed",
    };
  }

  // 3. Check BullMQ Job Queues
  try {
    const [ocrCounts, importCounts] = await Promise.all([
      ocrQueue.getJobCounts("waiting", "active", "completed", "failed"),
      importQueue.getJobCounts("waiting", "active"),
    ]);

    services.bullmq = {
      status: "up",
      ocr_waiting: ocrCounts.waiting || 0,
      ocr_active: ocrCounts.active || 0,
      import_waiting: importCounts.waiting || 0,
      import_active: importCounts.active || 0,
    };
  } catch (err: any) {
    services.bullmq = {
      status: "down",
      error: err.message || "Queue connection failed",
    };
  }

  // 4. Check OCR Engine (Rust Native Engine / Microservice on Port 8001, with Python fallback)
  try {
    const ocrStart = Date.now();
    const ocrUrl = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001";
    let isUp = false;

    // Check HTTP endpoint first (covers active Rust or Python microservice)
    const ocrController = new AbortController();
    const ocrTimeout = setTimeout(() => {
      ocrController.abort(new DOMException("OCR health check timed out", "TimeoutError"));
    }, OCR_HEALTH_TIMEOUT_MS);
    try {
      const res = await fetch(`${ocrUrl}/health`, { signal: ocrController.signal });
      if (res.ok) {
        isUp = true;
      }
    } catch {
      // HTTP not reachable, proceed to check binary directly
    } finally {
      clearTimeout(ocrTimeout);
    }

    if (!isUp) {
      // Check Rust Native binary directly
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
        await execAsync(`"${rustBin}" --version`, { timeout: 2000 });
        isUp = true;
      }
    }

    if (!isUp) {
      // Fallback check to Python environment if available
      const venvPaths = [
        path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3"),
        path.resolve(process.cwd(), "python-services/ocr/venv/bin/python"),
        path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python.exe"),
        path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python"),
      ];
      const foundVenv = venvPaths.find((p) => fs.existsSync(p));
      if (foundVenv) {
        await execAsync(`"${foundVenv}" -c "import rapidfuzz, PIL; print('OK')"`, {
          timeout: 3000,
        });
        isUp = true;
      }
    }

    if (isUp) {
      services.python_ocr = {
        status: "up",
        latency_ms: Date.now() - ocrStart,
      };
    } else {
      services.python_ocr = {
        status: "down",
        error: "OCR engine is offline and no executable binary found",
      };
    }
  } catch (err: any) {
    services.python_ocr = {
      status: "down",
      error: err.message || "OCR engine unresponsive",
    };
  }

  // 5. Check Physical Evidence Storage
  try {
    if (!fs.existsSync(BASE_UPLOAD_DIR)) {
      fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });
    }
    fs.accessSync(BASE_UPLOAD_DIR, fs.constants.W_OK);
    services.storage = {
      status: "up",
      writable: true,
      upload_dir: BASE_UPLOAD_DIR,
    };
  } catch (err: any) {
    services.storage = {
      status: "down",
      writable: false,
      upload_dir: BASE_UPLOAD_DIR,
      error: err.message || "Storage directory not writable",
    };
  }

  // 6. Network Downloader Telemetry
  const dlMetrics = getDownloaderNetworkMetrics();
  const cacheTotal = dlMetrics.cacheStats.hits + dlMetrics.cacheStats.misses;
  const cacheHitRate = cacheTotal > 0 ? (dlMetrics.cacheStats.hits / cacheTotal) * 100 : 0;
  const dlFailureRate = dlMetrics.totalRequests > 0 ? (dlMetrics.failedStreams / dlMetrics.totalRequests) * 100 : 0;

  services.network_downloader = {
    status: dlFailureRate > 50 && dlMetrics.totalRequests >= 5 ? "degraded" : "up",
    total_requests: dlMetrics.totalRequests,
    successful_streams: dlMetrics.successfulStreams,
    failed_streams: dlMetrics.failedStreams,
    average_latency_ms: dlMetrics.averageLatencyMs,
    bytes_streamed_mb: Number((dlMetrics.totalBytesStreamed / (1024 * 1024)).toFixed(2)),
    cache_hit_rate_pct: Number(cacheHitRate.toFixed(1)),
    candidate_hits: {
      endpoint_uc: dlMetrics.candidateHits.endpointUc,
      endpoint_user_content: dlMetrics.candidateHits.endpointUserContent,
      endpoint_lh3: dlMetrics.candidateHits.endpointLh3,
      direct_url: dlMetrics.candidateHits.directUrl,
    },
    rejection_reasons: {
      html_response: dlMetrics.rejectionReasons.htmlResponse,
      invalid_magic_bytes: dlMetrics.rejectionReasons.invalidMagicBytes,
      timeout_abort: dlMetrics.rejectionReasons.timeoutAbort,
      http_error: dlMetrics.rejectionReasons.httpError,
    },
  };

  // 7. OCR Bridge Loopback Telemetry
  const bridgeMetrics = getOcrBridgeMetrics();
  const bridgeTotal = bridgeMetrics.totalRequests;
  const fallbackRate = bridgeTotal > 0 ? (bridgeMetrics.cliFallbackCount / bridgeTotal) * 100 : 0;

  services.ocr_bridge = {
    status: fallbackRate > 50 && bridgeTotal >= 5 ? "degraded" : "up",
    total_requests: bridgeMetrics.totalRequests,
    http_success_count: bridgeMetrics.httpSuccessCount,
    cli_fallback_count: bridgeMetrics.cliFallbackCount,
    cli_success_count: bridgeMetrics.cliSuccessCount,
    cli_failure_count: bridgeMetrics.cliFailureCount,
    average_execution_ms: bridgeMetrics.averageExecutionMs,
    fallback_rate_pct: Number(fallbackRate.toFixed(1)),
  };

  const isCriticalUp =
    services.database.status === "up" &&
    services.redis.status === "up" &&
    services.storage.status === "up";

  const isDegraded =
    !isCriticalUp ||
    services.bullmq.status !== "up" ||
    services.python_ocr.status !== "up";

  const overallStatus = isCriticalUp && !isDegraded ? "healthy" : "degraded";
  const statusCode = isCriticalUp ? 200 : 503;
  const durationMs = Date.now() - startTime;
  const healthLogPayload = {
    module: "HEALTH",
    durationMs,
    metadata: { overallStatus, services },
  };

  if (!isCriticalUp) {
    logger.error("Health check unhealthy", healthLogPayload);
  } else if (overallStatus !== "healthy") {
    logger.warn("Health check degraded", healthLogPayload);
  } else if (process.env.LOG_HEALTH_CHECKS === "true") {
    // Healthy 15s container polls are suppressed by default to prevent daily log bloat.
    logger.info("Health check executed", healthLogPayload);
  }

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      execution_ms: durationMs,
      services,
    },
    { status: statusCode }
  );
}
