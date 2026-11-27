import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Redis from "ioredis";
import redis from "@/lib/redis";
import { createRateLimits } from "@/server/rateLimits";

describe("Penguncian Login over Redis", () => {
  const attempt = { username: `redis_lockout_${Date.now()}`, ip: "192.168.100.42" };

  beforeEach(async () => {
    const keys = await redis.keys(`lockout:*${attempt.ip}*`);
    if (keys.length > 0) await redis.del(...keys);
  });

  it("shares the lockout across limiter instances, as separate app processes do", async () => {
    const processA = createRateLimits({ redis });
    const processB = createRateLimits({ redis });

    for (let i = 0; i < 5; i++) {
      await processA.loginLockout.recordFailure(attempt);
    }

    const seenByB = await processB.loginLockout.check(attempt);
    expect(seenByB.locked).toBe(true);
    expect(seenByB.retryAfterSeconds).toBeGreaterThan(14 * 60);
  });

  it("keeps enforcing the lockout in memory when Redis is unreachable", async () => {
    const deadRedis = new Redis({
      port: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    const limits = createRateLimits({ redis: deadRedis });

    for (let i = 0; i < 5; i++) {
      await limits.loginLockout.recordFailure(attempt);
    }
    expect((await limits.loginLockout.check(attempt)).locked).toBe(true);

    deadRedis.disconnect();
  });

  afterAll(() => {
    redis.disconnect();
  });
});
