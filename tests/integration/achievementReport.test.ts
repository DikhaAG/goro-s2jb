import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import {
  createAchievementReport,
  createReportSyncStamp,
  isExportFormat,
  type ReportSyncStamp,
} from "@/server/services/achievementReport";

// 2099-03-10T18:30Z is 2099-03-11 01:30 WIB: "today" is the 11th, not the 10th.
const NOW = new Date("2099-03-10T18:30:00Z");

function report(now: Date = NOW, syncStamp?: ReportSyncStamp) {
  return createAchievementReport({ db: prisma, now: () => now, syncStamp });
}

function memorySyncStamp(now: Date = NOW) {
  const store = new Map<string, string>();
  return createReportSyncStamp(
    () => ({
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => store.set(key, value),
    }),
    () => now
  );
}

// Every fixture lives in 2099 so it never meets seeded or real data.
async function clearCalendar2099() {
  await prisma.targetCalendarEntry.deleteMany({ where: { date: { gte: new Date("2099-01-01") } } });
}

describe("Laporan Capaian: Kalender Target", () => {
  beforeAll(clearCalendar2099);
  afterAll(clearCalendar2099);

  it("falls back to the fixed default (50 weekday, 20 weekend) on dates nobody has set, and says so", async () => {
    const march = await report().calendar(2099, 3);
    expect(march).toHaveLength(31);
    // 1 March 2099 is a Sunday, 2 March a Monday.
    expect(march[0]).toEqual({ date: "2099-03-01", dailyTarget: 20, isDefault: true });
    expect(march[1]).toEqual({ date: "2099-03-02", dailyTarget: 50, isDefault: true });
  });

  it("stores targets from today onward, and an explicit 0 stays 0", async () => {
    const result = await report().setCalendar([
      { date: "2099-03-11", dailyTarget: 0 },
      { date: "2099-03-12", dailyTarget: 70 },
    ]);
    expect(result).toEqual({ ok: true, changedDates: ["2099-03-11", "2099-03-12"] });

    const march = await report().calendar(2099, 3);
    expect(march[10]).toEqual({ date: "2099-03-11", dailyTarget: 0, isDefault: false });
    expect(march[11]).toEqual({ date: "2099-03-12", dailyTarget: 70, isDefault: false });
  });

  it("refuses the whole change when any date is before today (WIB), so past reports never move", async () => {
    const result = await report().setCalendar([
      { date: "2099-03-10", dailyTarget: 99 },
      { date: "2099-03-13", dailyTarget: 99 },
    ]);
    expect(result).toEqual({ ok: false, reason: "past_dates", dates: ["2099-03-10"] });

    const march = await report().calendar(2099, 3);
    expect(march[9].isDefault).toBe(true);
    expect(march[12].isDefault).toBe(true);
  });

  it("stamps the sync time only when a calendar change is stored", async () => {
    const stamp = memorySyncStamp();

    const refused = await report(NOW, stamp).setCalendar([{ date: "2099-03-01", dailyTarget: 10 }]);
    expect(refused.ok).toBe(false);
    expect(await stamp.lastUpdated()).toBeNull();

    const stored = await report(NOW, stamp).setCalendar([{ date: "2099-03-14", dailyTarget: 10 }]);
    expect(stored.ok).toBe(true);
    expect(await stamp.lastUpdated()).toBe(String(NOW.getTime()));
  });

  it("refuses targets that are not whole numbers between 0 and 10000", async () => {
    const result = await report().setCalendar([
      { date: "2099-03-20", dailyTarget: -1 },
      { date: "2099-03-21", dailyTarget: 2.5 },
    ]);
    expect(result).toEqual({
      ok: false,
      reason: "invalid_target",
      dates: ["2099-03-20", "2099-03-21"],
    });
  });
});

describe("Laporan Capaian: reports", () => {
  // Kalender Target for March 2099 (1 March is a Sunday). Days 1..10:
  // 20(def) 40 50 50 50 50 20(def) 20(def) 50 30  -> Target Kumulatif on the 10th = 380
  const MONTH_START = new Date("2099-02-28T17:00:00Z"); // 1 March 00:00 WIB
  let up3Id: string;
  let ulpA: string;
  let ulpB: string;
  let appVersionId: string;

  async function approved(ulpId: string, entryDate: string, status: "APPROVED" | "PENDING" = "APPROVED") {
    await prisma.ratingReview.create({
      data: {
        up3Id,
        ulpId,
        appVersionId,
        playstoreReviewerName: "Fixture Laporan Capaian",
        entryDate: new Date(entryDate),
        evidenceImagePath: "evidence/fixture.jpg",
        validationStatus: status,
      },
    });
  }

  async function removeFixtures() {
    const up3 = await prisma.uP3.findUnique({ where: { code: "UP3_LC_FIXTURE" } });
    if (up3) {
      await prisma.ratingReview.deleteMany({ where: { up3Id: up3.id } });
      await prisma.uLP.deleteMany({ where: { up3Id: up3.id } });
      await prisma.uP3.delete({ where: { id: up3.id } });
    }
    await prisma.appVersion.deleteMany({ where: { version: "LC-FIXTURE" } });
    await clearCalendar2099();
  }

  beforeAll(async () => {
    await removeFixtures();
    const up3 = await prisma.uP3.create({
      data: {
        code: "UP3_LC_FIXTURE",
        name: "UP3 FIXTURE",
        ulps: { create: [{ code: "ULP_LC_A", name: "ULP A" }, { code: "ULP_LC_B", name: "ULP B" }] },
      },
      include: { ulps: { orderBy: { code: "asc" } } },
    });
    up3Id = up3.id;
    [ulpA, ulpB] = up3.ulps.map((u) => u.id);
    appVersionId = (await prisma.appVersion.create({ data: { version: "LC-FIXTURE" } })).id;

    // Written while "today" is 1 March, so none of these dates are locked yet.
    const setup = await report(MONTH_START).setCalendar([
      { date: "2099-03-02", dailyTarget: 40 },
      { date: "2099-03-10", dailyTarget: 30 },
      { date: "2099-03-11", dailyTarget: 0 },
      { date: "2099-04-01", dailyTarget: 1 },
    ]);
    expect(setup.ok).toBe(true);

    await approved(ulpA, "2099-02-28T03:00:00Z"); // previous month
    await approved(ulpA, "2099-03-09T00:00:00Z"); // intake stores UTC midnight: 9 March 07:00 WIB
    await approved(ulpA, "2099-03-09T00:00:00Z");
    await approved(ulpA, "2099-03-09T17:30:00Z"); // 10 March 00:30 WIB
    await approved(ulpA, "2099-03-10T05:00:00Z", "PENDING");
    await approved(ulpB, "2099-03-10T03:00:00Z");
    await approved(ulpB, "2099-03-10T03:00:00Z");
    await approved(ulpB, "2099-03-10T03:00:00Z");
    await approved(ulpB, "2099-03-11T02:00:00Z");
    await approved(ulpB, "2099-04-01T03:00:00Z");
  });

  afterAll(removeFixtures);

  function posisi(date: string) {
    const parsed = report().parsePosisi(date);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.posisi;
  }

  it("Laporan Harian counts APPROVED reviews per WIB day against that day's Kalender Target", async () => {
    const daily = await report().daily(posisi("2099-03-10"), { up3Id });

    expect(daily.posisiTanggal).toBe("2099-03-10");
    expect(daily.targetIsDefault).toBe(false);
    expect(daily.groups).toHaveLength(1);
    expect(daily.groups[0].ulps).toEqual([
      expect.objectContaining({ ulpId: ulpA, dailyTarget: 30, dailyRealization: 1, dailyPercentage: 3.3, status: "TIDAK TERCAPAI" }),
      expect.objectContaining({ ulpId: ulpB, dailyTarget: 30, dailyRealization: 3, dailyPercentage: 10, status: "TIDAK TERCAPAI" }),
    ]);
    expect(daily.groups[0].subtotal).toEqual({ dailyTarget: 60, dailyRealization: 4, dailyPercentage: 6.7, status: "TIDAK TERCAPAI" });
    expect(daily.grandTotal).toEqual(daily.groups[0].subtotal);
  });

  it("a 0 target day reports 0.0% and TIDAK TERCAPAI without NaN (AC-3)", async () => {
    const daily = await report().daily(posisi("2099-03-11"), { up3Id });
    const rowB = daily.groups[0].ulps.find((u) => u.ulpId === ulpB)!;
    expect(rowB).toMatchObject({ dailyTarget: 0, dailyRealization: 1, dailyPercentage: 0, status: "TIDAK TERCAPAI" });
  });

  it("Laporan Bulanan sums the Kalender Target from the 1st to the Posisi Tanggal, and lists the days that used the default", async () => {
    const monthly = await report().monthly(posisi("2099-03-10"), { up3Id });

    expect(monthly.posisiTanggal).toBe("2099-03-10");
    expect(monthly.year).toBe(2099);
    expect(monthly.month).toBe(3);
    expect(monthly.defaultTargetDates).toEqual([
      "2099-03-01", "2099-03-03", "2099-03-04", "2099-03-05",
      "2099-03-06", "2099-03-07", "2099-03-08", "2099-03-09",
    ]);
    expect(monthly.groups[0].ulps).toEqual([
      expect.objectContaining({
        ulpId: ulpA, dailyTarget: 30, cumulativeTarget: 380,
        dailyRealization: 1, cumulativeRealization: 3, cumulativePercentage: 0.8, status: "TIDAK TERCAPAI",
      }),
      expect.objectContaining({
        ulpId: ulpB, dailyTarget: 30, cumulativeTarget: 380,
        dailyRealization: 3, cumulativeRealization: 3, cumulativePercentage: 0.8, status: "TIDAK TERCAPAI",
      }),
    ]);
    expect(monthly.grandTotal).toEqual({
      dailyTarget: 60, cumulativeTarget: 760, dailyRealization: 4,
      cumulativeRealization: 6, cumulativePercentage: 0.8, status: "TIDAK TERCAPAI",
    });
  });

  it("Kurva Pacing runs the whole month, scales the calendar by the ULPs in view, and stops actuals at the Posisi Tanggal", async () => {
    const pacing = await report().pacing(posisi("2099-03-10"), { up3Id });

    expect(pacing.totalDaysInMonth).toBe(31);
    expect(pacing.points).toHaveLength(31);
    expect(pacing.points[0]).toMatchObject({ day: 1, date: "2099-03-01", targetCumulative: 40, actualCumulative: 0, targetIsDefault: true });
    expect(pacing.points[1]).toMatchObject({ day: 2, targetCumulative: 120, targetIsDefault: false });
    expect(pacing.points[8]).toMatchObject({ day: 9, actualCumulative: 2 });
    expect(pacing.points[9]).toMatchObject({ day: 10, targetCumulative: 760, actualCumulative: 6 });
    expect(pacing.points[10]).toMatchObject({ day: 11, actualCumulative: null });

    const oneUlp = await report().pacing(posisi("2099-03-10"), { up3Id, ulpId: ulpA });
    expect(oneUlp.points[9]).toMatchObject({ targetCumulative: 380, actualCumulative: 3 });
  });

  it("the pacing chart and the monthly table agree for the same Posisi Tanggal", async () => {
    const p = posisi("2099-03-10");
    const [pacing, monthly] = await Promise.all([report().pacing(p, { up3Id }), report().monthly(p, { up3Id })]);
    const atPosisi = pacing.points[p.day - 1];
    expect(atPosisi.targetCumulative).toBe(monthly.grandTotal.cumulativeTarget);
    expect(atPosisi.actualCumulative).toBe(monthly.grandTotal.cumulativeRealization);
  });

  it("KPI Eksekutif reads the same UID-wide totals as the unfiltered Laporan Bulanan", async () => {
    const p = posisi("2099-03-10");
    const [kpis, monthly] = await Promise.all([report().kpis(p), report().monthly(p)]);
    expect(kpis.totalCumulativeTarget).toBe(monthly.grandTotal.cumulativeTarget);
    expect(kpis.totalCumulativeRealization).toBe(monthly.grandTotal.cumulativeRealization);
    expect(kpis.dailyTargetToday).toBe(monthly.grandTotal.dailyTarget);
    expect(kpis.top3Ulps).toHaveLength(3);
    expect(kpis.top3Ulps[0].cumulativePercentage).toBeGreaterThanOrEqual(kpis.top3Ulps[2].cumulativePercentage);
    expect(kpis.bottom3Ulps[0].cumulativePercentage).toBeLessThanOrEqual(kpis.bottom3Ulps[2].cumulativePercentage);
  });

  it("changing today's target leaves yesterday's reports unchanged (AC-4)", async () => {
    const yesterday = posisi("2099-03-10");
    const dailyBefore = await report().daily(yesterday, { up3Id });
    const monthlyBefore = await report().monthly(yesterday, { up3Id });

    expect((await report().setCalendar([{ date: "2099-03-11", dailyTarget: 999 }])).ok).toBe(true);
    expect((await report().setCalendar([{ date: "2099-03-10", dailyTarget: 999 }])).ok).toBe(false);

    expect(await report().daily(yesterday, { up3Id })).toEqual(dailyBefore);
    expect(await report().monthly(yesterday, { up3Id })).toEqual(monthlyBefore);

    await report().setCalendar([{ date: "2099-03-11", dailyTarget: 0 }]);
  });

  it("exports the Laporan Harian and Laporan Bulanan as one workbook", async () => {
    const doc = await report().exportDocument("excel", posisi("2099-03-10"), { up3Id });
    expect(doc.contentType).toContain("spreadsheetml.sheet");
    expect(doc.filename).toBe("GORO_S2JB_Laporan_Eksekutif_2099-03-10.xlsx");
    expect(Buffer.isBuffer(doc.body) && doc.body.length).toBeGreaterThan(0);
  });

  it("exports a printable page for the same Posisi Tanggal", async () => {
    const doc = await report().exportDocument("pdf", posisi("2099-03-10"), { up3Id });
    expect(doc.contentType).toContain("text/html");
    expect(doc.filename).toBeUndefined();
    expect(String(doc.body)).toContain("ULP A");
  });

  it("marks TERCAPAI once Realisasi reaches the target exactly", async () => {
    const onApril1 = report(new Date("2099-04-01T05:00:00Z"));
    const parsed = onApril1.parsePosisi("2099-04-01");
    if (!parsed.ok) throw new Error(parsed.error);

    const daily = await onApril1.daily(parsed.posisi, { up3Id });
    const [rowA, rowB] = daily.groups[0].ulps;
    expect(rowA).toMatchObject({ dailyTarget: 1, dailyRealization: 0, status: "TIDAK TERCAPAI" });
    expect(rowB).toMatchObject({ dailyTarget: 1, dailyRealization: 1, dailyPercentage: 100, status: "TERCAPAI" });

    const monthly = await onApril1.monthly(parsed.posisi, { up3Id });
    expect(monthly.groups[0].ulps[1]).toMatchObject({ cumulativeTarget: 1, cumulativeRealization: 1, status: "TERCAPAI" });
  });
});

describe("Laporan Capaian: sync status", () => {
  it("reports the sync stamp when one was recorded", async () => {
    const stamp = memorySyncStamp();
    await stamp.markUpdated();
    const status = await report(NOW, stamp).syncStatus();
    expect(status.lastSyncTimestamp).toBe(String(NOW.getTime()));
    expect(typeof status.totalApprovedCount).toBe("number");
    expect(status.totalReviewsCount).toBeGreaterThanOrEqual(status.totalApprovedCount);
  });

  it("falls back to the latest data change when no stamp exists", async () => {
    const status = await report(NOW, memorySyncStamp()).syncStatus();
    expect(status.lastSyncTimestamp).toMatch(/^\d+$/);
  });
});

describe("Laporan Capaian: export formats", () => {
  it("knows excel and pdf, nothing else", () => {
    expect(isExportFormat("excel")).toBe(true);
    expect(isExportFormat("pdf")).toBe(true);
    expect(isExportFormat("csv")).toBe(false);
    expect(isExportFormat(undefined)).toBe(false);
  });
});

describe("Laporan Capaian: Posisi Tanggal", () => {
  it("defaults to today in WIB, even when the UTC date is still yesterday", () => {
    expect(report().parsePosisi(undefined)).toEqual({
      ok: true,
      posisi: { date: "2099-03-11", year: 2099, month: 3, day: 11 },
    });
  });

  it("accepts a YYYY-MM-DD date and clamps a future date to today", () => {
    const past = report().parsePosisi("2099-03-05");
    expect(past.ok && past.posisi.date).toBe("2099-03-05");

    const future = report().parsePosisi("2099-04-01");
    expect(future.ok && future.posisi.date).toBe("2099-03-11");
  });

  it("rejects anything that is not a real calendar date", () => {
    expect(report().parsePosisi("2099-02-30").ok).toBe(false);
    expect(report().parsePosisi("2099-03-05T00:00:00.000Z").ok).toBe(false);
    expect(report().parsePosisi("kemarin").ok).toBe(false);
  });
});
