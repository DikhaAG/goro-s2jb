import { describe, it, expect, beforeEach } from "vitest";
import redis from "@/lib/redis";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  checkUploadRateLimit,
  rateLimit,
} from "@/lib/rateLimit";

describe("Infrastructure Security: Rate Limiting & Anti Brute-Force (AC-6)", () => {
  const testIp = "192.168.100.42";
  const testUserId = "usr_petugas_test_limit";

  beforeEach(async () => {
    await resetLoginRateLimit(testIp);
    const keys = await redis.keys(`ratelimit:*:${testUserId}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it("should allow initial login attempt and track failures up to 5 times", async () => {
    // Check initial status
    const initialCheck = await checkLoginRateLimit(testIp);
    expect(initialCheck.success).toBe(true);
    expect(initialCheck.remaining).toBe(5);

    // Record 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const res = await recordLoginFailure(testIp);
      expect(res.locked).toBe(false);
      expect(res.remaining).toBe(5 - i);
    }

    // 5th failure triggers lockout
    const fifthFailure = await recordLoginFailure(testIp);
    expect(fifthFailure.locked).toBe(true);
    expect(fifthFailure.remaining).toBe(0);
    expect(fifthFailure.retryAfterSeconds).toBeGreaterThan(0);

    // Subsequent check should fail with locked status
    const lockedCheck = await checkLoginRateLimit(testIp);
    expect(lockedCheck.success).toBe(false);
    expect(lockedCheck.remaining).toBe(0);
    expect(lockedCheck.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("should reset login rate limit upon successful login", async () => {
    // Fail 3 times
    await recordLoginFailure(testIp);
    await recordLoginFailure(testIp);
    await recordLoginFailure(testIp);

    const midCheck = await checkLoginRateLimit(testIp);
    expect(midCheck.remaining).toBe(2);

    // Successful login triggers reset
    await resetLoginRateLimit(testIp);

    const resetCheck = await checkLoginRateLimit(testIp);
    expect(resetCheck.success).toBe(true);
    expect(resetCheck.remaining).toBe(5);
  });

  it("should enforce upload rate limit of max 60 requests per minute", async () => {
    // Perform rapid checks
    for (let i = 1; i <= 60; i++) {
      const res = await checkUploadRateLimit(testUserId);
      expect(res.success).toBe(true);
    }

    // 61st check should be blocked
    const blockedRes = await checkUploadRateLimit(testUserId);
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("should support generic token bucket / sliding window rate limiting", async () => {
    const key = "test_custom_action";
    const res1 = await rateLimit({ key, limit: 3, windowSeconds: 60 });
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await rateLimit({ key, limit: 3, windowSeconds: 60 });
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await rateLimit({ key, limit: 3, windowSeconds: 60 });
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);

    const res4 = await rateLimit({ key, limit: 3, windowSeconds: 60 });
    expect(res4.success).toBe(false);
    expect(res4.remaining).toBe(0);

    await redis.del(`ratelimit:${key}`);
  });
});
