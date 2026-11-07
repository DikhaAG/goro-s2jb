import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import { generateExecutiveWorkbook } from "@/lib/export/excelExporter";
import {
  getTargetConfig,
  saveTargetConfig,
  DEFAULT_TARGET_CONFIG,
} from "@/server/services/reportService";

describe("Executive Report Excel Export & Configurable Target Specifications", () => {
  it("should have default target configuration of 50 for weekdays and 20 for weekends", async () => {
    const config = await getTargetConfig();
    expect(config.weekdayTarget).toBe(50);
    expect(config.weekendTarget).toBe(20);
  });

  it("should allow updating target configuration dynamically", async () => {
    const updated = await saveTargetConfig({
      weekdayTarget: 60,
      weekendTarget: 25,
    });
    expect(updated.weekdayTarget).toBe(60);
    expect(updated.weekendTarget).toBe(25);

    // Reset back to baseline default
    const reset = await saveTargetConfig({
      weekdayTarget: DEFAULT_TARGET_CONFIG.weekdayTarget,
      weekendTarget: DEFAULT_TARGET_CONFIG.weekendTarget,
    });
    expect(reset.weekdayTarget).toBe(50);
    expect(reset.weekendTarget).toBe(20);
  });

  it("should generate authentic Excel workbook conforming strictly to official reference", async () => {
    const testDate = new Date("2026-08-05T00:00:00Z"); // Wednesday (weekday)
    const buffer = await generateExecutiveWorkbook({
      date: testDate,
      year: 2026,
      month: 8,
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);

    // Load generated buffer into ExcelJS to verify structure
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    // 1. Verify sheet names: ONLY LAPORAN HARIAN & LAPORAN BULANAN (no H-1)
    const sheetNames = wb.worksheets.map((ws) => ws.name);
    expect(sheetNames).toContain("LAPORAN HARIAN");
    expect(sheetNames).toContain("LAPORAN BULANAN");
    expect(sheetNames).not.toContain("LAPORAN HARIAN H-1");
    expect(sheetNames.length).toBe(2);

    // 2. Verify LAPORAN HARIAN structure
    const wsDaily = wb.getWorksheet("LAPORAN HARIAN")!;
    expect(wsDaily.getCell("C1").value).toBe("harian");

    // Header at Row 7
    expect(wsDaily.getCell("B7").value).toBe("NO");
    expect(wsDaily.getCell("C7").value).toBe("NAMA ULP");
    expect(wsDaily.getCell("D7").value).toBe("TARGET HARIAN");
    expect(wsDaily.getCell("E7").value).toBe("REALISASI HARIAN");
    expect(wsDaily.getCell("F7").value).toBe("% HARIAN");
    expect(wsDaily.getCell("G7").value).toBe("KETERANGAN");

    // Header fill color must be Cyan FF00FFFF
    const dailyHeaderFill = wsDaily.getCell("B7").fill as any;
    expect(dailyHeaderFill?.fgColor?.argb).toBe("FF00FFFF");

    // 3. Verify LAPORAN BULANAN structure
    const wsMonthly = wb.getWorksheet("LAPORAN BULANAN")!;

    // Header at Row 7
    expect(wsMonthly.getCell("A7").value).toBe("NO");
    expect(wsMonthly.getCell("B7").value).toBe("NAMA ULP");
    expect(wsMonthly.getCell("C7").value).toBe("TARGET HARIAN");
    expect(wsMonthly.getCell("D7").value).toBe("TARGET KUMULATIF");
    expect(wsMonthly.getCell("E7").value).toBe("REALISASI HARIAN");
    expect(wsMonthly.getCell("F7").value).toBe("REALISASI KUMULATIF");
    expect(wsMonthly.getCell("G7").value).toBe("% KUMULATIF");
    expect(wsMonthly.getCell("H7").value).toBe("KETERANGAN");

    // Header fill color must be Peach FFF6B26B
    const monthlyHeaderFill = wsMonthly.getCell("A7").fill as any;
    expect(monthlyHeaderFill?.fgColor?.argb).toBe("FFF6B26B");
  });
});
