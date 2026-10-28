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
