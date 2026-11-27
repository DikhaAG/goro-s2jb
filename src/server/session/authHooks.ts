import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import type { LoginLockout, LockoutStatus } from "@/server/rateLimits";
import { trustedClientIp } from "./clientIp";

const SIGN_IN_PATH = "/sign-in/username";
const SIGN_OUT_PATH = "/sign-out";

type AuditEvent = {
  userId?: string;
  action: "AUTH_LOGIN_SUCCESS" | "AUTH_LOGIN_FAILED" | "AUTH_LOGOUT";
  entityType: "User";
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: { username: string; reason: string; remaining: number };
};

export interface AuthHooksDeps {
  loginLockout: LoginLockout;
  audit: (event: AuditEvent) => Promise<unknown>;
  findUserByUsername: (username: string) => Promise<{ id: string; isActive: boolean } | null>;
  /** Re-hashes legacy SHA-256 passwords with bcrypt after a successful sign-in. */
  upgradeLegacyHash: (userId: string, password: string) => Promise<void>;
}

function lockedError(status: LockoutStatus): APIError {
  const minutes = Math.max(1, Math.ceil(status.retryAfterSeconds / 60));
  return new APIError("TOO_MANY_REQUESTS", {
    message: `Terlalu banyak percobaan gagal. Akses dikunci sementara selama ${minutes} menit.`,
    code: "LOGIN_LOCKED",
    locked: true,
    remaining: 0,
    retryAfterSeconds: status.retryAfterSeconds,
  });
}

function readCredentials(body: unknown): { username: string; password: string } {
  const { username, password } = (body ?? {}) as { username?: unknown; password?: unknown };
  return {
    username: typeof username === "string" ? username.trim() : "",
    password: typeof password === "string" ? password : "",
  };
}

/**
 * Penguncian Login and the sign-in/sign-out audit trail, enforced inside
 * better-auth so no route can sign a user in or out without them.
 */
export function createAuthHooks(deps: AuthHooksDeps) {
  const before = createAuthMiddleware(async (ctx) => {
    if (ctx.path === SIGN_OUT_PATH) {
      const current = await getSessionFromCtx(ctx);
      if (current) {
        await deps.audit({
          userId: current.user.id,
          action: "AUTH_LOGOUT",
          entityType: "User",
          entityId: current.user.id,
          ipAddress: trustedClientIp(ctx.headers) ?? undefined,
          userAgent: ctx.headers?.get("user-agent") ?? undefined,
        });
      }
      return;
    }
    if (ctx.path !== SIGN_IN_PATH) return;
    const { username } = readCredentials(ctx.body);
    const status = await deps.loginLockout.check({ username, ip: trustedClientIp(ctx.headers) });
    if (status.locked) throw lockedError(status);
  });

  const after = createAuthMiddleware(async (ctx) => {
    if (ctx.path !== SIGN_IN_PATH) return;
    const { username, password } = readCredentials(ctx.body);
    const ip = trustedClientIp(ctx.headers);
    const attempt = { username, ip };
    const userAgent = ctx.headers?.get("user-agent") ?? undefined;
    const ipAddress = ip ?? undefined;

    if (!isAPIError(ctx.context.returned)) {
      const userId = ctx.context.newSession?.user.id;
      await deps.loginLockout.reset(attempt);
      if (userId) {
        await deps.upgradeLegacyHash(userId, password);
        await deps.audit({
          userId,
          action: "AUTH_LOGIN_SUCCESS",
          entityType: "User",
          entityId: userId,
          ipAddress,
          userAgent,
        });
      }
      return;
    }

    const user = await deps.findUserByUsername(username);
    const reason = !user ? "NOT_FOUND" : !user.isActive ? "DEACTIVATED" : "INVALID_PASSWORD";
    const status = await deps.loginLockout.recordFailure(attempt);
    await deps.audit({
      userId: user?.id,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user?.id,
      ipAddress,
      userAgent,
      metadata: { username, reason, remaining: status.remaining },
    });

    if (status.locked) throw lockedError(status);
    throw new APIError("UNAUTHORIZED", {
      message: `Username atau kata sandi salah. Sisa percobaan: ${status.remaining}`,
      code: "INVALID_CREDENTIALS",
      locked: false,
      remaining: status.remaining,
    });
  });

  return { before, after };
}
