import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { SessionUser } from "@/types";
import { session } from "@/server/session/live";
import { trustedClientIp } from "@/server/session/clientIp";

export interface CreateContextOptions {
  user: SessionUser | null;
}

export async function createContext(opts?: FetchCreateContextFnOptions) {
  const headers = opts?.req?.headers;

  return {
    prisma,
    redis,
    user: headers ? await session.getUser(headers) : null,
    ipAddress: trustedClientIp(headers) ?? undefined,
    userAgent: headers?.get("user-agent") ?? "",
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
