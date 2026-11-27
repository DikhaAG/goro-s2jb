import { ValidationStatus, type PrismaClient } from "@prisma/client";
import { wibDateOf as wibDayKey, wibDayStart } from "@/lib/wibDate";
import {
  achievementPercentage as percentage,
  achievementStatus as status,
  type AchievementStatus,
} from "@/lib/achievementMath";

export type { AchievementStatus };

/** A WIB calendar date as "YYYY-MM-DD". */
type DayKey = string;

export interface PosisiTanggal {
  readonly date: DayKey;
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export type ParsePosisiResult =
  | { ok: true; posisi: PosisiTanggal }
  | { ok: false; error: string };

export interface CalendarDay {
  date: DayKey;
  dailyTarget: number;
  /** True when no Kalender Target entry exists and the fixed fallback applies. */
  isDefault: boolean;
}

export type SetCalendarResult =
  | { ok: true; changedDates: DayKey[] }
  | { ok: false; reason: "past_dates" | "invalid_target"; dates: DayKey[] };

export interface UnitFilter {
  up3Id?: string;
  ulpId?: string;
}

/** The four numbers every Laporan Capaian view is projected from. */
interface Figures {
  dailyTarget: number;
  cumulativeTarget: number;
  dailyRealization: number;
  cumulativeRealization: number;
}

/**
 * Fallback for dates without a Kalender Target entry. Deliberately a constant:
 * changing it would rewrite every past date that had no entry (ADR-0002).
 */
const FALLBACK_TARGET = { weekday: 50, weekend: 20 } as const;
const MAX_DAILY_TARGET = 10000;

/** The Redis-like store that holds the sync stamp. Every method is optional so a bare client degrades to a no-op. */
export interface SyncStampStore {
  get?: (key: string) => Promise<string | null>;
  set?: (key: string, value: string) => Promise<unknown>;
  status?: string;
}

type SyncStampStoreSource = () => SyncStampStore | null | undefined | Promise<SyncStampStore | null | undefined>;

const SYNC_STAMP_KEY = "reports:last_update_timestamp";

/**
 * When Laporan Capaian data last changed, so open dashboards know to refetch.
 * Best effort: the reports read the database directly, so a missing or failing
 * store only delays the live refresh and never fails the caller.
 */
export function createReportSyncStamp(loadStore: SyncStampStoreSource, now: () => Date = () => new Date()) {
  async function store(): Promise<SyncStampStore | null> {
    try {
      const loaded = await loadStore();
      return loaded && loaded.status !== "end" ? loaded : null;
    } catch {
      return null;
    }
  }

  return {
    /** Call after anything that changes Realisasi or the Kalender Target. */
    async markUpdated(): Promise<void> {
      const target = await store();
      if (!target?.set) return;
      try {
        await target.set(SYNC_STAMP_KEY, String(now().getTime()));
      } catch {
        // Best effort, see above.
      }
    },

    /** Epoch milliseconds as a string, or null when nothing was stamped or the store is unreachable. */
    async lastUpdated(): Promise<string | null> {
      const target = await store();
      if (!target?.get) return null;
      try {
        return (await target.get(SYNC_STAMP_KEY)) ?? null;
      } catch {
        return null;
      }
    },
  };
}

export type ReportSyncStamp = ReturnType<typeof createReportSyncStamp>;

const noSyncStamp: ReportSyncStamp = createReportSyncStamp(() => null);

export type ExportFormat = "excel" | "pdf";

export function isExportFormat(value: unknown): value is ExportFormat {
  return value === "excel" || value === "pdf";
}

export interface ExportedDocument {
  body: Buffer | string;
  contentType: string;
  /** Set when the document downloads as an attachment; the printable page opens inline. */
  filename?: string;
}

export interface AchievementReportDeps {
  db: PrismaClient;
  now: () => Date;
  syncStamp?: ReportSyncStamp;
}

/** Calendar dates are stored as Postgres DATE, which Prisma maps to UTC midnight. */
function dateColumn(key: DayKey): Date {
  return new Date(`${key}T00:00:00Z`);
}

function dayKey(year: number, month: number, day: number): DayKey {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextDay(key: DayKey): DayKey {
  return new Date(dateColumn(key).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function sumFigures(list: Figures[]): Figures {
  return list.reduce(
    (acc, f) => ({
      dailyTarget: acc.dailyTarget + f.dailyTarget,
      cumulativeTarget: acc.cumulativeTarget + f.cumulativeTarget,
      dailyRealization: acc.dailyRealization + f.dailyRealization,
      cumulativeRealization: acc.cumulativeRealization + f.cumulativeRealization,
    }),
    { dailyTarget: 0, cumulativeTarget: 0, dailyRealization: 0, cumulativeRealization: 0 }
  );
}

function dailyView(f: Figures) {
  return {
    dailyTarget: f.dailyTarget,
    dailyRealization: f.dailyRealization,
    dailyPercentage: percentage(f.dailyRealization, f.dailyTarget),
    status: status(f.dailyRealization, f.dailyTarget),
  };
}

function monthlyView(f: Figures) {
  return {
    dailyTarget: f.dailyTarget,
    cumulativeTarget: f.cumulativeTarget,
    dailyRealization: f.dailyRealization,
    cumulativeRealization: f.cumulativeRealization,
    cumulativePercentage: percentage(f.cumulativeRealization, f.cumulativeTarget),
    status: status(f.cumulativeRealization, f.cumulativeTarget),
  };
}

function fallbackTarget(key: DayKey): number {
  const weekday = dateColumn(key).getUTCDay();
  return weekday === 0 || weekday === 6 ? FALLBACK_TARGET.weekend : FALLBACK_TARGET.weekday;
}

function toPosisi(date: DayKey): PosisiTanggal {
  const [year, month, day] = date.split("-").map(Number);
  return { date, year, month, day };
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function createAchievementReport({ db, now, syncStamp = noSyncStamp }: AchievementReportDeps) {
  function today(): DayKey {
    return wibDayKey(now());
  }

  function parsePosisi(input: string | undefined): ParsePosisiResult {
    if (input === undefined || input === "") return { ok: true, posisi: toPosisi(today()) };
    if (!isRealDate(input)) {
      return { ok: false, error: "Posisi Tanggal harus berupa tanggal YYYY-MM-DD yang valid." };
    }
    return { ok: true, posisi: toPosisi(input > today() ? today() : input) };
  }

  /** The one target rule every view uses: the calendar entry, or the fixed fallback. */
  async function monthTargets(year: number, month: number): Promise<CalendarDay[]> {
    const last = daysInMonth(year, month);
    const entries = await db.targetCalendarEntry.findMany({
      where: { date: { gte: dateColumn(dayKey(year, month, 1)), lte: dateColumn(dayKey(year, month, last)) } },
    });
    const stored = new Map(entries.map((e) => [e.date.toISOString().slice(0, 10), e.dailyTarget]));

    return Array.from({ length: last }, (_, i) => {
      const date = dayKey(year, month, i + 1);
      const explicit = stored.get(date);
      return explicit === undefined
        ? { date, dailyTarget: fallbackTarget(date), isDefault: true }
        : { date, dailyTarget: explicit, isDefault: false };
    });
  }

  function unitWhere(filter: UnitFilter) {
    return {
      ...(filter.up3Id ? { up3Id: filter.up3Id } : {}),
      ...(filter.ulpId ? { id: filter.ulpId } : {}),
    };
  }

  /** APPROVED reviews per ULP per WIB day, from the 1st of the month through the Posisi Tanggal. */
  async function realizations(posisi: PosisiTanggal, filter: UnitFilter) {
    const rows = await db.ratingReview.findMany({
      where: {
        validationStatus: ValidationStatus.APPROVED,
        entryDate: { gte: wibDayStart(dayKey(posisi.year, posisi.month, 1)), lt: wibDayStart(nextDay(posisi.date)) },
        ...(filter.up3Id ? { up3Id: filter.up3Id } : {}),
        ...(filter.ulpId ? { ulpId: filter.ulpId } : {}),
      },
      select: { ulpId: true, entryDate: true },
    });
    const byUlp = new Map<string, Map<DayKey, number>>();
    for (const row of rows) {
      const days = byUlp.get(row.ulpId) ?? new Map<DayKey, number>();
      const key = wibDayKey(row.entryDate);
      days.set(key, (days.get(key) ?? 0) + 1);
      byUlp.set(row.ulpId, days);
    }
    return byUlp;
  }

  /** Targets and realizations per ULP, UP3 subtotal and UID grand total at one Posisi Tanggal. */
  async function figures(posisi: PosisiTanggal, filter: UnitFilter) {
    const [month, ulps, counts] = await Promise.all([
      monthTargets(posisi.year, posisi.month),
      db.uLP.findMany({
        where: unitWhere(filter),
        orderBy: [{ up3: { code: "asc" } }, { code: "asc" }],
        include: { up3: true },
      }),
      realizations(posisi, filter),
    ]);
    const toDate = month.slice(0, posisi.day);
    const dailyTarget = toDate[toDate.length - 1].dailyTarget;
    const cumulativeTarget = toDate.reduce((sum, d) => sum + d.dailyTarget, 0);

    const groups = new Map<string, { up3: (typeof ulps)[number]["up3"]; ulps: Array<{ ulp: (typeof ulps)[number]; figures: Figures }> }>();
    for (const ulp of ulps) {
      const days = counts.get(ulp.id) ?? new Map<DayKey, number>();
      const figures: Figures = {
        dailyTarget,
        cumulativeTarget,
        dailyRealization: days.get(posisi.date) ?? 0,
        cumulativeRealization: [...days.values()].reduce((a, b) => a + b, 0),
      };
      const group = groups.get(ulp.up3Id) ?? { up3: ulp.up3, ulps: [] };
      group.ulps.push({ ulp, figures });
      groups.set(ulp.up3Id, group);
    }

    const up3s = [...groups.values()].map((g) => ({ ...g, subtotal: sumFigures(g.ulps.map((u) => u.figures)) }));
    return {
      toDate,
      up3s,
      grandTotal: sumFigures(up3s.map((g) => g.subtotal)),
    };
  }

  function rowIdentity(ulp: { id: string; code: string; name: string }, up3: { id: string; name: string }) {
    return { ulpId: ulp.id, ulpCode: ulp.code, ulpName: ulp.name, up3Id: up3.id, up3Name: up3.name };
  }

  /** Laporan Harian: each ULP's Realisasi on the Posisi Tanggal against that day's target. */
  async function daily(posisi: PosisiTanggal, filter: Pick<UnitFilter, "up3Id"> = {}) {
    const { toDate, up3s, grandTotal } = await figures(posisi, filter);
    return {
      posisiTanggal: posisi.date,
      targetIsDefault: toDate[toDate.length - 1].isDefault,
      groups: up3s.map((g) => ({
        up3Id: g.up3.id,
        up3Code: g.up3.code,
        up3Name: g.up3.name,
        ulps: g.ulps.map(({ ulp, figures }) => ({ ...rowIdentity(ulp, g.up3), ...dailyView(figures) })),
        subtotal: dailyView(g.subtotal),
      })),
      grandTotal: dailyView(grandTotal),
    };
  }

  /** Laporan Bulanan: Target Kumulatif and Realisasi from the 1st of the month to the Posisi Tanggal. */
  async function monthly(posisi: PosisiTanggal, filter: Pick<UnitFilter, "up3Id"> = {}) {
    const { toDate, up3s, grandTotal } = await figures(posisi, filter);
    return {
      posisiTanggal: posisi.date,
      year: posisi.year,
      month: posisi.month,
      defaultTargetDates: toDate.filter((d) => d.isDefault).map((d) => d.date),
      groups: up3s.map((g) => ({
        up3Id: g.up3.id,
        up3Code: g.up3.code,
        up3Name: g.up3.name,
        ulps: g.ulps.map(({ ulp, figures }) => ({ ...rowIdentity(ulp, g.up3), ...monthlyView(figures) })),
        subtotal: monthlyView(g.subtotal),
      })),
      grandTotal: monthlyView(grandTotal),
    };
  }

  /** Kurva Pacing: cumulative target for the whole month against cumulative Realisasi up to the Posisi Tanggal. */
  async function pacing(posisi: PosisiTanggal, filter: UnitFilter = {}) {
    const [month, ulpCount, counts] = await Promise.all([
      monthTargets(posisi.year, posisi.month),
      db.uLP.count({ where: unitWhere(filter) }),
      realizations(posisi, filter),
    ]);
    const perDay = new Map<DayKey, number>();
    for (const days of counts.values()) {
      for (const [key, n] of days) perDay.set(key, (perDay.get(key) ?? 0) + n);
    }

    let targetCumulative = 0;
    let actualCumulative = 0;
    const points = month.map((d, i) => {
      const day = i + 1;
      targetCumulative += d.dailyTarget * ulpCount;
      actualCumulative += perDay.get(d.date) ?? 0;
      return {
        day,
        date: d.date,
        dateLabel: dateColumn(d.date).toLocaleString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }),
        targetCumulative,
        actualCumulative: day <= posisi.day ? actualCumulative : null,
        targetIsDefault: d.isDefault,
      };
    });

    return {
      posisiTanggal: posisi.date,
      year: posisi.year,
      month: posisi.month,
      totalDaysInMonth: month.length,
      totalCumulativeTarget: targetCumulative,
      points,
    };
  }

  /** KPI Eksekutif: UID-wide totals plus the three best and worst ULPs by cumulative achievement. */
  async function kpis(posisi: PosisiTanggal) {
    const report = await monthly(posisi);
    const ulps = report.groups.flatMap((g) => g.ulps);
    const ranked = [...ulps].sort((a, b) => b.cumulativePercentage - a.cumulativePercentage);
    return {
      posisiTanggal: posisi.date,
      totalCumulativeRealization: report.grandTotal.cumulativeRealization,
      totalCumulativeTarget: report.grandTotal.cumulativeTarget,
      cumulativeAchievementRate: report.grandTotal.cumulativePercentage,
      dailyRealizationToday: report.grandTotal.dailyRealization,
      dailyTargetToday: report.grandTotal.dailyTarget,
      top3Ulps: ranked.slice(0, 3),
      bottom3Ulps: [...ranked].reverse().slice(0, 3),
    };
  }

  async function setCalendar(
    entries: Array<{ date: DayKey; dailyTarget: number }>
  ): Promise<SetCalendarResult> {
    const notDates = entries.filter((e) => !isRealDate(e.date)).map((e) => e.date);
    if (notDates.length > 0) return { ok: false, reason: "invalid_target", dates: notDates };

    const past = entries.filter((e) => e.date < today()).map((e) => e.date);
    if (past.length > 0) return { ok: false, reason: "past_dates", dates: past };

    const invalid = entries
      .filter((e) => !Number.isInteger(e.dailyTarget) || e.dailyTarget < 0 || e.dailyTarget > MAX_DAILY_TARGET)
      .map((e) => e.date);
    if (invalid.length > 0) return { ok: false, reason: "invalid_target", dates: invalid };

    await db.$transaction(
      entries.map(({ date, dailyTarget }) =>
        db.targetCalendarEntry.upsert({
          where: { date: dateColumn(date) },
          create: { date: dateColumn(date), dailyTarget },
          update: { dailyTarget },
        })
      )
    );
    await syncStamp.markUpdated();
    return { ok: true, changedDates: entries.map((e) => e.date).sort() };
  }

  /** Laporan Harian and Laporan Bulanan together, as a workbook or a printable page. */
  async function exportDocument(
    format: ExportFormat,
    posisi: PosisiTanggal,
    filter: Pick<UnitFilter, "up3Id"> = {}
  ): Promise<ExportedDocument> {
    const [dailyReport, monthlyReport] = await Promise.all([daily(posisi, filter), monthly(posisi, filter)]);
    const reports = { daily: dailyReport, monthly: monthlyReport };

    // Loaded on demand so callers that only stamp or read reports never pull in ExcelJS.
    if (format === "excel") {
      const { generateExecutiveWorkbook } = await import("@/lib/export/excelExporter");
      return {
        body: await generateExecutiveWorkbook(reports),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `GORO_S2JB_Laporan_Eksekutif_${posisi.date}.xlsx`,
      };
    }
    const { generatePrintableHtmlReport } = await import("@/lib/export/pdfExporter");
    return { body: generatePrintableHtmlReport(reports), contentType: "text/html; charset=utf-8" };
  }

  /** What the dashboard polls to decide whether to refetch: the sync stamp, or the latest data change. */
  async function syncStatus() {
    const [latestBatch, latestApprovedReview, totalApprovedCount, totalReviewsCount, stamp] = await Promise.all([
      db.migrationBatch.findFirst({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          fileName: true,
          status: true,
          completedAt: true,
          updatedAt: true,
          processedRows: true,
          totalRows: true,
        },
      }),
      db.ratingReview.findFirst({
        where: { validationStatus: ValidationStatus.APPROVED },
        orderBy: { entryDate: "desc" },
        select: { id: true, entryDate: true, updatedAt: true },
      }),
      db.ratingReview.count({ where: { validationStatus: ValidationStatus.APPROVED } }),
      db.ratingReview.count(),
      syncStamp.lastUpdated(),
    ]);

    const lastDataChange = latestApprovedReview?.updatedAt ?? latestBatch?.updatedAt ?? now();
    return {
      lastSyncTimestamp: stamp ?? String(lastDataChange.getTime()),
      latestBatch,
      latestApprovedReviewDate: latestApprovedReview?.entryDate.toISOString() ?? null,
      totalApprovedCount,
      totalReviewsCount,
    };
  }

  return {
    parsePosisi,
    daily,
    monthly,
    pacing,
    kpis,
    calendar: monthTargets,
    setCalendar,
    exportDocument,
    syncStatus,
  };
}

export type AchievementReport = ReturnType<typeof createAchievementReport>;
export type DailyReport = Awaited<ReturnType<AchievementReport["daily"]>>;
export type MonthlyReport = Awaited<ReturnType<AchievementReport["monthly"]>>;
export type PacingReport = Awaited<ReturnType<AchievementReport["pacing"]>>;
export type Up3GroupDaily = DailyReport["groups"][number];
export type Up3GroupMonthly = MonthlyReport["groups"][number];
export type UlpMonthlyRow = Up3GroupMonthly["ulps"][number];
