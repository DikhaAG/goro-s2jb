import redis from "./redis";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

export interface LoginFailureResult {
  remaining: number;
  locked: boolean;
  retryAfterSeconds?: number;
}

const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_SECONDS = 15 * 60; // 15 minutes
const UPLOAD_MAX_PER_MINUTE = 60;
const UPLOAD_WINDOW_SECONDS = 60;

/**
 * Checks if a specific IP/identifier is currently locked out from login attempts.
 */
export async function checkLoginRateLimit(identifier: string): Promise<RateLimitResult> {
  const key = `ratelimit:login:fail:${identifier}`;
  const countStr = await redis.get(key);
  const count = countStr ? parseInt(countStr, 10) : 0;

  if (count >= LOGIN_MAX_FAILURES) {
    const ttl = await redis.ttl(key);
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: ttl > 0 ? ttl : LOGIN_LOCKOUT_SECONDS,
    };
  }

  return {
    success: true,
    remaining: Math.max(0, LOGIN_MAX_FAILURES - count),
  };
}

/**
 * Records a failed login attempt. If failures reach 5, locks out the identifier for 15 minutes.
 */
export async function recordLoginFailure(identifier: string): Promise<LoginFailureResult> {
  const key = `ratelimit:login:fail:${identifier}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, LOGIN_LOCKOUT_SECONDS);
  }

  const ttl = await redis.ttl(key);

  if (current >= LOGIN_MAX_FAILURES) {
    return {
      remaining: 0,
      locked: true,
      retryAfterSeconds: ttl > 0 ? ttl : LOGIN_LOCKOUT_SECONDS,
    };
  }

  return {
    remaining: Math.max(0, LOGIN_MAX_FAILURES - current),
    locked: false,
    retryAfterSeconds: 0,
  };
}

/**
 * Clears the login failure counter upon successful authentication.
 */
export async function resetLoginRateLimit(identifier: string): Promise<void> {
  const key = `ratelimit:login:fail:${identifier}`;
  await redis.del(key);
}

/**
 * Rate limiter for evidence uploads (max 60 per minute per field officer).
 */
export async function checkUploadRateLimit(userId: string): Promise<RateLimitResult> {
  return rateLimit({
    key: `upload:${userId}`,
    limit: UPLOAD_MAX_PER_MINUTE,
    windowSeconds: UPLOAD_WINDOW_SECONDS,
  });
}

/**
 * Generic Redis-backed fixed window / token bucket rate limiter.
 */
export async function rateLimit({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const current = await redis.incr(redisKey);

  if (current === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  const ttl = await redis.ttl(redisKey);

  if (current > limit) {
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }

  return {
    success: true,
    remaining: Math.max(0, limit - current),
  };
}
