import prisma from "@/lib/prisma";
import { ValidationStatus } from "@prisma/client";

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
      const targetObj = targetMap.get(ulp.id) || { dailyTarget: 50.0, cumulativeTarget: 1100.0 };
      const realization = realizationMap.get(ulp.id) || 0;
      const metrics = calculateDailyMetrics(realization, targetObj.dailyTarget);

      ulpRows.push({
        ulpId: ulp.id,
        ulpCode: ulp.code,
        ulpName: ulp.name,
        up3Id: up3.id,
        up3Name: up3.name,
        dailyTarget: targetObj.dailyTarget,
        dailyRealization: realization,
        dailyPercentage: metrics.dailyPercentage,
        status: metrics.status,
      });

      subtotalTarget += targetObj.dailyTarget;
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
 * Generates H-1 Report (replicates LAPORAN HARIAN H-1)
 */
export async function getH1Report(currentDate: Date, up3IdFilter?: string) {
  const h1Date = new Date(currentDate);
  h1Date.setDate(h1Date.getDate() - 1);
  return getDailyReport(h1Date, up3IdFilter);
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
      const targetObj = targetMap.get(ulp.id) || { dailyTarget: 50.0, cumulativeTarget: 1100.0 };
      const dRealization = dailyMap.get(ulp.id) || 0;
      const cRealization = cumulativeMap.get(ulp.id) || 0;
      const metrics = calculateCumulativeMetrics(cRealization, targetObj.cumulativeTarget);

      ulpRows.push({
        ulpId: ulp.id,
        ulpCode: ulp.code,
        ulpName: ulp.name,
        up3Id: up3.id,
        up3Name: up3.name,
        dailyTarget: targetObj.dailyTarget,
        cumulativeTarget: targetObj.cumulativeTarget,
        dailyRealization: dRealization,
        cumulativeRealization: cRealization,
        cumulativePercentage: metrics.cumulativePercentage,
        status: metrics.status,
      });

      subDailyTarget += targetObj.dailyTarget;
      subCumulativeTarget += targetObj.cumulativeTarget;
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
 * Returns Pacing Curve Data (Actual Cumulative vs Linear Target Cumulative across days)
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

  // Fetch cumulative target for the unit(s)
  const targetRecords = await prisma.targetMaster.findMany({
    where: {
      ulpId: ulpIdFilter ? ulpIdFilter : undefined,
    },
    orderBy: { targetDate: "desc" },
    include: {
      ulp: true,
    },
  });

  let totalCumulativeTarget = 0;
  const countedUlps = new Set<string>();

  for (const t of targetRecords) {
    if (up3IdFilter && t.ulp.up3Id !== up3IdFilter) continue;
    if (!countedUlps.has(t.ulpId)) {
      totalCumulativeTarget += t.cumulativeTarget;
      countedUlps.add(t.ulpId);
    }
  }

  if (totalCumulativeTarget === 0) {
    totalCumulativeTarget = 24 * 1100; // Default fallback for 24 ULPs
  }

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

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const targetLinear = Math.round((totalCumulativeTarget / totalDaysInMonth) * day);
    const dayRealization = dayRealizationMap.get(day) || 0;
    runningActual += dayRealization;

    points.push({
      day,
      dateLabel: `${day} ${new Date(year, month - 1, day).toLocaleString("id-ID", { month: "short" })}`,
      targetCumulative: targetLinear,
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
