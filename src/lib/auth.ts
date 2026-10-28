import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins/username";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { Role } from "@prisma/client";
import { SessionUser } from "@/types";

import {
  SESSION_COOKIE_NAME,
  USER_ID_COOKIE_NAME,
  getRoleMaxAgeSeconds,
  getDefaultRedirectForRole,
} from "./auth-constants";

export {
  SESSION_COOKIE_NAME,
  USER_ID_COOKIE_NAME,
  getRoleMaxAgeSeconds,
  getDefaultRedirectForRole,
};

export const BETTER_AUTH_COOKIE_NAME = "better-auth.session_token";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "goro-s2jb-command-center-secret-key-pln-2026-production-secured"
);

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
 * Issues a signed JWT session token.
 */
export async function signSessionToken(
  user: SessionUser,
  customMaxAgeSeconds?: number
): Promise<string> {
  const maxAge = customMaxAgeSeconds ?? getRoleMaxAgeSeconds(user.role);

  return new SignJWT({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    up3Id: user.up3Id || null,
    ulpId: user.ulpId || null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${Math.floor(Date.now() / 1000) + maxAge}s`)
    .sign(JWT_SECRET);
}

/**
 * Verifies and decodes a JWT session token.
 * Returns decoded SessionUser or null if expired or invalid.
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.id || !payload.role || !payload.username) {
      return null;
    }
    return {
      id: payload.id as string,
      username: payload.username as string,
      name: (payload.name as string) || (payload.username as string),
      role: payload.role as Role,
      up3Id: (payload.up3Id as string | null) || null,
      ulpId: (payload.ulpId as string | null) || null,
    };
  } catch {
    return null;
  }
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
export const auth = betterAuth({
  appName: "GORO S2JB Command Center",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || "goro-s2jb-command-center-secret-key-pln-2026-production-secured-32chars",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secondaryStorage: {
    get: async (key: string) => {
      try {
        const val = await redis.get(key);
        return val ? JSON.parse(val) : null;
      } catch {
        return null;
      }
    },
    set: async (key: string, value: any, ttl?: number) => {
      try {
        if (ttl) {
          await redis.set(key, JSON.stringify(value), "EX", ttl);
        } else {
          await redis.set(key, JSON.stringify(value));
        }
      } catch {
        // Fallback to primary DB silently if redis temporarily unavailable
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
      },
      up3Id: {
        type: "string",
        required: false,
      },
      ulpId: {
        type: "string",
        required: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (pwd) => hashPassword(pwd),
      verify: async ({ password, hash }) => verifyPassword(password, hash),
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 32,
    }),
  ],
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60,
    storeSessionInDatabase: true,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type Auth = typeof auth;

