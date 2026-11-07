import prisma from "@/lib/prisma";
import { ValidationStatus } from "@prisma/client";

export interface TargetConfig {
  weekdayTarget: number;
  weekendTarget: number;
}

export const DEFAULT_TARGET_CONFIG: TargetConfig = {
  weekdayTarget: 50,
  weekendTarget: 20,
};

/**
 * Retrieves the current target settings (weekday: Mon-Fri, weekend: Sat-Sun)
 * Stored in Redis with resilient in-memory fallback.
 */
export async function getTargetConfig(): Promise<TargetConfig> {
  try {
    const redis = (await import("@/lib/redis")).default;
    const raw = await redis.get("config:report:targets");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        weekdayTarget:
          typeof parsed.weekdayTarget === "number" && parsed.weekdayTarget >= 0
            ? parsed.weekdayTarget
            : DEFAULT_TARGET_CONFIG.weekdayTarget,
        weekendTarget:
          typeof parsed.weekendTarget === "number" && parsed.weekendTarget >= 0
            ? parsed.weekendTarget
            : DEFAULT_TARGET_CONFIG.weekendTarget,
      };
    }
  } catch {
    // Non-critical fallback
  }
  return DEFAULT_TARGET_CONFIG;
}

/**
 * Updates target settings and triggers dashboard real-time invalidation.
 */
export async function saveTargetConfig(
  config: Partial<TargetConfig>
): Promise<TargetConfig> {
  const current = await getTargetConfig();
  const updated: TargetConfig = {
    weekdayTarget:
      typeof config.weekdayTarget === "number" && config.weekdayTarget >= 0
        ? config.weekdayTarget
        : current.weekdayTarget,
    weekendTarget:
      typeof config.weekendTarget === "number" && config.weekendTarget >= 0
        ? config.weekendTarget
        : current.weekendTarget,
  };
  try {
    const redis = (await import("@/lib/redis")).default;
    await redis.set("config:report:targets", JSON.stringify(updated));
    await redis.set("reports:last_update_timestamp", Date.now().toString());
  } catch {
    // Non-critical fallback
  }
  return updated;
}

/**
 * Computes daily target for a given date based on weekday (1..5) or weekend (0, 6).
 */
export function calculateDailyTargetForDate(
  date: Date,
  config: TargetConfig = DEFAULT_TARGET_CONFIG
): number {
  const day = date.getDay(); // 0 is Sunday, 6 is Saturday
  if (day === 0 || day === 6) {
    return config.weekendTarget;
  }
  return config.weekdayTarget;
}

/**
 * Computes cumulative target from day 1 of the month up to upToDay.
 */
export function calculateCumulativeTargetForMonth(
  year: number,
  month: number, // 1 - 12
  upToDay: number,
  config: TargetConfig = DEFAULT_TARGET_CONFIG
): number {
  let sum = 0;
  for (let d = 1; d <= upToDay; d++) {
    const dt = new Date(year, month - 1, d);
    sum += calculateDailyTargetForDate(dt, config);
  }
  return sum;
}

export function determineStatus(percentage: number): "TERCAPAI" | "TIDAK TERCAPAI" {
  return percentage >= 100.0 ? "TERCAPAI" : "TIDAK TERCAPAI";
}

export function calculateDailyMetrics(realization: number, target: number) {
  const dailyPercentage = target > 0 ? Math.round((realization / target) * 1000) / 10 : 0.0;
  return {
    realization,
    target,
    dailyPercentage,
    status: determineStatus(dailyPercentage),
  };
}

export function calculateCumulativeMetrics(
  cumulativeRealization: number,
  cumulativeTarget: number
) {
  const cumulativePercentage =
    cumulativeTarget > 0
      ? Math.round((cumulativeRealization / cumulativeTarget) * 1000) / 10
      : 0.0;
  return {
    cumulativeRealization,
    cumulativeTarget,
    cumulativePercentage,
    status: determineStatus(cumulativePercentage),
  };
}

export interface UlpDailyRow {
  ulpId: string;
  ulpCode: string;
  ulpName: string;
  up3Id: string;
  up3Name: string;
  dailyTarget: number;
  dailyRealization: number;
  dailyPercentage: number;
  status: "TERCAPAI" | "TIDAK TERCAPAI";
}

export interface Up3GroupDaily {
  up3Id: string;
  up3Code: string;
  up3Name: string;
  ulps: UlpDailyRow[];
  subtotal: {
    dailyTarget: number;
    dailyRealization: number;
    dailyPercentage: number;
    status: "TERCAPAI" | "TIDAK TERCAPAI";
  };
}

export interface UlpMonthlyRow {
  ulpId: string;
  ulpCode: string;
  ulpName: string;
  up3Id: string;
  up3Name: string;
  dailyTarget: number;
  cumulativeTarget: number;
  dailyRealization: number;
  cumulativeRealization: number;
  cumulativePercentage: number;
  status: "TERCAPAI" | "TIDAK TERCAPAI";
}

export interface Up3GroupMonthly {
  up3Id: string;
  up3Code: string;
  up3Name: string;
  ulps: UlpMonthlyRow[];
  subtotal: {
    dailyTarget: number;
    cumulativeTarget: number;
    dailyRealization: number;
    cumulativeRealization: number;
    cumulativePercentage: number;
    status: "TERCAPAI" | "TIDAK TERCAPAI";
  };
}

/**
 * Generates Daily Report for a specific date (replicates LAPORAN HARIAN)
 */
export async function getDailyReport(targetDate: Date, up3IdFilter?: string) {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const targetConfig = await getTargetConfig();
  const defaultDailyTarget = calculateDailyTargetForDate(targetDate, targetConfig);

  // 1. Fetch UP3s and ULPs
  const up3s = await prisma.uP3.findMany({
    where: up3IdFilter ? { id: up3IdFilter } : undefined,
    orderBy: { code: "asc" },
    include: {
      ulps: {
        orderBy: { code: "asc" },
      },
    },
  });

  // 2. Fetch all approved reviews for this day
  const approvedReviews = await prisma.ratingReview.groupBy({
    by: ["ulpId"],
    where: {
      entryDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      validationStatus: ValidationStatus.APPROVED,
    },
    _count: {
      _all: true,
    },
  });

  const realizationMap = new Map<string, number>();
  for (const r of approvedReviews) {
    realizationMap.set(r.ulpId, r._count._all);
  }

  // 3. Fetch targets with immutability: latest target on or before targetDate
  const allTargets = await prisma.targetMaster.findMany({
    where: {
      targetDate: {
        lte: endOfDay,
      },
    },
    orderBy: [{ ulpId: "asc" }, { targetDate: "desc" }],
  });

  const targetMap = new Map<string, { dailyTarget: number; cumulativeTarget: number }>();
  for (const t of allTargets) {
    if (!targetMap.has(t.ulpId)) {
      targetMap.set(t.ulpId, {
        dailyTarget: t.dailyTarget,
        cumulativeTarget: t.cumulativeTarget,
      });
    }
  }

  // 4. Construct UP3 Groups and rows
  const groups: Up3GroupDaily[] = [];
  let grandTotalTarget = 0;
  let grandTotalRealization = 0;

  for (const up3 of up3s) {
    const ulpRows: UlpDailyRow[] = [];
    let subtotalTarget = 0;
    let subtotalRealization = 0;

    for (const ulp of up3.ulps) {
      const explicitTarget = targetMap.get(ulp.id)?.dailyTarget;
      const dailyTargetVal =
        typeof explicitTarget === "number" && explicitTarget > 0
          ? explicitTarget
          : defaultDailyTarget;
      const realization = realizationMap.get(ulp.id) || 0;
      const metrics = calculateDailyMetrics(realization, dailyTargetVal);

      ulpRows.push({
        ulpId: ulp.id,
        ulpCode: ulp.code,
        ulpName: ulp.name,
        up3Id: up3.id,
        up3Name: up3.name,
        dailyTarget: dailyTargetVal,
        dailyRealization: realization,
        dailyPercentage: metrics.dailyPercentage,
        status: metrics.status,
      });

      subtotalTarget += dailyTargetVal;
      subtotalRealization += realization;
    }

    const subtotalMetrics = calculateDailyMetrics(subtotalRealization, subtotalTarget);

    groups.push({
      up3Id: up3.id,
      up3Code: up3.code,
      up3Name: up3.name,
      ulps: ulpRows,
      subtotal: {
        dailyTarget: subtotalTarget,
        dailyRealization: subtotalRealization,
        dailyPercentage: subtotalMetrics.dailyPercentage,
        status: subtotalMetrics.status,
      },
    });

    grandTotalTarget += subtotalTarget;
    grandTotalRealization += subtotalRealization;
  }

  const grandTotalMetrics = calculateDailyMetrics(grandTotalRealization, grandTotalTarget);

  return {
    targetDate: startOfDay,
    groups,
    grandTotal: {
      dailyTarget: grandTotalTarget,
      dailyRealization: grandTotalRealization,
      dailyPercentage: grandTotalMetrics.dailyPercentage,
      status: grandTotalMetrics.status,
    },
  };
}

/**
 * Generates Monthly Report (replicates LAPORAN BULANAN)
 */
export async function getMonthlyReport(
  year: number,
  month: number, // 1 - 12
  up3IdFilter?: string,
  asOfDate?: Date
) {
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = asOfDate || new Date(year, month, 0, 23, 59, 59, 999);
  const targetDay = endOfMonth.getDate();

  const targetConfig = await getTargetConfig();
  const defaultDailyTarget = calculateDailyTargetForDate(endOfMonth, targetConfig);
  const defaultCumulativeTarget = calculateCumulativeTargetForMonth(
    year,
    month,
    targetDay,
    targetConfig
  );

  // Single day bounds for daily realization on asOfDate
  const dayStart = new Date(endOfMonth);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(endOfMonth);
  dayEnd.setHours(23, 59, 59, 999);

  // 1. Fetch UP3s and ULPs
  const up3s = await prisma.uP3.findMany({
    where: up3IdFilter ? { id: up3IdFilter } : undefined,
    orderBy: { code: "asc" },
    include: {
      ulps: {
        orderBy: { code: "asc" },
      },
    },
  });

  // 2. Fetch cumulative approved reviews from day 1 to endOfMonth
  const cumulativeApproved = await prisma.ratingReview.groupBy({
    by: ["ulpId"],
    where: {
      entryDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      validationStatus: ValidationStatus.APPROVED,
    },
    _count: {
      _all: true,
    },
  });

  const cumulativeMap = new Map<string, number>();
  for (const c of cumulativeApproved) {
    cumulativeMap.set(c.ulpId, c._count._all);
  }

  // 3. Fetch single day approved reviews for endOfMonth
  const dailyApproved = await prisma.ratingReview.groupBy({
    by: ["ulpId"],
    where: {
      entryDate: {
        gte: dayStart,
        lte: dayEnd,
      },
      validationStatus: ValidationStatus.APPROVED,
    },
    _count: {
      _all: true,
    },
  });

  const dailyMap = new Map<string, number>();
  for (const d of dailyApproved) {
    dailyMap.set(d.ulpId, d._count._all);
  }

  // 4. Fetch target snapshot on or before endOfMonth
  const allTargets = await prisma.targetMaster.findMany({
    where: {
      targetDate: {
        lte: endOfMonth,
      },
    },
    orderBy: [{ ulpId: "asc" }, { targetDate: "desc" }],
  });

  const targetMap = new Map<string, { dailyTarget: number; cumulativeTarget: number }>();
  for (const t of allTargets) {
    if (!targetMap.has(t.ulpId)) {
      targetMap.set(t.ulpId, {
        dailyTarget: t.dailyTarget,
        cumulativeTarget: t.cumulativeTarget,
      });
    }
  }

  // 5. Construct groups
  const groups: Up3GroupMonthly[] = [];
  let grandDailyTarget = 0;
  let grandCumulativeTarget = 0;
  let grandDailyRealization = 0;
  let grandCumulativeRealization = 0;

  for (const up3 of up3s) {
    const ulpRows: UlpMonthlyRow[] = [];
    let subDailyTarget = 0;
    let subCumulativeTarget = 0;
    let subDailyRealization = 0;
    let subCumulativeRealization = 0;

    for (const ulp of up3.ulps) {
      const explicitTarget = targetMap.get(ulp.id);
      const dTarget =
        explicitTarget && explicitTarget.dailyTarget > 0
          ? explicitTarget.dailyTarget
          : defaultDailyTarget;
      const cTarget =
        explicitTarget && explicitTarget.cumulativeTarget > 0
          ? explicitTarget.cumulativeTarget
          : defaultCumulativeTarget;

      const dRealization = dailyMap.get(ulp.id) || 0;
      const cRealization = cumulativeMap.get(ulp.id) || 0;
      const metrics = calculateCumulativeMetrics(cRealization, cTarget);

      ulpRows.push({
        ulpId: ulp.id,
        ulpCode: ulp.code,
        ulpName: ulp.name,
        up3Id: up3.id,
        up3Name: up3.name,
        dailyTarget: dTarget,
        cumulativeTarget: cTarget,
        dailyRealization: dRealization,
        cumulativeRealization: cRealization,
        cumulativePercentage: metrics.cumulativePercentage,
        status: metrics.status,
      });

      subDailyTarget += dTarget;
      subCumulativeTarget += cTarget;
      subDailyRealization += dRealization;
      subCumulativeRealization += cRealization;
    }

    const subMetrics = calculateCumulativeMetrics(subCumulativeRealization, subCumulativeTarget);

    groups.push({
      up3Id: up3.id,
      up3Code: up3.code,
      up3Name: up3.name,
      ulps: ulpRows,
      subtotal: {
        dailyTarget: subDailyTarget,
        cumulativeTarget: subCumulativeTarget,
        dailyRealization: subDailyRealization,
        cumulativeRealization: subCumulativeRealization,
        cumulativePercentage: subMetrics.cumulativePercentage,
        status: subMetrics.status,
      },
    });

    grandDailyTarget += subDailyTarget;
    grandCumulativeTarget += subCumulativeTarget;
    grandDailyRealization += subDailyRealization;
    grandCumulativeRealization += subCumulativeRealization;
  }

  const grandMetrics = calculateCumulativeMetrics(
    grandCumulativeRealization,
    grandCumulativeTarget
  );

  return {
    year,
    month,
    asOfDate: endOfMonth,
    groups,
    grandTotal: {
      dailyTarget: grandDailyTarget,
      cumulativeTarget: grandCumulativeTarget,
      dailyRealization: grandDailyRealization,
      cumulativeRealization: grandCumulativeRealization,
      cumulativePercentage: grandMetrics.cumulativePercentage,
      status: grandMetrics.status,
    },
  };
}

/**
 * Calculates Executive KPIs (UID Overview, Leaderboard, Underperforming)
 */
export async function getExecutiveKpis(asOfDate: Date = new Date()) {
  const year = asOfDate.getFullYear();
  const month = asOfDate.getMonth() + 1;

  const monthlyReport = await getMonthlyReport(year, month, undefined, asOfDate);

  // Flatten all ULP rows
  const allUlps: UlpMonthlyRow[] = [];
  for (const group of monthlyReport.groups) {
    allUlps.push(...group.ulps);
  }

  // Sort by cumulative percentage descending for Leaderboard
  const sortedDesc = [...allUlps].sort(
    (a, b) => b.cumulativePercentage - a.cumulativePercentage
  );
  const top3Ulps = sortedDesc.slice(0, 3);

  // Sort ascending for Underperforming
  const sortedAsc = [...allUlps].sort(
    (a, b) => a.cumulativePercentage - b.cumulativePercentage
  );
  const bottom3Ulps = sortedAsc.slice(0, 3);

  return {
    totalCumulativeRealization: monthlyReport.grandTotal.cumulativeRealization,
    totalCumulativeTarget: monthlyReport.grandTotal.cumulativeTarget,
    cumulativeAchievementRate: monthlyReport.grandTotal.cumulativePercentage,
    dailyRealizationToday: monthlyReport.grandTotal.dailyRealization,
    dailyTargetToday: monthlyReport.grandTotal.dailyTarget,
    top3Ulps,
    bottom3Ulps,
  };
}

/**
 * Returns Pacing Curve Data (Actual Cumulative vs Configurable Step Target Cumulative across days)
 */
export async function getPacingData(
  year: number,
  month: number,
  up3IdFilter?: string,
  ulpIdFilter?: string
) {
  const startOfMonth = new Date(year, month - 1, 1);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // Determine current day of month (or last day if viewing past month)
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const currentDayLimit = isCurrentMonth ? now.getDate() : totalDaysInMonth;

  const targetConfig = await getTargetConfig();

  // Count relevant ULPs
  const ulpCount = await prisma.uLP.count({
    where: {
      id: ulpIdFilter ? ulpIdFilter : undefined,
      up3Id: up3IdFilter ? up3IdFilter : undefined,
    },
  });
  const effectiveUlpCount = Math.max(ulpCount, 1);

  // Total cumulative target for the entire month
  const totalCumulativeTarget =
    calculateCumulativeTargetForMonth(year, month, totalDaysInMonth, targetConfig) *
    effectiveUlpCount;

  // Fetch all approved reviews in this month for selected filter
  const reviews = await prisma.ratingReview.findMany({
    where: {
      up3Id: up3IdFilter ? up3IdFilter : undefined,
      ulpId: ulpIdFilter ? ulpIdFilter : undefined,
      entryDate: {
        gte: startOfMonth,
        lte: new Date(year, month, 0, 23, 59, 59, 999),
      },
      validationStatus: ValidationStatus.APPROVED,
    },
    select: {
      entryDate: true,
    },
  });

  // Group by day of month
  const dayRealizationMap = new Map<number, number>();
  for (const rev of reviews) {
    const d = new Date(rev.entryDate).getDate();
    dayRealizationMap.set(d, (dayRealizationMap.get(d) || 0) + 1);
  }

  // Build daily pacing points
  const points: Array<{
    day: number;
    dateLabel: string;
    targetCumulative: number;
    actualCumulative: number | null;
  }> = [];

  let runningActual = 0;
  let runningTargetCumulative = 0;

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dayDate = new Date(year, month - 1, day);
    const dayTarget =
      calculateDailyTargetForDate(dayDate, targetConfig) * effectiveUlpCount;
    runningTargetCumulative += dayTarget;

    const dayRealization = dayRealizationMap.get(day) || 0;
    runningActual += dayRealization;

    points.push({
      day,
      dateLabel: `${day} ${dayDate.toLocaleString("id-ID", { month: "short" })}`,
      targetCumulative: runningTargetCumulative,
      actualCumulative: day <= currentDayLimit ? runningActual : null,
    });
  }

  return {
    year,
    month,
    totalCumulativeTarget,
    totalDaysInMonth,
    points,
  };
}
