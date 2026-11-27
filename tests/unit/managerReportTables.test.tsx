import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportTableMonthly } from "@/components/manager/ReportTableMonthly";
import { ReportTableDaily } from "@/components/manager/ReportTableDaily";
import {
  calcReportPercentage,
  calcReportStatus,
} from "@/components/manager/ReportDataTable";
import type { Up3GroupDaily, Up3GroupMonthly } from "@/server/services/achievementReport";

const monthlyGroups: Up3GroupMonthly[] = [
  {
    up3Id: "up3-plg",
    up3Code: "11",
    up3Name: "UP3 PALEMBANG",
    ulps: [
      {
        ulpId: "ulp-sk",
        ulpCode: "111",
        ulpName: "ULP SUKARAMI",
        up3Id: "up3-plg",
        up3Name: "UP3 PALEMBANG",
        dailyTarget: 50,
        cumulativeTarget: 1000,
        dailyRealization: 55,
        cumulativeRealization: 999, // 99.9% -> TIDAK TERCAPAI
        cumulativePercentage: 99.9,
        status: "TIDAK TERCAPAI",
      },
      {
        ulpId: "ulp-kt",
        ulpCode: "112",
        ulpName: "ULP KENTEN",
        up3Id: "up3-plg",
        up3Name: "UP3 PALEMBANG",
        dailyTarget: 50,
        cumulativeTarget: 1000,
        dailyRealization: 60,
        cumulativeRealization: 1101,
        cumulativePercentage: 110.1,
        status: "TERCAPAI",
      },
    ],
    subtotal: {
      dailyTarget: 100,
      cumulativeTarget: 2000,
      dailyRealization: 115,
      cumulativeRealization: 2100,
      cumulativePercentage: 105.0,
      status: "TERCAPAI",
    },
  },
];

const monthlyGrandTotal = {
  dailyTarget: 100,
  cumulativeTarget: 2000,
  dailyRealization: 115,
  cumulativeRealization: 2100,
  cumulativePercentage: 105.0,
  status: "TERCAPAI" as const,
};

const dailyGroups: Up3GroupDaily[] = [
  {
    up3Id: "up3-lht",
    up3Code: "12",
    up3Name: "UP3 LAHAT",
    ulps: [
      {
        ulpId: "ulp-prb",
        ulpCode: "121",
        ulpName: "ULP PRABUMULIH",
        up3Id: "up3-lht",
        up3Name: "UP3 LAHAT",
        dailyTarget: 50,
        dailyRealization: 40,
        dailyPercentage: 80.0,
        status: "TIDAK TERCAPAI",
      },
    ],
    subtotal: {
      dailyTarget: 50,
      dailyRealization: 40,
      dailyPercentage: 80.0,
      status: "TIDAK TERCAPAI",
    },
  },
];

const dailyGrandTotal = {
  dailyTarget: 50,
  dailyRealization: 40,
  dailyPercentage: 80.0,
  status: "TIDAK TERCAPAI" as const,
};

describe("Manager TanStack Report Tables", () => {
  it("computes unrounded achievement status and percentage accurately", () => {
    // 1999 / 2000 = 99.95% -> rounds display to 100.0% but status remains TIDAK TERCAPAI
    expect(calcReportPercentage(1999, 2000)).toBe(100);
    expect(calcReportStatus(1999, 2000)).toBe("TIDAK TERCAPAI");
    expect(calcReportStatus(2000, 2000)).toBe("TERCAPAI");
    expect(calcReportPercentage(10, 0)).toBe(0);
    expect(calcReportStatus(10, 0)).toBe("TIDAK TERCAPAI");
  });

  it("renders ReportTableMonthly with UP3 grouping, aggregated subtotal, footer grand total, and responsive views", () => {
    const html = renderToStaticMarkup(
      <ReportTableMonthly groups={monthlyGroups} grandTotal={monthlyGrandTotal} />
    );

    expect(html).toContain("UP3 PALEMBANG");
    expect(html).toContain("2 ULP");
    expect(html).toContain("ULP SUKARAMI");
    expect(html).toContain("ULP KENTEN");
    expect(html).toContain("TOTAL UID S2JB");
    expect(html).toContain("105.0%");
    expect(html).toContain("Grup UP3");
    expect(html).toContain("Peringkat ULP");
    expect(html).toContain("Semua (2)");
    expect(html).toContain("Tercapai (1)");
    expect(html).toContain("Tidak Tercapai (1)");
    expect(html).toContain("hidden md:block");
    expect(html).toContain("md:hidden");
    expect(html).not.toContain("🏢");
    expect(html).not.toContain("—");
  });

  it("renders ReportTableDaily with UP3 grouping, daily metrics, and footer grand total", () => {
    const html = renderToStaticMarkup(
      <ReportTableDaily groups={dailyGroups} grandTotal={dailyGrandTotal} />
    );

    expect(html).toContain("UP3 LAHAT");
    expect(html).toContain("1 ULP");
    expect(html).toContain("ULP PRABUMULIH");
    expect(html).toContain("80.0%");
    expect(html).toContain("TIDAK TERCAPAI");
    expect(html).toContain("TOTAL UID S2JB");
    expect(html).not.toContain("🏢");
    expect(html).not.toContain("—");
  });

  it("renders an explicit empty state when groups are empty", () => {
    const html = renderToStaticMarkup(
      <ReportTableMonthly
        groups={[]}
        grandTotal={{
          dailyTarget: 0,
          cumulativeTarget: 0,
          dailyRealization: 0,
          cumulativeRealization: 0,
          cumulativePercentage: 0,
          status: "TIDAK TERCAPAI",
        }}
      />
    );

    expect(html).toContain("Belum ada unit ULP untuk filter UP3 yang dipilih.");
  });
});
