import { router, publicProcedure } from "../trpc";
import { z } from "zod";

export const healthRouter = router({
  ping: publicProcedure.query(async ({ ctx }) => {
    const dbStartTime = Date.now();
    let dbStatus = "DOWN";
    let dbLatencyMs = -1;

    try {
      await ctx.prisma.$queryRaw`SELECT 1`;
      dbStatus = "UP";
      dbLatencyMs = Date.now() - dbStartTime;
    } catch (err) {
      console.error("Health check DB error:", err);
    }

    const redisStartTime = Date.now();
    let redisStatus = "DOWN";
    let redisLatencyMs = -1;

    try {
      const pingRes = await ctx.redis.ping();
      if (pingRes === "PONG") {
        redisStatus = "UP";
        redisLatencyMs = Date.now() - redisStartTime;
      }
    } catch (err) {
      console.error("Health check Redis error:", err);
    }

    return {
      status: dbStatus === "UP" && redisStatus === "UP" ? "HEALTHY" : "DEGRADED",
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        redis: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
        },
      },
    };
  }),
});
