import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { SessionUser } from "@/types";

export interface CreateContextOptions {
  user: SessionUser | null;
}

export async function createContext(opts?: FetchCreateContextFnOptions) {
  let user: SessionUser | null = null;

  if (opts?.req) {
    // Basic session extraction from custom header for API/testing, or session cookie
    let userId = opts.req.headers.get("x-user-id");

    if (!userId) {
      const cookieHeader = opts.req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(/goro_user_id=([^;]+)/);
        if (match) {
          userId = decodeURIComponent(match[1].trim());
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
          up3Id: true,
          ulpId: true,
        },
      });

      if (dbUser) {
        user = dbUser;
      }
    }
  }

  return {
    prisma,
    redis,
    user,
    req: opts?.req,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
