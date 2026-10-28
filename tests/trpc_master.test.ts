import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/context";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

describe("tRPC v11 API Routers (Health, Master, Auth)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const ctx = await createContext();
    caller = appRouter.createCaller(ctx);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  it("health.ping returns HEALTHY status with DB and Redis metrics", async () => {
    const res = await caller.health.ping();
    expect(res.status).toBe("HEALTHY");
    expect(res.services.database.status).toBe("UP");
    expect(res.services.redis.status).toBe("UP");
    expect(res.services.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.services.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("master.getUnits returns all seeded UP3s with their child ULPs", async () => {
    const units = await caller.master.getUnits();
    expect(units.length).toBeGreaterThanOrEqual(4);

    const up3Palembang = units.find((u) => u.code === "UP3_PLG");
    expect(up3Palembang).toBeDefined();
    expect(up3Palembang?.name).toBe("UP3 PALEMBANG");
    expect(up3Palembang?.ulps.length).toBeGreaterThanOrEqual(5);

    const rivai = up3Palembang?.ulps.find((ulp) => ulp.code === "ULP_RIV");
    expect(rivai).toBeDefined();
    expect(rivai?.name).toBe("ULP RIVAI");
  });

  it("master.getVersions returns active PLN Mobile versions", async () => {
    const versions = await caller.master.getVersions();
    expect(versions.length).toBeGreaterThanOrEqual(5);
    const v5279 = versions.find((v) => v.version === "V5.2.79");
    expect(v5279).toBeDefined();
    expect(v5279?.isActive).toBe(true);
  });

  it("auth.login authenticates seeded field officer correctly", async () => {
    const loginRes = await caller.auth.login({
      username: "petugas_rivai",
      password: "password123",
    });

    expect(loginRes.username).toBe("petugas_rivai");
    expect(loginRes.role).toBe("PETUGAS_LAPANGAN");
    expect(loginRes.ulp?.code).toBe("ULP_RIV");
  });

  it("auth.login rejects invalid password", async () => {
    await expect(
      caller.auth.login({
        username: "petugas_rivai",
        password: "wrongpassword",
      })
    ).rejects.toThrow("Kata sandi salah");
  });
});
