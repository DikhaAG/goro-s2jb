import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Role } from "@prisma/client";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/context";
import { GET as getHealth } from "@/app/api/health/route";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

describe("tRPC v11 API Routers (Health, Master)", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let anonymousCaller: ReturnType<typeof appRouter.createCaller>;
  let callerAs: (role: Role) => Promise<ReturnType<typeof appRouter.createCaller>>;

  beforeAll(async () => {
    callerAs = async (role: Role) => {
      const ctx = await createContext();
      ctx.user = { id: `usr_${role.toLowerCase()}`, username: role.toLowerCase(), name: role, role };
      return appRouter.createCaller(ctx);
    };
    caller = await callerAs(Role.PETUGAS_LAPANGAN);
    anonymousCaller = appRouter.createCaller(await createContext());
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  it("GET /api/health?scope=ping returns healthy status with DB and Redis metrics", async () => {
    const response = await getHealth(
      new Request("http://localhost:3000/api/health?scope=ping")
    );
    const res = await response.json();
    expect(response.status).toBe(200);
    expect(res.status).toBe("healthy");
    expect(res.services.database.status).toBe("up");
    expect(res.services.redis.status).toBe("up");
    expect(res.services.database.latency_ms).toBeGreaterThanOrEqual(0);
    expect(res.services.redis.latency_ms).toBeGreaterThanOrEqual(0);
    expect(res.services.storage).toBeUndefined();
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

  it("rejects every master procedure for a visitor who is not logged in", async () => {
    await expect(anonymousCaller.master.getUnits()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymousCaller.master.getUlps()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymousCaller.master.getVersions()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymousCaller.master.getTargets()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("keeps report targets for Manager and Super Admin only", async () => {
    for (const role of [Role.PETUGAS_LAPANGAN, Role.PEGAWAI]) {
      const roleCaller = await callerAs(role);
      await expect(roleCaller.master.getTargets()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    for (const role of [Role.MANAGER, Role.SUPER_ADMIN]) {
      const roleCaller = await callerAs(role);
      await expect(roleCaller.master.getTargets()).resolves.toBeInstanceOf(Array);
    }
  });
});
