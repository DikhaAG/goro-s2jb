import ExcelJS from "exceljs";
import { getDailyReport, getH1Report, getMonthlyReport } from "@/server/services/reportService";

/**
 * Generates an Excel workbook conforming to PLN UID S2JB standards with authentic formulas.
 */
export async function generateExecutiveWorkbook(params: {
  date: Date;
  year: number;
  month: number;
  up3Id?: string;
}) {
  const { date, year, month, up3Id } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GORO S2JB 2026 Engine";
  workbook.created = new Date();

  const [dailyData, h1Data, monthlyData] = await Promise.all([
    getDailyReport(date, up3Id),
    getH1Report(date, up3Id),
    getMonthlyReport(year, month, up3Id, date),
  ]);

  const monthNames = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
  ];
  const monthName = monthNames[month - 1];

  // Helper for applying official header banner
  const applyHeaderBanner = (
    sheet: ExcelJS.Worksheet,
    sheetTitle: string,
    periodText: string,
    lastCol: string
  ) => {
    // Row 2: Main Title
    sheet.mergeCells(`A2:${lastCol}2`);
    const r2 = sheet.getCell("A2");
    r2.value = "MONITORING REALISASI ENTRI RATING PADA APLIKASI GORO V 5.2.79";
    r2.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };
    r2.alignment = { horizontal: "center", vertical: "middle" };

    // Row 3: Regional Subtitle
    sheet.mergeCells(`A3:${lastCol}3`);
    const r3 = sheet.getCell("A3");
    r3.value = "UID SUMATERA SELATAN, JAMBI DAN BENGKULU";
    r3.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF1E3A8A" } };
    r3.alignment = { horizontal: "center", vertical: "middle" };

    // Row 4: Period
    sheet.mergeCells(`A4:${lastCol}4`);
    const r4 = sheet.getCell("A4");
    r4.value = periodText;
    r4.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
    r4.alignment = { horizontal: "center", vertical: "middle" };

    // Row 5: As of Date
    sheet.mergeCells(`A5:${lastCol}5`);
    const r5 = sheet.getCell("A5");
    r5.value = `Tanggal Pembaruan: ${date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`;
    r5.font = { name: "Arial", size: 9, color: { argb: "FF64748B" } };
    r5.alignment = { horizontal: "center", vertical: "middle" };
  };

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  // ==========================================
  // SHEET 1: LAPORAN HARIAN
  // ==========================================
  const wsDaily = workbook.addWorksheet("LAPORAN HARIAN");
  wsDaily.views = [{ showGridLines: true }];
  applyHeaderBanner(wsDaily, "LAPORAN HARIAN", `BULAN ${monthName} ${year}`, "F");

  // Table Header (Row 7)
  const dailyHeaders = ["NO", "NAMA ULP", "TARGET HARIAN", "REALISASI HARIAN", "% HARIAN", "KETERANGAN"];
  const hRowDaily = wsDaily.getRow(7);
  dailyHeaders.forEach((h, idx) => {
    const cell = hRowDaily.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Corporate Navy Blue
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderStyle;
  });
  hRowDaily.height = 26;

  let dailyCurrentRow = 8;
  let dailyNumber = 1;

  for (const group of dailyData.groups) {
    // UP3 Group Header Row
    const up3Row = wsDaily.getRow(dailyCurrentRow);
    wsDaily.mergeCells(`A${dailyCurrentRow}:F${dailyCurrentRow}`);
    const up3Cell = up3Row.getCell(1);
    up3Cell.value = group.up3Name;
    up3Cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
    up3Cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    up3Cell.alignment = { vertical: "middle" };
    up3Row.height = 22;
    dailyCurrentRow++;

    const startRowIdx = dailyCurrentRow;

    for (const ulp of group.ulps) {
      const row = wsDaily.getRow(dailyCurrentRow);
      // Col 1: NO
      row.getCell(1).value = dailyNumber++;
      row.getCell(1).alignment = { horizontal: "center" };
      // Col 2: NAMA ULP
      row.getCell(2).value = ulp.ulpName;
      // Col 3: TARGET HARIAN (Numeric input)
      row.getCell(3).value = ulp.dailyTarget;
      row.getCell(3).numFmt = "#,##0";
      // Col 4: REALISASI HARIAN (Numeric input)
      row.getCell(4).value = ulp.dailyRealization;
      row.getCell(4).numFmt = "#,##0";
      // Col 5: % HARIAN (AUTHENTIC EXCEL FORMULA: =IFERROR(D{row}/C{row}, 0))
      row.getCell(5).value = { formula: `IFERROR(D${dailyCurrentRow}/C${dailyCurrentRow}, 0)` };
      row.getCell(5).numFmt = "0.0%";
      row.getCell(5).alignment = { horizontal: "right" };
      // Col 6: KETERANGAN (AUTHENTIC EXCEL FORMULA: =IF(E{row}>=1,"TERCAPAI","TIDAK TERCAPAI"))
      row.getCell(6).value = {
        formula: `IF(E${dailyCurrentRow}>=1, "TERCAPAI", "TIDAK TERCAPAI")`,
      };
      row.getCell(6).alignment = { horizontal: "center" };

      for (let c = 1; c <= 6; c++) {
        row.getCell(c).border = borderStyle;
        row.getCell(c).font = { name: "Arial", size: 9 };
      }
      dailyCurrentRow++;
    }

    const endRowIdx = dailyCurrentRow - 1;

    // UP3 Subtotal Row with Formulas
    const subRow = wsDaily.getRow(dailyCurrentRow);
    subRow.getCell(1).value = "";
    subRow.getCell(2).value = `SUBTOTAL ${group.up3Name}`;
    subRow.getCell(2).font = { name: "Arial", size: 9, bold: true };
    subRow.getCell(3).value = { formula: `SUM(C${startRowIdx}:C${endRowIdx})` };
    subRow.getCell(3).numFmt = "#,##0";
    subRow.getCell(4).value = { formula: `SUM(D${startRowIdx}:D${endRowIdx})` };
    subRow.getCell(4).numFmt = "#,##0";
    subRow.getCell(5).value = { formula: `IFERROR(D${dailyCurrentRow}/C${dailyCurrentRow}, 0)` };
    subRow.getCell(5).numFmt = "0.0%";
    subRow.getCell(6).value = {
      formula: `IF(E${dailyCurrentRow}>=1, "TERCAPAI", "TIDAK TERCAPAI")`,
    };
    subRow.getCell(6).alignment = { horizontal: "center" };

    for (let c = 1; c <= 6; c++) {
      subRow.getCell(c).border = borderStyle;
      subRow.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
      subRow.getCell(c).font = { name: "Arial", size: 9, bold: true };
    }
    dailyCurrentRow++;
  }

  // Grand Total UID Row with Formulas
  const totalRowDaily = wsDaily.getRow(dailyCurrentRow);
  totalRowDaily.getCell(1).value = "";
  totalRowDaily.getCell(2).value = "TOTAL UID S2JB";
  totalRowDaily.getCell(3).value = dailyData.grandTotal.dailyTarget;
  totalRowDaily.getCell(3).numFmt = "#,##0";
  totalRowDaily.getCell(4).value = dailyData.grandTotal.dailyRealization;
  totalRowDaily.getCell(4).numFmt = "#,##0";
  totalRowDaily.getCell(5).value = { formula: `IFERROR(D${dailyCurrentRow}/C${dailyCurrentRow}, 0)` };
  totalRowDaily.getCell(5).numFmt = "0.0%";
  totalRowDaily.getCell(6).value = {
    formula: `IF(E${dailyCurrentRow}>=1, "TERCAPAI", "TIDAK TERCAPAI")`,
  };
  totalRowDaily.getCell(6).alignment = { horizontal: "center" };

  for (let c = 1; c <= 6; c++) {
    totalRowDaily.getCell(c).border = {
      top: { style: "double", color: { argb: "FF0F172A" } },
      bottom: { style: "double", color: { argb: "FF0F172A" } },
    };
    totalRowDaily.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFCBD5E1" },
    };
    totalRowDaily.getCell(c).font = { name: "Arial", size: 10, bold: true };
  }

  // Set Column Widths for Daily
  wsDaily.getColumn(1).width = 6;
  wsDaily.getColumn(2).width = 28;
  wsDaily.getColumn(3).width = 18;
  wsDaily.getColumn(4).width = 20;
  wsDaily.getColumn(5).width = 14;
  wsDaily.getColumn(6).width = 18;

  // ==========================================
  // SHEET 2: LAPORAN HARIAN H-1
  // ==========================================
  const wsH1 = workbook.addWorksheet("LAPORAN HARIAN H-1");
  wsH1.views = [{ showGridLines: true }];
  const h1Date = new Date(date);
  h1Date.setDate(h1Date.getDate() - 1);
  applyHeaderBanner(
    wsH1,
    "LAPORAN HARIAN H-1",
    `BULAN ${monthName} ${year} (POSISI H-1: ${h1Date.toLocaleDateString("id-ID")})`,
    "F"
  );

  const hRowH1 = wsH1.getRow(7);
  dailyHeaders.forEach((h, idx) => {
    const cell = hRowH1.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderStyle;
  });
  hRowH1.height = 26;

  let h1CurrentRow = 8;
  let h1Number = 1;

  for (const group of h1Data.groups) {
    wsH1.mergeCells(`A${h1CurrentRow}:F${h1CurrentRow}`);
    const up3Cell = wsH1.getRow(h1CurrentRow).getCell(1);
    up3Cell.value = group.up3Name;
    up3Cell.font = { name: "Arial", size: 10, bold: true };
    up3Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    h1CurrentRow++;

    const startRowIdx = h1CurrentRow;

    for (const ulp of group.ulps) {
      const row = wsH1.getRow(h1CurrentRow);
      row.getCell(1).value = h1Number++;
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).value = ulp.ulpName;
      row.getCell(3).value = ulp.dailyTarget;
      row.getCell(3).numFmt = "#,##0";
      row.getCell(4).value = ulp.dailyRealization;
      row.getCell(4).numFmt = "#,##0";
      row.getCell(5).value = { formula: `IFERROR(D${h1CurrentRow}/C${h1CurrentRow}, 0)` };
      row.getCell(5).numFmt = "0.0%";
      row.getCell(6).value = { formula: `IF(E${h1CurrentRow}>=1, "TERCAPAI", "TIDAK TERCAPAI")` };
      row.getCell(6).alignment = { horizontal: "center" };

      for (let c = 1; c <= 6; c++) {
        row.getCell(c).border = borderStyle;
        row.getCell(c).font = { name: "Arial", size: 9 };
      }
      h1CurrentRow++;
    }

    const endRowIdx = h1CurrentRow - 1;
    const subRow = wsH1.getRow(h1CurrentRow);
    subRow.getCell(2).value = `SUBTOTAL ${group.up3Name}`;
    subRow.getCell(3).value = { formula: `SUM(C${startRowIdx}:C${endRowIdx})` };
    subRow.getCell(3).numFmt = "#,##0";
    subRow.getCell(4).value = { formula: `SUM(D${startRowIdx}:D${endRowIdx})` };
    subRow.getCell(4).numFmt = "#,##0";
    subRow.getCell(5).value = { formula: `IFERROR(D${h1CurrentRow}/C${h1CurrentRow}, 0)` };
    subRow.getCell(5).numFmt = "0.0%";
    subRow.getCell(6).value = { formula: `IF(E${h1CurrentRow}>=1, "TERCAPAI", "TIDAK TERCAPAI")` };
    subRow.getCell(6).alignment = { horizontal: "center" };

    for (let c = 1; c <= 6; c++) {
      subRow.getCell(c).border = borderStyle;
      subRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      subRow.getCell(c).font = { name: "Arial", size: 9, bold: true };
    }
    h1CurrentRow++;
  }

  // Set Column Widths for H1
  wsH1.getColumn(1).width = 6;
  wsH1.getColumn(2).width = 28;
  wsH1.getColumn(3).width = 18;
  wsH1.getColumn(4).width = 20;
  wsH1.getColumn(5).width = 14;
  wsH1.getColumn(6).width = 18;

  // ==========================================
  // SHEET 3: LAPORAN BULANAN
  // ==========================================
  const wsMonthly = workbook.addWorksheet("LAPORAN BULANAN");
  wsMonthly.views = [{ showGridLines: true }];
  applyHeaderBanner(
    wsMonthly,
    "LAPORAN BULANAN",
    `REKAPITULASI KUMULATIF BULAN ${monthName} ${year}`,
    "H"
  );

  const monthlyHeaders = [
    "NO",
    "NAMA ULP",
    "TARGET HARIAN",
    "TARGET KUMULATIF",
    "REALISASI HARIAN",
    "REALISASI KUMULATIF",
    "% KUMULATIF",
    "KETERANGAN",
  ];

  const hRowMonthly = wsMonthly.getRow(7);
  monthlyHeaders.forEach((h, idx) => {
    const cell = hRowMonthly.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderStyle;
  });
  hRowMonthly.height = 26;

  let monthlyCurrentRow = 8;
  let monthlyNumber = 1;

  for (const group of monthlyData.groups) {
    wsMonthly.mergeCells(`A${monthlyCurrentRow}:H${monthlyCurrentRow}`);
    const up3Cell = wsMonthly.getRow(monthlyCurrentRow).getCell(1);
    up3Cell.value = group.up3Name;
    up3Cell.font = { name: "Arial", size: 10, bold: true };
    up3Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    monthlyCurrentRow++;

    const startRowIdx = monthlyCurrentRow;

    for (const ulp of group.ulps) {
      const row = wsMonthly.getRow(monthlyCurrentRow);
      // Col 1: NO
      row.getCell(1).value = monthlyNumber++;
      row.getCell(1).alignment = { horizontal: "center" };
      // Col 2: NAMA ULP
      row.getCell(2).value = ulp.ulpName;
      // Col 3: TARGET HARIAN
      row.getCell(3).value = ulp.dailyTarget;
      row.getCell(3).numFmt = "#,##0";
      // Col 4: TARGET KUMULATIF
      row.getCell(4).value = ulp.cumulativeTarget;
      row.getCell(4).numFmt = "#,##0";
      // Col 5: REALISASI HARIAN
      row.getCell(5).value = ulp.dailyRealization;
      row.getCell(5).numFmt = "#,##0";
      // Col 6: REALISASI KUMULATIF
      row.getCell(6).value = ulp.cumulativeRealization;
      row.getCell(6).numFmt = "#,##0";
      // Col 7: % KUMULATIF (AUTHENTIC FORMULA: =IFERROR(F{row}/D{row}, 0))
      row.getCell(7).value = { formula: `IFERROR(F${monthlyCurrentRow}/D${monthlyCurrentRow}, 0)` };
      row.getCell(7).numFmt = "0.0%";
      row.getCell(7).alignment = { horizontal: "right" };
      // Col 8: KETERANGAN
      row.getCell(8).value = {
        formula: `IF(G${monthlyCurrentRow}>=1, "TERCAPAI", "TIDAK TERCAPAI")`,
      };
      row.getCell(8).alignment = { horizontal: "center" };

      for (let c = 1; c <= 8; c++) {
        row.getCell(c).border = borderStyle;
        row.getCell(c).font = { name: "Arial", size: 9 };
      }
      monthlyCurrentRow++;
    }

    const endRowIdx = monthlyCurrentRow - 1;
    const subRow = wsMonthly.getRow(monthlyCurrentRow);
    subRow.getCell(2).value = `SUBTOTAL ${group.up3Name}`;
    subRow.getCell(3).value = { formula: `SUM(C${startRowIdx}:C${endRowIdx})` };
    subRow.getCell(3).numFmt = "#,##0";
    subRow.getCell(4).value = { formula: `SUM(D${startRowIdx}:D${endRowIdx})` };
    subRow.getCell(4).numFmt = "#,##0";
    subRow.getCell(5).value = { formula: `SUM(E${startRowIdx}:E${endRowIdx})` };
    subRow.getCell(5).numFmt = "#,##0";
    subRow.getCell(6).value = { formula: `SUM(F${startRowIdx}:F${endRowIdx})` };
    subRow.getCell(6).numFmt = "#,##0";
    subRow.getCell(7).value = {
      formula: `IFERROR(F${monthlyCurrentRow}/D${monthlyCurrentRow}, 0)`,
    };
    subRow.getCell(7).numFmt = "0.0%";
    subRow.getCell(8).value = {
      formula: `IF(G${monthlyCurrentRow}>=1, "TERCAPAI", "TIDAK TERCAPAI")`,
    };
    subRow.getCell(8).alignment = { horizontal: "center" };

    for (let c = 1; c <= 8; c++) {
      subRow.getCell(c).border = borderStyle;
      subRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      subRow.getCell(c).font = { name: "Arial", size: 9, bold: true };
    }
    monthlyCurrentRow++;
  }

  // Set Column Widths for Monthly
  wsMonthly.getColumn(1).width = 6;
  wsMonthly.getColumn(2).width = 28;
  wsMonthly.getColumn(3).width = 16;
  wsMonthly.getColumn(4).width = 18;
  wsMonthly.getColumn(5).width = 18;
  wsMonthly.getColumn(6).width = 22;
  wsMonthly.getColumn(7).width = 14;
  wsMonthly.getColumn(8).width = 18;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
