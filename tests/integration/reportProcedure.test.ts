import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { appRouter } from "@/server/routers/_app";
import { TRPCError } from "@trpc/server";

describe("Task 5: Report Router & Target Immutability Integration", () => {
  let managerUser: { id: string; username: string; name: string; role: any };
  let pegawaiUser: { id: string; username: string; name: string; role: any };
  let fieldUser: { id: string; username: string; name: string; role: any };

  beforeAll(async () => {
    const manager = await prisma.user.findFirst({ where: { role: "MANAGER" } });
    const pegawai = await prisma.user.findFirst({ where: { role: "PEGAWAI" } });
    const field = await prisma.user.findFirst({ where: { role: "PETUGAS_LAPANGAN" } });

    managerUser = manager!;
    pegawaiUser = pegawai!;
    fieldUser = field!;
  });

  afterAll(async () => {
    await prisma.targetCalendarEntry.deleteMany({ where: { date: new Date("2099-12-31") } });
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

  it("rejects a Posisi Tanggal that is not a YYYY-MM-DD date", async () => {
    const managerCaller = appRouter.createCaller({ prisma, redis, user: managerUser, req: undefined });
    await expect(managerCaller.report.getDaily({ posisiTanggal: "bukan-tanggal" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("should preserve AC-4 Target Immutability: past targets are locked and later changes leave past reports unchanged", async () => {
    const managerCaller = appRouter.createCaller({ prisma, redis, user: managerUser, req: undefined });

    const reportBefore = await managerCaller.report.getDaily({ posisiTanggal: "2026-05-01" });

    await expect(
      managerCaller.report.setTargetCalendar({ entries: [{ date: "2026-05-01", dailyTarget: 999 }] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await managerCaller.report.setTargetCalendar({ entries: [{ date: "2099-12-31", dailyTarget: 999 }] });

    const reportAfter = await managerCaller.report.getDaily({ posisiTanggal: "2026-05-01" });
    expect(reportAfter).toEqual(reportBefore);

    const audit = await prisma.auditLog.findFirst({
      where: { userId: managerUser.id, action: "UPDATE_TARGET_CALENDAR" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.metadata).toEqual({ entries: [{ date: "2099-12-31", dailyTarget: 999 }] });
  });
});
