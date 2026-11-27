import type Redis from "ioredis";
import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
  type IRateLimiterOptions,
  type RateLimiterAbstract,
} from "rate-limiter-flexible";

const LOCKOUT_FAILURES = 5;
const IP_FAILURES = 50;
const LOCKOUT_WINDOW_SECONDS = 15 * 60;
const UPLOADS_PER_MINUTE = 60;

export interface LoginAttempt {
  username: string;
  /** null when no trusted client IP is available; the lockout then keys on username alone. */
  ip: string | null;
}

export interface LockoutStatus {
  locked: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface LoginLockout {
  check(attempt: LoginAttempt): Promise<LockoutStatus>;
  recordFailure(attempt: LoginAttempt): Promise<LockoutStatus>;
  reset(attempt: LoginAttempt): Promise<void>;
}

export interface UploadQuota {
  consume(userId: string): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export interface RateLimits {
  loginLockout: LoginLockout;
  uploadQuota: UploadQuota;
}

function createLimiter(options: IRateLimiterOptions, redis?: Redis): RateLimiterAbstract {
  if (!redis) return new RateLimiterMemory(options);
  return new RateLimiterRedis({
    ...options,
    storeClient: redis,
    insuranceLimiter: new RateLimiterMemory(options),
  });
}

function pairKey({ username, ip }: LoginAttempt): string {
  return `${username.trim().toLowerCase()}:${ip ?? "-"}`;
}

function consumeOrRejection(limiter: RateLimiterAbstract, key: string): Promise<RateLimiterRes> {
  return limiter.consume(key).catch((rejected: unknown) => {
    if (rejected instanceof RateLimiterRes) return rejected;
    throw rejected;
  });
}

function toStatus(
  pair: RateLimiterRes | null,
  ip: RateLimiterRes | null
): LockoutStatus {
  const pairConsumed = pair?.consumedPoints ?? 0;
  const ipLocked = (ip?.consumedPoints ?? 0) >= IP_FAILURES;
  const pairLocked = pairConsumed >= LOCKOUT_FAILURES;
  const retryMs = Math.max(
    pairLocked ? pair!.msBeforeNext : 0,
    ipLocked ? ip!.msBeforeNext : 0
  );
  return {
    locked: pairLocked || ipLocked,
    remaining: ipLocked ? 0 : Math.max(0, LOCKOUT_FAILURES - pairConsumed),
    retryAfterSeconds: Math.ceil(retryMs / 1000),
  };
}

/**
 * Builds the Penguncian Login and upload quota limiters. Without a Redis client
 * every limiter is in-memory, which is what unit tests use.
 */
export function createRateLimits({ redis }: { redis?: Redis } = {}): RateLimits {
  const byPair = createLimiter(
    { keyPrefix: "lockout:pair", points: LOCKOUT_FAILURES, duration: LOCKOUT_WINDOW_SECONDS },
    redis
  );

  const byIp = createLimiter(
    { keyPrefix: "lockout:ip", points: IP_FAILURES, duration: LOCKOUT_WINDOW_SECONDS },
    redis
  );

  const loginLockout: LoginLockout = {
    async check(attempt) {
      const [pair, ip] = await Promise.all([
        byPair.get(pairKey(attempt)),
        attempt.ip ? byIp.get(attempt.ip) : null,
      ]);
      return toStatus(pair, ip);
    },
    async recordFailure(attempt) {
      const [pair, ip] = await Promise.all([
        consumeOrRejection(byPair, pairKey(attempt)),
        attempt.ip ? consumeOrRejection(byIp, attempt.ip) : null,
      ]);
      return toStatus(pair, ip);
    },
    async reset(attempt) {
      await byPair.delete(pairKey(attempt));
    },
  };

  const uploads = createLimiter(
    { keyPrefix: "quota:upload", points: UPLOADS_PER_MINUTE, duration: 60 },
    redis
  );

  const uploadQuota: UploadQuota = {
    async consume(userId) {
      const res = await consumeOrRejection(uploads, userId);
      const allowed = res.consumedPoints <= UPLOADS_PER_MINUTE;
      return { allowed, retryAfterSeconds: allowed ? 0 : Math.ceil(res.msBeforeNext / 1000) };
    },
  };

  return { loginLockout, uploadQuota };
}
