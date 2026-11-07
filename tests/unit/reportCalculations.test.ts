import { describe, it, expect } from "vitest";
import {
  calculateDailyMetrics,
  calculateCumulativeMetrics,
  determineStatus,
  calculateDailyTargetForDate,
  calculateCumulativeTargetForMonth,
  DEFAULT_TARGET_CONFIG,
} from "@/server/services/reportService";

describe("Task 5: Report Service Metrics & Aggregation Calculation", () => {
  it("should accurately calculate daily percentage and status when target > 0", () => {
    // 50 realization on 50 target = 100% -> TERCAPAI
    const m1 = calculateDailyMetrics(50, 50);
    expect(m1.dailyPercentage).toBe(100.0);
    expect(m1.status).toBe("TERCAPAI");

    // 60 realization on 50 target = 120% -> TERCAPAI
    const m2 = calculateDailyMetrics(60, 50);
    expect(m2.dailyPercentage).toBe(120.0);
    expect(m2.status).toBe("TERCAPAI");

    // 35 realization on 50 target = 70% -> TIDAK TERCAPAI
    const m3 = calculateDailyMetrics(35, 50);
    expect(m3.dailyPercentage).toBe(70.0);
    expect(m3.status).toBe("TIDAK TERCAPAI");
  });

  it("should enforce Zero-Division Safeguard (AC-3): return 0.0% without error or NaN", () => {
    // Target 0 with Realization 0
    const m1 = calculateDailyMetrics(0, 0);
    expect(m1.dailyPercentage).toBe(0.0);
    expect(Number.isFinite(m1.dailyPercentage)).toBe(true);
    expect(m1.status).toBe("TIDAK TERCAPAI");

    // Target 0 with Realization > 0 (e.g. holiday entry or unbudgeted unit)
    const m2 = calculateDailyMetrics(5, 0);
    expect(m2.dailyPercentage).toBe(0.0);
    expect(Number.isFinite(m2.dailyPercentage)).toBe(true);
    expect(m2.status).toBe("TIDAK TERCAPAI");

    // Cumulative with Target 0
    const m3 = calculateCumulativeMetrics(10, 0);
    expect(m3.cumulativePercentage).toBe(0.0);
    expect(Number.isFinite(m3.cumulativePercentage)).toBe(true);
    expect(m3.status).toBe("TIDAK TERCAPAI");
  });

  it("should accurately calculate cumulative metrics across period", () => {
    // Cumulative 1150 realization on 1100 target = 104.5%
    const c1 = calculateCumulativeMetrics(1150, 1100);
    expect(c1.cumulativePercentage).toBe(104.5);
    expect(c1.status).toBe("TERCAPAI");

    // Cumulative 950 realization on 1100 target = 86.4%
    const c2 = calculateCumulativeMetrics(950, 1100);
    expect(c2.cumulativePercentage).toBe(86.4);
    expect(c2.status).toBe("TIDAK TERCAPAI");
  });

  it("should evaluate status boundary conditions correctly", () => {
    expect(determineStatus(100.0)).toBe("TERCAPAI");
    expect(determineStatus(99.99)).toBe("TIDAK TERCAPAI");
    expect(determineStatus(150.0)).toBe("TERCAPAI");
    expect(determineStatus(0.0)).toBe("TIDAK TERCAPAI");
  });

  it("should determine daily target by day of week: 50 on weekdays and 20 on weekends", () => {
    // 2026-08-03 is Monday (weekday)
    const monday = new Date("2026-08-03T00:00:00Z");
    expect(monday.getDay()).toBe(1);
    expect(calculateDailyTargetForDate(monday)).toBe(50);

    // 2026-08-07 is Friday (weekday)
    const friday = new Date("2026-08-07T00:00:00Z");
    expect(friday.getDay()).toBe(5);
    expect(calculateDailyTargetForDate(friday)).toBe(50);

    // 2026-08-08 is Saturday (weekend)
    const saturday = new Date("2026-08-08T00:00:00Z");
    expect(saturday.getDay()).toBe(6);
    expect(calculateDailyTargetForDate(saturday)).toBe(20);

    // 2026-08-09 is Sunday (weekend)
    const sunday = new Date("2026-08-09T00:00:00Z");
    expect(sunday.getDay()).toBe(0);
    expect(calculateDailyTargetForDate(sunday)).toBe(20);
  });

  it("should support custom target configuration", () => {
    const customConfig = { weekdayTarget: 75, weekendTarget: 30 };
    const monday = new Date("2026-08-03T00:00:00Z");
    const sunday = new Date("2026-08-09T00:00:00Z");

    expect(calculateDailyTargetForDate(monday, customConfig)).toBe(75);
    expect(calculateDailyTargetForDate(sunday, customConfig)).toBe(30);
  });

  it("should calculate cumulative monthly targets accurately with dynamic weekday/weekend steps", () => {
    // In August 2026:
    // Aug 1 is Saturday (20), Aug 2 is Sunday (20), Aug 3 is Monday (50)
    // Day 1: 20
    const day1Cum = calculateCumulativeTargetForMonth(2026, 8, 1);
    expect(day1Cum).toBe(20);

    // Day 2: 20 + 20 = 40
    const day2Cum = calculateCumulativeTargetForMonth(2026, 8, 2);
    expect(day2Cum).toBe(40);

    // Day 3: 40 + 50 = 90
    const day3Cum = calculateCumulativeTargetForMonth(2026, 8, 3);
    expect(day3Cum).toBe(90);
  });
});
