import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins/username";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { rateLimits } from "@/server/rateLimits/live";
import { logAuditEvent } from "@/server/services/auditService";
import { createAuthHooks } from "@/server/session/authHooks";
import { logger } from "@/lib/logger";
import { getRoleMaxAgeSeconds, shouldUseSecureCookie } from "./auth-constants";

/**
 * Hashes a plain-text password using bcrypt with 10 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verifies a plain-text password against a stored hash.
 * Supports standard bcrypt hashes ($2a$, $2b$) as well as legacy SHA-256 seeded hashes.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;

  // Check if bcrypt hash
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    return bcrypt.compare(password, storedHash);
  }

  // Fallback check for legacy seed format: sha256(password + '_goro_salt_2026')
  if (storedHash.length === 64) {
    const legacyHash = crypto
      .createHash("sha256")
      .update(password + "_goro_salt_2026")
      .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(legacyHash), Buffer.from(storedHash));
  }

  return false;
}

/**
 * Better Auth Core Server Configuration (Task 11).
 * Features:
 * - Prisma PostgreSQL Adapter with User, Session, Account, Verification
 * - Redis Secondary Storage for ultra-fast session validation (<2ms)
 * - Username Plugin for tactical operational username login
 * - Hybrid Password Hashing supporting bcrypt and legacy SHA-256
 * - StoreSessionInDatabase: true for dual persistence
 */
const BCRYPT_PREFIXES = ["$2a$", "$2b$", "$2y$"];

const authHooks = createAuthHooks({
  loginLockout: rateLimits.loginLockout,
  audit: logAuditEvent,
  findUserByUsername: (name) =>
    prisma.user.findUnique({ where: { username: name }, select: { id: true, isActive: true } }),
  upgradeLegacyHash: async (userId, password) => {
    const account = await prisma.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { id: true, password: true },
    });
    if (!account?.password || BCRYPT_PREFIXES.some((p) => account.password!.startsWith(p))) return;
    await prisma.account.update({
      where: { id: account.id },
      data: { password: await hashPassword(password) },
    });
    const remaining = await prisma.account.count({
      where: {
        providerId: "credential",
        NOT: BCRYPT_PREFIXES.map((prefix) => ({ password: { startsWith: prefix } })),
      },
    });
    logger.info(`Legacy SHA-256 password upgraded to bcrypt; ${remaining} legacy hash(es) remain.`, {
      module: "auth",
    });
  },
});

export const auth = betterAuth({
  appName: "GORO S2JB Command Center",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  // No fallback: better-auth refuses to start without BETTER_AUTH_SECRET outside tests.
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secondaryStorage: {
    get: async (key: string) => {
      try {
        const val = await redis.get(key);
        if (!val) return null;
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      } catch {
        return null;
      }
    },
    getAndDelete: async (key: string) => {
      try {
        const val = await redis.get(key);
        if (val) {
          await redis.del(key);
          try {
            return JSON.parse(val);
          } catch {
            return val;
          }
        }
        return null;
      } catch {
        return null;
      }
    },
    increment: async (key: string, ttl: number) => {
      try {
        const count = await redis.incr(key);
        if (count === 1 && ttl) {
          await redis.expire(key, ttl);
        }
        return count;
      } catch {
        return 1;
      }
    },
    set: async (key: string, value: any, ttl?: number) => {
      try {
        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        if (ttl) {
          await redis.set(key, serialized, "EX", ttl);
        } else {
          await redis.set(key, serialized);
        }
      } catch {
        // Fallback silently if redis is unavailable
      }
    },
    delete: async (key: string) => {
      try {
        await redis.del(key);
      } catch {
        // Ignore redis delete failures
      }
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "PETUGAS_LAPANGAN",
        input: false,
      },
      up3Id: {
        type: "string",
        required: false,
        input: false,
      },
      ulpId: {
        type: "string",
        required: false,
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    password: {
      hash: async (pwd) => hashPassword(pwd),
      verify: async ({ password, hash }) => verifyPassword(password, hash),
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 32,
      // Usernames are stored as typed by Super Admin; keep sign-in an exact match.
      usernameNormalization: false,
    }),
  ],
  session: {
    // Upper bound only; the real lifetime is set per role in databaseHooks.
    expiresIn: 7 * 24 * 60 * 60,
    disableSessionRefresh: true,
    storeSessionInDatabase: true,
    cookieCache: { enabled: false },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { role: true, isActive: true },
          });
          if (!user?.isActive) return false;
          return {
            data: {
              ...session,
              expiresAt: new Date(Date.now() + getRoleMaxAgeSeconds(user.role) * 1000),
            },
          };
        },
      },
    },
  },
  hooks: {
    before: authHooks.before,
    after: authHooks.after,
  },
  advanced: {
    useSecureCookies: shouldUseSecureCookie(),
  },
});

export type Auth = typeof auth;

