import crypto from "crypto";
import {
  NetworkTrafficPoint,
  QueueKey,
  QueueWindowSummary,
  TelemetryNamespace,
  TelemetryStorePort,
} from "./types";

const WINDOW_TTL_SECONDS = 120;

const HASH_KEYS: Record<TelemetryNamespace, string> = {
  downloader: "telemetry:downloader:counters",
  ocr_bridge: "telemetry:ocr_bridge:counters",
};

const SERIES_KEY = "telemetry:downloader:series";

function queueZsetKey(queue: QueueKey, outcome: "completed" | "failed"): string {
  return `telemetry:queue:${queue}:${outcome}`;
}

function queueMetaKey(queue: QueueKey): string {
  return `telemetry:queue:${queue}:meta`;
}

/**
 * In-memory implementation mirroring Redis atomic hashes, 60s sorted-set windows, and capped time-series.
 */
export function createInMemoryTelemetryStore(): TelemetryStorePort {
  const namespaces: Record<TelemetryNamespace, Record<string, string>> = {
    downloader: {},
    ocr_bridge: {},
  };

  const queueWindows: Record<
    QueueKey,
    {
      completed: Array<{ timestamp: number; durationMs: number }>;
      failed: Array<{ timestamp: number; durationMs: number }>;
      lastCompletedAt?: string;
      lastFailedAt?: string;
    }
  > = {
    import: { completed: [], failed: [] },
    ocr: { completed: [], failed: [] },
  };

  let series: NetworkTrafficPoint[] = [];

  return {
    async incrementCounters(namespace, increments) {
      const target = namespaces[namespace];
      for (const [field, delta] of Object.entries(increments)) {
        const current = Number(target[field] || "0");
        target[field] = String(current + delta);
      }
    },

    async setFields(namespace, fields) {
      Object.assign(namespaces[namespace], fields);
    },

    async readNamespace(namespace) {
      return { ...namespaces[namespace] };
    },

    async recordQueueWindowEvent(queue, outcome, timestamp, durationMs) {
      const bucket = queueWindows[queue];
      const safeDuration = Math.max(0, durationMs);
      bucket[outcome].push({ timestamp, durationMs: safeDuration });
      const iso = new Date(timestamp).toISOString();
      if (outcome === "completed") {
        bucket.lastCompletedAt = iso;
      } else {
        bucket.lastFailedAt = iso;
      }
    },

    async readQueueWindow(queue, now, windowMs) {
      const bucket = queueWindows[queue];
      const cutoff = now - windowMs;
      bucket.completed = bucket.completed.filter((item) => item.timestamp >= cutoff);
      bucket.failed = bucket.failed.filter((item) => item.timestamp >= cutoff);

      const completedCount = bucket.completed.length;
      const failedCount = bucket.failed.length;
      const avgDurationMs =
        completedCount > 0
          ? Math.round(
              bucket.completed.reduce((sum, item) => sum + item.durationMs, 0) / completedCount
            )
          : 0;

      return {
        completedCount,
        failedCount,
        avgDurationMs,
        lastCompletedAt: bucket.lastCompletedAt,
        lastFailedAt: bucket.lastFailedAt,
      };
    },

    async appendDownloaderSeriesPoint(point, maxLength) {
      series.push(point);
      if (series.length > maxLength) {
        series = series.slice(-maxLength);
      }
    },

    async readDownloaderSeries() {
      return [...series];
    },

    async reset(scope = "all") {
      if (scope === "all" || scope === "downloader") {
        namespaces.downloader = {};
        series = [];
      }
      if (scope === "all" || scope === "ocr_bridge") {
        namespaces.ocr_bridge = {};
      }
      if (scope === "all" || scope === "queues") {
        queueWindows.import = { completed: [], failed: [] };
        queueWindows.ocr = { completed: [], failed: [] };
      }
    },
  };
}

function isRedisStoreReady(redis: any): boolean {
  return Boolean(
    redis &&
      (redis.status === "ready" || redis.status === "connect") &&
      typeof redis.hgetall === "function" &&
      typeof redis.pipeline === "function"
  );
}

function parseZsetMembers(members: string[]): Array<{ durationMs: number }> {
  return members.map((member) => {
    const parts = member.split(":");
    const duration = Number(parts[1] || "0");
    return { durationMs: Number.isFinite(duration) ? duration : 0 };
  });
}

/**
 * Redis-backed cross-process TelemetryStorePort using atomic HINCRBY, ZADD/ZREMRANGEBYSCORE, and RPUSH/LTRIM.
 * Falls back cleanly to an in-memory store when Redis is unavailable (e.g., offline unit test environments).
 */
export function createRedisTelemetryStore(
  redisProvider: () => any,
  fallbackStore: TelemetryStorePort = createInMemoryTelemetryStore()
): TelemetryStorePort {
  return {
    async incrementCounters(namespace, increments) {
      const redis = redisProvider();
      if (!isRedisStoreReady(redis)) {
        return fallbackStore.incrementCounters(namespace, increments);
      }

      const key = HASH_KEYS[namespace];
      const pipeline = redis.pipeline();
      let hasOps = false;
      for (const [field, delta] of Object.entries(increments)) {
        if (delta !== 0) {
          pipeline.hincrby(key, field, Math.trunc(delta));
          hasOps = true;
        }
      }
      if (!hasOps) return;

      try {
        await pipeline.exec();
      } catch {
        await fallbackStore.incrementCounters(namespace, increments);
      }
    },

    async setFields(namespace, fields) {
      const redis = redisProvider();
      if (!isRedisStoreReady(redis)) {
        return fallbackStore.setFields(namespace, fields);
      }
      if (Object.keys(fields).length === 0) return;

      try {
        await redis.hset(HASH_KEYS[namespace], fields);
      } catch {
        await fallbackStore.setFields(namespace, fields);
      }
    },

    async readNamespace(namespace) {
      const redis = redisProvider();
      if (!isRedisStoreReady(redis)) {
        return fallbackStore.readNamespace(namespace);
      }

      try {
        const data = await redis.hgetall(HASH_KEYS[namespace]);
        return data || {};
      } catch {
        return fallbackStore.readNamespace(namespace);
      }
    },

    async recordQueueWindowEvent(queue, outcome, timestamp, durationMs) {
      const redis = redisProvider();
      if (!isRedisStoreReady(redis)) {
        return fallbackStore.recordQueueWindowEvent(queue, outcome, timestamp, durationMs);
      }

      const key = queueZsetKey(queue, outcome);
      const metaKey = queueMetaKey(queue);
      const safeDuration = Math.max(0, Math.round(durationMs));
      const member = `${timestamp}:${safeDuration}:${crypto.randomBytes(4).toString("hex")}`;
      const cutoff = timestamp - 60_000;
      const iso = new Date(timestamp).toISOString();
      const metaField = outcome === "completed" ? "lastCompletedAt" : "lastFailedAt";

      try {
        const pipeline = redis.pipeline();
        pipeline.zadd(key, timestamp, member);
        pipeline.zremrangebyscore(key, "-inf", cutoff - 1);
        pipeline.expire(key, WINDOW_TTL_SECONDS);
        pipeline.hset(metaKey, metaField, iso);
        await pipeline.exec();
      } catch {
        await fallbackStore.recordQueueWindowEvent(queue, outcome, timestamp, durationMs);
      }
    },

    async readQueueWindow(queue, now, windowMs): Promise<QueueWindowSummary> {
      const redis = redisProvider();
      if (!isRedisStoreReady(redis)) {
        return fallbackStore.readQueueWindow(queue, now, windowMs);
      }

      const completedKey = queueZsetKey(queue, "completed");
      const failedKey = queueZsetKey(queue, "failed");
      const metaKey = queueMetaKey(queue);
      const cutoff = now - windowMs;

      try {
        const pipeline = redis.pipeline();
        pipeline.zremrangebyscore(completedKey, "-inf", cutoff - 1);
        pipeline.zremrangebyscore(failedKey, "-inf", cutoff - 1);
        pipeline.zrangebyscore(completedKey, cutoff, "+inf");
        pipeline.zrangebyscore(failedKey, cutoff, "+inf");
        pipeline.hgetall(metaKey);

        const results = await pipeline.exec();
        const completedMembers = (results?.[2]?.[1] as string[]) || [];
        const failedMembers = (results?.[3]?.[1] as string[]) || [];
        const meta = (results?.[4]?.[1] as Record<string, string>) || {};

        const parsedCompleted = parseZsetMembers(completedMembers);
        const completedCount = parsedCompleted.length;
        const failedCount = failedMembers.length;
        const avgDurationMs =
          completedCount > 0
            ? Math.round(
                parsedCompleted.reduce((sum, item) => sum + item.durationMs, 0) / completedCount
              )
            : 0;

        return {
          completedCount,
          failedCount,
          avgDurationMs,
          lastCompletedAt: meta.lastCompletedAt || undefined,
          lastFailedAt: meta.lastFailedAt || undefined,
        };
      } catch {
        return fallbackStore.readQueueWindow(queue, now, windowMs);
      }
    },

    async appendDownloaderSeriesPoint(point, maxLength) {
      const redis = redisProvider();
      if (!isRedisStoreReady(redis)) {
        return fallbackStore.appendDownloaderSeriesPoint(point, maxLength);
      }

      try {
        const pipeline = redis.pipeline();
        pipeline.rpush(SERIES_KEY, JSON.stringify(point));
        pipeline.ltrim(SERIES_KEY, -maxLength, -1);
        await pipeline.exec();
      } catch {
        await fallbackStore.appendDownloaderSeriesPoint(point, maxLength);
      }
    },

    async readDownloaderSeries() {
      const redis = redisProvider();
      if (!isRedisStoreReady(redis)) {
        return fallbackStore.readDownloaderSeries();
      }

      try {
        const raw = await redis.lrange(SERIES_KEY, 0, -1);
        if (!Array.isArray(raw) || raw.length === 0) return [];
        return raw
          .map((item) => {
            try {
              return JSON.parse(item) as NetworkTrafficPoint;
            } catch {
              return null;
            }
          })
          .filter((pt): pt is NetworkTrafficPoint => pt !== null);
      } catch {
        return fallbackStore.readDownloaderSeries();
      }
    },

    async reset(scope = "all") {
      await fallbackStore.reset(scope);
      const redis = redisProvider();
      if (!isRedisStoreReady(redis)) return;

      const keysToDelete: string[] = [];
      if (scope === "all" || scope === "downloader") {
        keysToDelete.push(HASH_KEYS.downloader, SERIES_KEY);
      }
      if (scope === "all" || scope === "ocr_bridge") {
        keysToDelete.push(HASH_KEYS.ocr_bridge);
      }
      if (scope === "all" || scope === "queues") {
        keysToDelete.push(
          queueZsetKey("import", "completed"),
          queueZsetKey("import", "failed"),
          queueMetaKey("import"),
          queueZsetKey("ocr", "completed"),
          queueZsetKey("ocr", "failed"),
          queueMetaKey("ocr")
        );
      }
      if (keysToDelete.length > 0) {
        try {
          await redis.del(...keysToDelete);
        } catch {
          // Best-effort reset
        }
      }
    },
  };
}
