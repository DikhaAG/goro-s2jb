import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { systemTelemetry } from "@/server/services/systemTelemetry";

export async function GET() {
  const probe = await systemTelemetry.getHealth("full");

  const dlMetrics = probe.downloader!;
  const cacheTotal = dlMetrics.cacheStats.hits + dlMetrics.cacheStats.misses;
  const cacheHitRate = cacheTotal > 0 ? (dlMetrics.cacheStats.hits / cacheTotal) * 100 : 0;
  const dlFailureRate =
    dlMetrics.totalRequests > 0 ? (dlMetrics.failedStreams / dlMetrics.totalRequests) * 100 : 0;

  const bridgeMetrics = probe.ocrBridge!;
  const bridgeTotal = bridgeMetrics.totalRequests;
  const fallbackRate =
    bridgeTotal > 0 ? (bridgeMetrics.cliFallbackCount / bridgeTotal) * 100 : 0;

  const services = {
    database: {
      status: probe.database.status,
      ...(probe.database.latencyMs !== undefined ? { latency_ms: probe.database.latencyMs } : {}),
      ...(probe.database.error ? { error: probe.database.error } : {}),
    },
    redis: {
      status: probe.redis.status,
      ...(probe.redis.latencyMs !== undefined ? { latency_ms: probe.redis.latencyMs } : {}),
      ...(probe.redis.error ? { error: probe.redis.error } : {}),
    },
    bullmq: probe.bullmq
      ? {
          status: probe.bullmq.status,
          ...(probe.bullmq.status === "up"
            ? {
                ocr_waiting: probe.bullmq.ocrWaiting,
                ocr_active: probe.bullmq.ocrActive,
                import_waiting: probe.bullmq.importWaiting,
                import_active: probe.bullmq.importActive,
              }
            : { error: probe.bullmq.error }),
        }
      : { status: "down" as const },
    python_ocr: probe.visionEngine
      ? {
          status: probe.visionEngine.status,
          ...(probe.visionEngine.latencyMs !== undefined
            ? { latency_ms: probe.visionEngine.latencyMs }
            : {}),
          ...(probe.visionEngine.error ? { error: probe.visionEngine.error } : {}),
        }
      : { status: "down" as const },
    storage: probe.storage
      ? {
          status: probe.storage.status,
          writable: probe.storage.writable,
          upload_dir: probe.storage.uploadDir,
          ...(probe.storage.error ? { error: probe.storage.error } : {}),
        }
      : { status: "down" as const, writable: false, upload_dir: "" },
    network_downloader: {
      status: (dlFailureRate > 50 && dlMetrics.totalRequests >= 5 ? "degraded" : "up") as
        | "up"
        | "degraded",
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
    },
    ocr_bridge: {
      status: (fallbackRate > 50 && bridgeTotal >= 5 ? "degraded" : "up") as "up" | "degraded",
      total_requests: bridgeMetrics.totalRequests,
      http_success_count: bridgeMetrics.httpSuccessCount,
      cli_fallback_count: bridgeMetrics.cliFallbackCount,
      cli_success_count: bridgeMetrics.cliSuccessCount,
      cli_failure_count: bridgeMetrics.cliFailureCount,
      average_execution_ms: bridgeMetrics.averageExecutionMs,
      fallback_rate_pct: Number(fallbackRate.toFixed(1)),
    },
  };

  const overallStatus = probe.status;
  const statusCode = probe.isCriticalUp ? 200 : 503;
  const healthLogPayload = {
    module: "HEALTH",
    durationMs: probe.executionMs,
    metadata: { overallStatus, services },
  };

  if (!probe.isCriticalUp) {
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
      timestamp: probe.timestamp,
      execution_ms: probe.executionMs,
      services,
    },
    { status: statusCode }
  );
}
