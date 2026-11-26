import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { systemTelemetry, type CoreHealthProbe } from "@/server/services/systemTelemetry";

function formatCoreDep(dep: { status: "up" | "down"; latencyMs?: number; error?: string }) {
  return {
    status: dep.status,
    ...(dep.latencyMs !== undefined ? { latency_ms: dep.latencyMs } : {}),
    ...(dep.error ? { error: dep.error } : {}),
  };
}

function logHealthOutcome(probe: CoreHealthProbe, services: Record<string, unknown>) {
  const healthLogPayload = {
    module: "HEALTH",
    durationMs: probe.executionMs,
    metadata: { overallStatus: probe.status, services },
  };

  if (!probe.isCriticalUp) {
    logger.error("Health check unhealthy", healthLogPayload);
  } else if (probe.status !== "healthy") {
    logger.warn("Health check degraded", healthLogPayload);
  } else if (process.env.LOG_HEALTH_CHECKS === "true") {
    // Healthy 15s container polls are suppressed by default to prevent daily log bloat.
    logger.info("Health check executed", healthLogPayload);
  }
}

export async function GET(): Promise<NextResponse>;
export async function GET(request: Request): Promise<NextResponse>;
export async function GET(request?: Request): Promise<NextResponse> {
  const scope = request
    ? new URL(request.url, "http://localhost").searchParams.get("scope")
    : null;

  if (scope === "ping") {
    const probe = await systemTelemetry.getHealth("ping");
    const services = {
      database: formatCoreDep(probe.database),
      redis: formatCoreDep(probe.redis),
    };
    logHealthOutcome(probe, services);

    return NextResponse.json(
      {
        status: probe.status,
        timestamp: probe.timestamp,
        execution_ms: probe.executionMs,
        services,
      },
      { status: probe.isCriticalUp ? 200 : 503 }
    );
  }

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
    database: formatCoreDep(probe.database),
    redis: formatCoreDep(probe.redis),
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
      ? formatCoreDep(probe.visionEngine)
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

  logHealthOutcome(probe, services);

  return NextResponse.json(
    {
      status: probe.status,
      timestamp: probe.timestamp,
      execution_ms: probe.executionMs,
      services,
    },
    { status: probe.isCriticalUp ? 200 : 503 }
  );
}
