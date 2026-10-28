import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { appRouter } from "@/server/routers/_app";
import { TRPCError } from "@trpc/server";

describe("Task 5: Report Router & Target Immutability Integration", () => {
  let managerUser: { id: string; username: string; name: string; role: any };
  let pegawaiUser: { id: string; username: string; name: string; role: any };
  let fieldUser: { id: string; username: string; name: string; role: any };
  let testUlpId: string;
  let futureTargetId: string | null = null;

  beforeAll(async () => {
    const manager = await prisma.user.findFirst({ where: { role: "MANAGER" } });
    const pegawai = await prisma.user.findFirst({ where: { role: "PEGAWAI" } });
    const field = await prisma.user.findFirst({ where: { role: "PETUGAS_LAPANGAN" } });
    const ulp = await prisma.uLP.findFirst({ where: { code: "ULP_RIV" } });

    managerUser = manager!;
    pegawaiUser = pegawai!;
    fieldUser = field!;
    testUlpId = ulp!.id;
  });

  afterAll(async () => {
    if (futureTargetId) {
      await prisma.targetMaster.delete({ where: { id: futureTargetId } }).catch(() => {});
    }
    await prisma.$disconnect();
    redis.disconnect();
  });

  it("should enforce AC-1 RBAC guard: reject PEGAWAI and PETUGAS_LAPANGAN with FORBIDDEN", async () => {
    const fieldCaller = appRouter.createCaller({
      prisma,
      redis,
      user: fieldUser,
      req: undefined,
    });

    await expect(fieldCaller.report.getKpis({})).rejects.toThrowError(TRPCError);

    const pegawaiCaller = appRouter.createCaller({
      prisma,
      redis,
      user: pegawaiUser,
      req: undefined,
    });

    await expect(pegawaiCaller.report.getDaily({})).rejects.toThrowError(TRPCError);
  });

  it("should allow MANAGER to query Executive KPIs, Daily, and Monthly Reports", async () => {
    const managerCaller = appRouter.createCaller({
      prisma,
      redis,
      user: managerUser,
      req: undefined,
    });

    const kpis = await managerCaller.report.getKpis({});
    expect(kpis).toBeDefined();
    expect(typeof kpis.totalCumulativeRealization).toBe("number");
    expect(typeof kpis.cumulativeAchievementRate).toBe("number");
    expect(Array.isArray(kpis.top3Ulps)).toBe(true);

    const daily = await managerCaller.report.getDaily({});
    expect(daily.groups).toBeDefined();
    expect(daily.grandTotal).toBeDefined();
    expect(typeof daily.grandTotal.dailyTarget).toBe("number");

    const monthly = await managerCaller.report.getMonthly({});
    expect(monthly.groups).toBeDefined();
    expect(monthly.grandTotal).toBeDefined();
    expect(typeof monthly.grandTotal.cumulativeTarget).toBe("number");
  });

  it("should preserve AC-4 Target Immutability: future target adjustments do not alter historical reports", async () => {
    const managerCaller = appRouter.createCaller({
      prisma,
      redis,
      user: managerUser,
      req: undefined,
    });

    const historicalDate = new Date("2026-05-01");

    // 1. Fetch report for historical date
    const reportBefore = await managerCaller.report.getDaily({
      date: historicalDate.toISOString(),
    });
    const rivaiBefore = reportBefore.groups
      .flatMap((g) => g.ulps)
      .find((u) => u.ulpId === testUlpId);

    const targetBefore = rivaiBefore?.dailyTarget;

    // 2. Insert a drastic target change far in the future
    const futureDate = new Date("2026-12-31");
    const newTarget = await prisma.targetMaster.create({
      data: {
        ulpId: testUlpId,
        targetDate: futureDate,
        dailyTarget: 999.0, // Drastically higher
        cumulativeTarget: 25000.0,
      },
    });
    futureTargetId = newTarget.id;

    // 3. Re-query the historical report for 2026-05-01
    const reportAfter = await managerCaller.report.getDaily({
      date: historicalDate.toISOString(),
    });
    const rivaiAfter = reportAfter.groups
      .flatMap((g) => g.ulps)
      .find((u) => u.ulpId === testUlpId);

    // Historical target must be completely unchanged
    expect(rivaiAfter?.dailyTarget).toBe(targetBefore);
    expect(rivaiAfter?.dailyTarget).not.toBe(999.0);
  });
});
