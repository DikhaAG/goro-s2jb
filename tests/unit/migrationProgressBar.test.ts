import { describe, it, expect } from "vitest";

export function computeMigrationProgress(processed: number, total?: number | null): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((processed / total) * 100)));
}

export function computeMigrationThroughput(
  currentProcessed: number,
  previousProcessed: number,
  deltaTimeMs: number
): number {
  if (deltaTimeMs < 1000) return 0;
  const deltaRows = currentProcessed - previousProcessed;
  if (deltaRows <= 0) return 0;
  return Math.round(deltaRows / (deltaTimeMs / 1000));
}

export function buildProgressBarAria(progressPercentage: number, isIndeterminate: boolean) {
  return {
    role: "progressbar",
    "aria-valuenow": isIndeterminate ? undefined : progressPercentage,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-live": "polite" as const,
  };
}

describe("Migration Progress Bar & Throughput Metrics (Unit)", () => {
  describe("1. computeMigrationProgress", () => {
    it("should return 0 when total is null, undefined, or zero", () => {
      expect(computeMigrationProgress(500, null)).toBe(0);
      expect(computeMigrationProgress(500, undefined)).toBe(0);
      expect(computeMigrationProgress(500, 0)).toBe(0);
    });

    it("should calculate correct percentage for standard batches", () => {
      expect(computeMigrationProgress(25, 100)).toBe(25);
      expect(computeMigrationProgress(50, 200)).toBe(25);
      expect(computeMigrationProgress(71606, 143212)).toBe(50);
      expect(computeMigrationProgress(143212, 143212)).toBe(100);
    });

    it("should cap at 100 even if processed exceeds total", () => {
      expect(computeMigrationProgress(150, 100)).toBe(100);
    });
  });

  describe("2. computeMigrationThroughput", () => {
    it("should return 0 if delta time is less than 1 second", () => {
      expect(computeMigrationThroughput(2000, 1000, 800)).toBe(0);
    });

    it("should return 0 if delta rows is zero or negative", () => {
      expect(computeMigrationThroughput(1000, 1000, 2000)).toBe(0);
      expect(computeMigrationThroughput(500, 1000, 2000)).toBe(0);
    });

    it("should calculate correct rows per second for valid intervals", () => {
      // 5,000 rows in 2 seconds = 2,500 rows/sec
      expect(computeMigrationThroughput(7000, 2000, 2000)).toBe(2500);

      // 10,000 rows in 5 seconds = 2,000 rows/sec
      expect(computeMigrationThroughput(10000, 0, 5000)).toBe(2000);
    });
  });

  describe("3. buildProgressBarAria Accessibility Contract", () => {
    it("should generate compliant ARIA attributes in determinate mode", () => {
      const aria = buildProgressBarAria(75, false);
      expect(aria.role).toBe("progressbar");
      expect(aria["aria-valuenow"]).toBe(75);
      expect(aria["aria-valuemin"]).toBe(0);
      expect(aria["aria-valuemax"]).toBe(100);
      expect(aria["aria-live"]).toBe("polite");
    });

    it("should omit aria-valuenow in indeterminate streaming mode", () => {
      const aria = buildProgressBarAria(0, true);
      expect(aria.role).toBe("progressbar");
      expect(aria["aria-valuenow"]).toBeUndefined();
      expect(aria["aria-live"]).toBe("polite");
    });
  });
});
