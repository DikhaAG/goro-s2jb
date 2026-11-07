import ExcelJS from "exceljs";
import { getDailyReport, getMonthlyReport } from "@/server/services/reportService";

/**
 * Generates an Excel workbook conforming 100% to PLN UID S2JB official reference standards.
 * Features authentic formulas, exact column alignments, and signature header palettes:
 * - LAPORAN HARIAN (Header Cyan #00FFFF, columns B to G)
 * - LAPORAN BULANAN (Header Peach #F6B26B, columns A to H)
 * Note: Laporan H-1 has been removed per executive directive.
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

  const [dailyData, monthlyData] = await Promise.all([
    getDailyReport(date, up3Id),
    getMonthlyReport(year, month, up3Id, date),
  ]);

  const monthNames = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
  ];
  const monthName = monthNames[month - 1];

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  const formattedDateStr = date.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ==========================================
  // SHEET 1: LAPORAN HARIAN
  // Columns: B=NO, C=NAMA ULP, D=TARGET HARIAN, E=REALISASI HARIAN, F=% HARIAN, G=KETERANGAN
  // Header Color: Cyan #00FFFF (FF00FFFF)
  // ==========================================
  const wsDaily = workbook.addWorksheet("LAPORAN HARIAN");
  wsDaily.views = [{ showGridLines: true }];

  // Row 1: Label
  wsDaily.getCell("C1").value = "harian";
  wsDaily.getCell("C1").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };

  // Row 2: Title
  wsDaily.mergeCells("B2:G2");
  const dTitle = wsDaily.getCell("B2");
  dTitle.value = "MONITORING REALISASI ENTRI RATING PADA APLIKASI GORO V 5.2.79";
  dTitle.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF0F172A" } };
  dTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsDaily.getRow(2).height = 24;

  // Row 3: UID Subtitle
  wsDaily.mergeCells("B3:G3");
  const dSubtitle = wsDaily.getCell("B3");
  dSubtitle.value = "UID SUMATERA SELATAN, JAMBI DAN BENGKULU";
  dSubtitle.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF1E3A8A" } };
  dSubtitle.alignment = { horizontal: "center", vertical: "middle" };
  wsDaily.getRow(3).height = 22;

  // Row 4: Period
  wsDaily.mergeCells("B4:G4");
  const dPeriod = wsDaily.getCell("B4");
  dPeriod.value = `BULAN ${monthName} ${year}`;
  dPeriod.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
  dPeriod.alignment = { horizontal: "center", vertical: "middle" };
  wsDaily.getRow(4).height = 20;

  // Row 5: Position Date
  wsDaily.mergeCells("B5:G5");
  const dDate = wsDaily.getCell("B5");
  dDate.value = `Posisi Tanggal: ${formattedDateStr}`;
  dDate.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
  dDate.alignment = { horizontal: "center", vertical: "middle" };
  wsDaily.getRow(5).height = 18;

  // Row 7: Header row (Cyan #00FFFF)
  const dailyHeaders = [
    { col: "B", label: "NO" },
    { col: "C", label: "NAMA ULP" },
    { col: "D", label: "TARGET HARIAN" },
    { col: "E", label: "REALISASI HARIAN" },
    { col: "F", label: "% HARIAN" },
    { col: "G", label: "KETERANGAN" },
  ];

  const hRowDaily = wsDaily.getRow(7);
  dailyHeaders.forEach((h) => {
    const cell = wsDaily.getCell(`${h.col}7`);
    cell.value = h.label;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00FFFF" }, // Authentic Cyan
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderStyle;
  });
  hRowDaily.height = 26;

  // Flatten all ULPs from dailyData
  const allDailyUlps = dailyData.groups.flatMap((g) => g.ulps);
  let dailyRowIdx = 9;
  const dailyStartRow = 9;

  allDailyUlps.forEach((ulp, idx) => {
    const r = wsDaily.getRow(dailyRowIdx);

    // Col B: NO
    const cB = r.getCell(2);
    cB.value = idx + 1;
    cB.alignment = { horizontal: "center" };

    // Col C: NAMA ULP
    const cC = r.getCell(3);
    cC.value = ulp.ulpName;

    // Col D: TARGET HARIAN
    const cD = r.getCell(4);
    cD.value = ulp.dailyTarget;
    cD.numFmt = "#,##0";
    cD.alignment = { horizontal: "right" };

    // Col E: REALISASI HARIAN
    const cE = r.getCell(5);
    cE.value = ulp.dailyRealization;
    cE.numFmt = "#,##0";
    cE.alignment = { horizontal: "right" };

    // Col F: % HARIAN (AUTHENTIC FORMULA: =E{row}/D{row})
    const cF = r.getCell(6);
    cF.value = { formula: `IFERROR(E${dailyRowIdx}/D${dailyRowIdx}, 0)` };
    cF.numFmt = "0.00%";
    cF.alignment = { horizontal: "right" };

    // Col G: KETERANGAN (AUTHENTIC FORMULA: =IF(F{row}>=1,"TERCAPAI","TIDAK TERCAPAI"))
    const cG = r.getCell(7);
    cG.value = { formula: `IF(F${dailyRowIdx}>=1, "TERCAPAI", "TIDAK TERCAPAI")` };
    cG.alignment = { horizontal: "center" };

    // Background color for status
    if (ulp.status === "TIDAK TERCAPAI") {
      cG.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF4C7C3" }, // Soft coral
      };
    }

    for (let c = 2; c <= 7; c++) {
      r.getCell(c).border = borderStyle;
      r.getCell(c).font = { name: "Arial", size: 9 };
    }
    r.height = 20;
    dailyRowIdx++;
  });

  const dailyEndRow = dailyRowIdx - 1;

  // Total Row for LAPORAN HARIAN
  const dTotRow = wsDaily.getRow(dailyRowIdx + 1);
  dTotRow.getCell(3).value = "TOTAL";
  dTotRow.getCell(3).font = { name: "Arial", size: 10, bold: true };

  dTotRow.getCell(4).value = { formula: `SUM(D${dailyStartRow}:D${dailyEndRow})` };
  dTotRow.getCell(4).numFmt = "#,##0";
  dTotRow.getCell(4).alignment = { horizontal: "right" };

  dTotRow.getCell(5).value = { formula: `SUM(E${dailyStartRow}:E${dailyEndRow})` };
  dTotRow.getCell(5).numFmt = "#,##0";
  dTotRow.getCell(5).alignment = { horizontal: "right" };

  const totDailyIdx = dailyRowIdx + 1;
  dTotRow.getCell(6).value = { formula: `IFERROR(E${totDailyIdx}/D${totDailyIdx}, 0)` };
  dTotRow.getCell(6).numFmt = "0.00%";
  dTotRow.getCell(6).alignment = { horizontal: "right" };

  dTotRow.getCell(7).value = { formula: `IF(F${totDailyIdx}>=1, "TERCAPAI", "TIDAK TERCAPAI")` };
  dTotRow.getCell(7).alignment = { horizontal: "center" };

  for (let c = 2; c <= 7; c++) {
    dTotRow.getCell(c).border = {
      top: { style: "thin", color: { argb: "FF0F172A" } },
      bottom: { style: "double", color: { argb: "FF0F172A" } },
    };
    dTotRow.getCell(c).font = { name: "Arial", size: 10, bold: true };
    dTotRow.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
  }
  dTotRow.height = 24;

  // Set column widths for LAPORAN HARIAN
  wsDaily.getColumn(1).width = 4;  // Col A (Blank spacer)
  wsDaily.getColumn(2).width = 6;  // Col B (NO)
  wsDaily.getColumn(3).width = 28; // Col C (NAMA ULP)
  wsDaily.getColumn(4).width = 16; // Col D (TARGET HARIAN)
  wsDaily.getColumn(5).width = 18; // Col E (REALISASI HARIAN)
  wsDaily.getColumn(6).width = 14; // Col F (% HARIAN)
  wsDaily.getColumn(7).width = 18; // Col G (KETERANGAN)

  // ==========================================
  // SHEET 2: LAPORAN BULANAN
  // Columns: A=NO, B=NAMA ULP, C=TARGET HARIAN, D=TARGET KUMULATIF, E=REALISASI HARIAN, F=REALISASI KUMULATIF, G=% KUMULATIF, H=KETERANGAN
  // Header Color: Peach #F6B26B (FFF6B26B)
  // ==========================================
  const wsMonthly = workbook.addWorksheet("LAPORAN BULANAN");
  wsMonthly.views = [{ showGridLines: true }];

  // Row 2: Title
  wsMonthly.mergeCells("A2:H2");
  const mTitle = wsMonthly.getCell("A2");
  mTitle.value = "MONITORING REALISASI ENTRI RATING PADA APLIKASI GORO V 5.2.79";
  mTitle.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF0F172A" } };
  mTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsMonthly.getRow(2).height = 24;

  // Row 3: UID Subtitle
  wsMonthly.mergeCells("A3:H3");
  const mSubtitle = wsMonthly.getCell("A3");
  mSubtitle.value = "UID SUMATERA SELATAN, JAMBI DAN BENGKULU";
  mSubtitle.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF1E3A8A" } };
  mSubtitle.alignment = { horizontal: "center", vertical: "middle" };
  wsMonthly.getRow(3).height = 22;

  // Row 4: Period
  wsMonthly.mergeCells("A4:H4");
  const mPeriod = wsMonthly.getCell("A4");
  mPeriod.value = `BULAN ${monthName} ${year}`;
  mPeriod.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
  mPeriod.alignment = { horizontal: "center", vertical: "middle" };
  wsMonthly.getRow(4).height = 20;

  // Row 5: Position Date
  wsMonthly.mergeCells("A5:H5");
  const mDate = wsMonthly.getCell("A5");
  mDate.value = `Posisi Tanggal: ${formattedDateStr}`;
  mDate.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
  mDate.alignment = { horizontal: "center", vertical: "middle" };
  wsMonthly.getRow(5).height = 18;

  // Row 7: Header row (Peach #F6B26B)
  const monthlyHeaders = [
    { col: "A", label: "NO" },
    { col: "B", label: "NAMA ULP" },
    { col: "C", label: "TARGET HARIAN" },
    { col: "D", label: "TARGET KUMULATIF" },
    { col: "E", label: "REALISASI HARIAN" },
    { col: "F", label: "REALISASI KUMULATIF" },
    { col: "G", label: "% KUMULATIF" },
    { col: "H", label: "KETERANGAN" },
  ];

  const hRowMonthly = wsMonthly.getRow(7);
  monthlyHeaders.forEach((h) => {
    const cell = wsMonthly.getCell(`${h.col}7`);
    cell.value = h.label;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF6B26B" }, // Authentic Peach
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderStyle;
  });
  hRowMonthly.height = 26;

  // Flatten all ULPs from monthlyData
  const allMonthlyUlps = monthlyData.groups.flatMap((g) => g.ulps);
  let monthlyRowIdx = 9;
  const monthlyStartRow = 9;

  allMonthlyUlps.forEach((ulp, idx) => {
    const r = wsMonthly.getRow(monthlyRowIdx);

    // Col A: NO
    const cA = r.getCell(1);
    cA.value = idx + 1;
    cA.alignment = { horizontal: "center" };

    // Col B: NAMA ULP
    const cB = r.getCell(2);
    cB.value = ulp.ulpName;

    // Col C: TARGET HARIAN
    const cC = r.getCell(3);
    cC.value = ulp.dailyTarget;
    cC.numFmt = "#,##0";
    cC.alignment = { horizontal: "right" };

    // Col D: TARGET KUMULATIF
    const cD = r.getCell(4);
    cD.value = ulp.cumulativeTarget;
    cD.numFmt = "#,##0";
    cD.alignment = { horizontal: "right" };

    // Col E: REALISASI HARIAN
    const cE = r.getCell(5);
    cE.value = ulp.dailyRealization;
    cE.numFmt = "#,##0";
    cE.alignment = { horizontal: "right" };

    // Col F: REALISASI KUMULATIF
    const cF = r.getCell(6);
    cF.value = ulp.cumulativeRealization;
    cF.numFmt = "#,##0";
    cF.alignment = { horizontal: "right" };

    // Col G: % KUMULATIF (AUTHENTIC FORMULA: =IFERROR(F{row}/D{row}, 0))
    const cG = r.getCell(7);
    cG.value = { formula: `IFERROR(F${monthlyRowIdx}/D${monthlyRowIdx}, 0)` };
    cG.numFmt = "0.00%";
    cG.alignment = { horizontal: "right" };

    // Col H: KETERANGAN (AUTHENTIC FORMULA: =IF(G{row}>=1,"TERCAPAI","TIDAK TERCAPAI"))
    const cH = r.getCell(8);
    cH.value = { formula: `IF(G${monthlyRowIdx}>=1, "TERCAPAI", "TIDAK TERCAPAI")` };
    cH.alignment = { horizontal: "center" };

    if (ulp.status === "TIDAK TERCAPAI") {
      cH.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF4C7C3" }, // Soft coral
      };
    }

    for (let c = 1; c <= 8; c++) {
      r.getCell(c).border = borderStyle;
      r.getCell(c).font = { name: "Arial", size: 9 };
    }
    r.height = 20;
    monthlyRowIdx++;
  });

  const monthlyEndRow = monthlyRowIdx - 1;

  // Total Row for LAPORAN BULANAN (Row matching E{row}: "TOTAL=", F{row}: =SUM(F...))
  const mTotRow = wsMonthly.getRow(monthlyRowIdx + 1);
  mTotRow.getCell(2).value = "TOTAL=";
  mTotRow.getCell(2).font = { name: "Arial", size: 10, bold: true };
  mTotRow.getCell(2).alignment = { horizontal: "right" };

  mTotRow.getCell(3).value = { formula: `SUM(C${monthlyStartRow}:C${monthlyEndRow})` };
  mTotRow.getCell(3).numFmt = "#,##0";
  mTotRow.getCell(3).alignment = { horizontal: "right" };

  mTotRow.getCell(4).value = { formula: `SUM(D${monthlyStartRow}:D${monthlyEndRow})` };
  mTotRow.getCell(4).numFmt = "#,##0";
  mTotRow.getCell(4).alignment = { horizontal: "right" };

  mTotRow.getCell(5).value = { formula: `SUM(E${monthlyStartRow}:E${monthlyEndRow})` };
  mTotRow.getCell(5).numFmt = "#,##0";
  mTotRow.getCell(5).alignment = { horizontal: "right" };

  mTotRow.getCell(6).value = { formula: `SUM(F${monthlyStartRow}:F${monthlyEndRow})` };
  mTotRow.getCell(6).numFmt = "#,##0";
  mTotRow.getCell(6).alignment = { horizontal: "right" };

  const totMonthlyIdx = monthlyRowIdx + 1;
  mTotRow.getCell(7).value = { formula: `IFERROR(F${totMonthlyIdx}/D${totMonthlyIdx}, 0)` };
  mTotRow.getCell(7).numFmt = "0.00%";
  mTotRow.getCell(7).alignment = { horizontal: "right" };

  mTotRow.getCell(8).value = { formula: `IF(G${totMonthlyIdx}>=1, "TERCAPAI", "TIDAK TERCAPAI")` };
  mTotRow.getCell(8).alignment = { horizontal: "center" };

  for (let c = 1; c <= 8; c++) {
    mTotRow.getCell(c).border = {
      top: { style: "thin", color: { argb: "FF0F172A" } },
      bottom: { style: "double", color: { argb: "FF0F172A" } },
    };
    mTotRow.getCell(c).font = { name: "Arial", size: 10, bold: true };
    mTotRow.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
  }
  mTotRow.height = 24;

  // Set column widths for LAPORAN BULANAN
  wsMonthly.getColumn(1).width = 6;  // Col A (NO)
  wsMonthly.getColumn(2).width = 28; // Col B (NAMA ULP)
  wsMonthly.getColumn(3).width = 16; // Col C (TARGET HARIAN)
  wsMonthly.getColumn(4).width = 18; // Col D (TARGET KUMULATIF)
  wsMonthly.getColumn(5).width = 18; // Col E (REALISASI HARIAN)
  wsMonthly.getColumn(6).width = 22; // Col F (REALISASI KUMULATIF)
  wsMonthly.getColumn(7).width = 14; // Col G (% KUMULATIF)
  wsMonthly.getColumn(8).width = 18; // Col H (KETERANGAN)

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
