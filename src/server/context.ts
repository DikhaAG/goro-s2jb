import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { SessionUser } from "@/types";
import { verifySessionToken, SESSION_COOKIE_NAME, USER_ID_COOKIE_NAME } from "@/lib/auth";

export interface CreateContextOptions {
  user: SessionUser | null;
}

export async function createContext(opts?: FetchCreateContextFnOptions) {
  let user: SessionUser | null = null;
  let ipAddress = "127.0.0.1";
  let userAgent = "";

  if (opts?.req) {
    ipAddress =
      opts.req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      opts.req.headers.get("x-real-ip") ||
      "127.0.0.1";
    userAgent = opts.req.headers.get("user-agent") || "";

    // 1. Check custom test header
    let userId = opts.req.headers.get("x-user-id");

    // 2. Check cookies
    const cookieHeader = opts.req.headers.get("cookie");
    if (!userId && cookieHeader) {
      // First try JWT session token
      const sessionTokenMatch = cookieHeader.match(
        new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
      );
      if (sessionTokenMatch) {
        const token = decodeURIComponent(sessionTokenMatch[1].trim());
        const tokenUser = await verifySessionToken(token);
        if (tokenUser?.id) {
          userId = tokenUser.id;
        }
      }

      // Fallback to legacy user id cookie if no valid token
      if (!userId) {
        const legacyIdMatch = cookieHeader.match(
          new RegExp(`${USER_ID_COOKIE_NAME}=([^;]+)`)
        );
        if (legacyIdMatch) {
          userId = decodeURIComponent(legacyIdMatch[1].trim());
        }
      }
    }

    if (userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          up3Id: true,
          ulpId: true,
        },
      });

      // Only allow active users
      if (dbUser && dbUser.isActive) {
        user = {
          id: dbUser.id,
          username: dbUser.username,
          name: dbUser.name,
          role: dbUser.role,
          up3Id: dbUser.up3Id,
          ulpId: dbUser.ulpId,
        };
      }
    }
  }

  return {
    prisma,
    redis,
    user,
    ipAddress,
    userAgent,
    req: opts?.req,
  };
}

export type Context = {
  prisma: typeof prisma;
  redis: typeof redis;
  user: SessionUser | null;
  ipAddress?: string;
  userAgent?: string;
  req?: any;
};
