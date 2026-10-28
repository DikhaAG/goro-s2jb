import { getMonthlyReport, getDailyReport } from "@/server/services/reportService";

export async function generatePrintableHtmlReport(params: {
  date: Date;
  year: number;
  month: number;
  up3Id?: string;
}) {
  const { date, year, month, up3Id } = params;

  const [dailyData, monthlyData] = await Promise.all([
    getDailyReport(date, up3Id),
    getMonthlyReport(year, month, up3Id, date),
  ]);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const formattedDate = date.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Eksekutif GORO S2JB 2026 - ${formattedDate}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 0; line-height: 1.4; }
    .header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 14px; }
    .title { font-size: 14px; font-weight: bold; color: #0f172a; margin: 0; text-transform: uppercase; }
    .subtitle { font-size: 12px; font-weight: bold; color: #1e3a8a; margin: 2px 0; }
    .period { font-size: 10px; color: #475569; font-style: italic; margin-top: 2px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
    .summary-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; }
    .summary-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .summary-val { font-size: 16px; font-weight: bold; color: #0f172a; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px; }
    th { background: #1e3a8a; color: #ffffff; padding: 6px 8px; font-weight: bold; text-align: left; border: 1px solid #cbd5e1; }
    th.center, td.center { text-align: center; }
    th.right, td.right { text-align: right; }
    td { padding: 5px 8px; border: 1px solid #cbd5e1; }
    tr.group-row { background: #f1f5f9; font-weight: bold; }
    tr.subtotal-row { background: #e2e8f0; font-weight: bold; }
    tr.total-row { background: #cbd5e1; font-weight: bold; border-top: 2px solid #0f172a; }
    .badge-pass { color: #15803d; font-weight: bold; }
    .badge-fail { color: #b91c1c; font-weight: bold; }
    .footer { text-align: right; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 14px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background: #0f172a; color: white; padding: 10px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; border-radius: 6px;">
    <span>Pratinjau Dokumen Cetak Resmi Laporan Eksekutif</span>
    <button onclick="window.print()" style="background: #00a3e0; color: #000; border: none; padding: 6px 14px; font-weight: bold; border-radius: 4px; cursor: pointer;">Cetak / Simpan PDF</button>
  </div>

  <div class="header">
    <div class="title">MONITORING REALISASI ENTRI RATING PADA APLIKASI GORO V 5.2.79</div>
    <div class="subtitle">UID SUMATERA SELATAN, JAMBI DAN BENGKULU</div>
    <div class="period">Periode: Bulan ${monthNames[month - 1]} ${year} | Posisi: ${formattedDate}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Realisasi Harian UID</div>
      <div class="summary-val">${dailyData.grandTotal.dailyRealization.toLocaleString("id-ID")} / ${dailyData.grandTotal.dailyTarget.toLocaleString("id-ID")} (${dailyData.grandTotal.dailyPercentage.toFixed(1)}%)</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Realisasi Kumulatif UID</div>
      <div class="summary-val">${monthlyData.grandTotal.cumulativeRealization.toLocaleString("id-ID")} / ${monthlyData.grandTotal.cumulativeTarget.toLocaleString("id-ID")} (${monthlyData.grandTotal.cumulativePercentage.toFixed(1)}%)</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Status Capaian UID</div>
      <div class="summary-val" style="color: ${monthlyData.grandTotal.cumulativePercentage >= 100 ? '#15803d' : '#b91c1c'};">
        ${monthlyData.grandTotal.status}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width: 25px;">NO</th>
        <th>NAMA ULP</th>
        <th class="right" style="width: 75px;">TARGET HARIAN</th>
        <th class="right" style="width: 80px;">REALISASI HARIAN</th>
        <th class="right" style="width: 65px;">% HARIAN</th>
        <th class="right" style="width: 85px;">TARGET KUMULATIF</th>
        <th class="right" style="width: 90px;">REALISASI KUMULATIF</th>
        <th class="right" style="width: 70px;">% KUMULATIF</th>
        <th class="center" style="width: 95px;">KETERANGAN</th>
      </tr>
    </thead>
    <tbody>
      ${monthlyData.groups.map((group, gIdx) => {
        let rowsHtml = `<tr class="group-row"><td colspan="9">${group.up3Name}</td></tr>`;
        const dailyGroup = dailyData.groups.find(g => g.up3Id === group.up3Id);

        group.ulps.forEach((ulp, uIdx) => {
          const dailyUlp = dailyGroup?.ulps.find(u => u.ulpId === ulp.ulpId);
          const dTarget = dailyUlp?.dailyTarget || ulp.dailyTarget;
          const dReal = dailyUlp?.dailyRealization || 0;
          const dPct = dailyUlp?.dailyPercentage || 0;

          rowsHtml += `<tr>
            <td class="center">${uIdx + 1}</td>
            <td>${ulp.ulpName}</td>
            <td class="right">${dTarget.toLocaleString("id-ID")}</td>
            <td class="right">${dReal.toLocaleString("id-ID")}</td>
            <td class="right">${dPct.toFixed(1)}%</td>
            <td class="right">${ulp.cumulativeTarget.toLocaleString("id-ID")}</td>
            <td class="right">${ulp.cumulativeRealization.toLocaleString("id-ID")}</td>
            <td class="right">${ulp.cumulativePercentage.toFixed(1)}%</td>
            <td class="center ${ulp.status === "TERCAPAI" ? "badge-pass" : "badge-fail"}">${ulp.status}</td>
          </tr>`;
        });

        rowsHtml += `<tr class="subtotal-row">
          <td colspan="2">SUBTOTAL ${group.up3Name}</td>
          <td class="right">${dailyGroup?.subtotal.dailyTarget.toLocaleString("id-ID") || 0}</td>
          <td class="right">${dailyGroup?.subtotal.dailyRealization.toLocaleString("id-ID") || 0}</td>
          <td class="right">${dailyGroup?.subtotal.dailyPercentage.toFixed(1) || 0}%</td>
          <td class="right">${group.subtotal.cumulativeTarget.toLocaleString("id-ID")}</td>
          <td class="right">${group.subtotal.cumulativeRealization.toLocaleString("id-ID")}</td>
          <td class="right">${group.subtotal.cumulativePercentage.toFixed(1)}%</td>
          <td class="center ${group.subtotal.status === "TERCAPAI" ? "badge-pass" : "badge-fail"}">${group.subtotal.status}</td>
        </tr>`;

        return rowsHtml;
      }).join("")}
      <tr class="total-row">
        <td colspan="2">TOTAL UID S2JB</td>
        <td class="right">${dailyData.grandTotal.dailyTarget.toLocaleString("id-ID")}</td>
        <td class="right">${dailyData.grandTotal.dailyRealization.toLocaleString("id-ID")}</td>
        <td class="right">${dailyData.grandTotal.dailyPercentage.toFixed(1)}%</td>
        <td class="right">${monthlyData.grandTotal.cumulativeTarget.toLocaleString("id-ID")}</td>
        <td class="right">${monthlyData.grandTotal.cumulativeRealization.toLocaleString("id-ID")}</td>
        <td class="right">${monthlyData.grandTotal.cumulativePercentage.toFixed(1)}%</td>
        <td class="center ${monthlyData.grandTotal.status === "TERCAPAI" ? "badge-pass" : "badge-fail"}">${monthlyData.grandTotal.status}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    Dicetak secara otomatis oleh Sistem GORO S2JB pada ${new Date().toLocaleString("id-ID")} | Kerahasiaan Dokumen Internal PT PLN (Persero) UID S2JB
  </div>
</body>
</html>`;
}
