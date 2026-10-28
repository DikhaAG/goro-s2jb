import { describe, it, expect, beforeAll, afterAll } from "vitest";
import ExcelJS from "exceljs";
import { generateExecutiveWorkbook } from "@/lib/export/excelExporter";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

describe("Task 5: Excel Exporter Architecture & Formula Verification", () => {
  let excelBuffer: Buffer;
  let workbook: ExcelJS.Workbook;

  beforeAll(async () => {
    const testDate = new Date();
    excelBuffer = await generateExecutiveWorkbook({
      date: testDate,
      year: testDate.getFullYear(),
      month: testDate.getMonth() + 1,
    });

    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer as any);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  it("should generate a valid uncorrupted Excel workbook with 3 official report sheets", () => {
    expect(excelBuffer).toBeDefined();
    expect(excelBuffer.length).toBeGreaterThan(1000);

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toContain("LAPORAN HARIAN");
    expect(sheetNames).toContain("LAPORAN HARIAN H-1");
    expect(sheetNames).toContain("LAPORAN BULANAN");
  });

  it("should format LAPORAN HARIAN with authentic Excel formulas (=IFERROR, =IF) and 0.0% format", () => {
    const ws = workbook.getWorksheet("LAPORAN HARIAN");
    expect(ws).toBeDefined();

    // Verify official header title
    const titleCell = ws?.getCell("A2");
    expect(titleCell?.value).toContain("MONITORING REALISASI ENTRI RATING");

    // Verify table header row
    const headerRow = ws?.getRow(7);
    expect(headerRow?.getCell(2).value).toBe("NAMA ULP");
    expect(headerRow?.getCell(3).value).toBe("TARGET HARIAN");
    expect(headerRow?.getCell(4).value).toBe("REALISASI HARIAN");
    expect(headerRow?.getCell(5).value).toBe("% HARIAN");
    expect(headerRow?.getCell(6).value).toBe("KETERANGAN");

    // Find first data row (row 9, under group header row 8)
    const dataRow = ws?.getRow(9);
    expect(dataRow).toBeDefined();

    // Percentage cell must contain a formula object, NOT a hardcoded number
    const pctCell = dataRow?.getCell(5);
    expect(typeof pctCell?.value).toBe("object");
    const formulaVal = (pctCell?.value as any)?.formula;
    expect(formulaVal).toContain("IFERROR(D9/C9");
    expect(pctCell?.numFmt).toBe("0.0%");

    // Status cell must contain formula
    const statusCell = dataRow?.getCell(6);
    expect(typeof statusCell?.value).toBe("object");
    const statusFormula = (statusCell?.value as any)?.formula;
    expect(statusFormula).toContain('IF(E9>=1, "TERCAPAI", "TIDAK TERCAPAI")');
  });

  it("should format LAPORAN BULANAN with cumulative targets, cumulative formulas, and 0.0% format", () => {
    const ws = workbook.getWorksheet("LAPORAN BULANAN");
    expect(ws).toBeDefined();

    const headerRow = ws?.getRow(7);
    expect(headerRow?.getCell(4).value).toBe("TARGET KUMULATIF");
    expect(headerRow?.getCell(6).value).toBe("REALISASI KUMULATIF");
    expect(headerRow?.getCell(7).value).toBe("% KUMULATIF");

    const dataRow = ws?.getRow(9);
    const cumPctCell = dataRow?.getCell(7);
    expect(typeof cumPctCell?.value).toBe("object");
    const formula = (cumPctCell?.value as any)?.formula;
    expect(formula).toContain("IFERROR(F9/D9");
    expect(cumPctCell?.numFmt).toBe("0.0%");
  });
});
