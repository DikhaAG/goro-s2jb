import { router, publicProcedure } from "../trpc";
import { systemTelemetry } from "../services/systemTelemetry";

export const healthRouter = router({
  ping: publicProcedure.query(async () => {
    const probe = await systemTelemetry.getHealth("ping");
    return {
      status: probe.status === "healthy" ? "HEALTHY" : "DEGRADED",
      timestamp: probe.timestamp,
      services: {
        database: {
          status: probe.database.status === "up" ? "UP" : "DOWN",
          latencyMs: probe.database.latencyMs ?? -1,
        },
        redis: {
          status: probe.redis.status === "up" ? "UP" : "DOWN",
          latencyMs: probe.redis.latencyMs ?? -1,
        },
      },
    };
  }),
});
