"use client";

import React, { useMemo } from "react";
import { createColumnHelper, type Row } from "@tanstack/react-table";
import type { UlpMonthlyRow, Up3GroupMonthly } from "@/server/services/achievementReport";
import { Badge } from "@/components/ui/badge";
import {
  calcReportPercentage,
  calcReportStatus,
  getEffectiveFooterTotals,
  ReportDataTable,
  sumSubRowField,
  type ReportSummaryTotals,
} from "./ReportDataTable";

interface ReportTableMonthlyProps {
  groups: Up3GroupMonthly[];
  grandTotal: {
    dailyTarget: number;
    cumulativeTarget: number;
    dailyRealization: number;
    cumulativeRealization: number;
    cumulativePercentage: number;
    status: "TERCAPAI" | "TIDAK TERCAPAI";
  };
}

const columnHelper = createColumnHelper<UlpMonthlyRow>();

function computeFilteredMonthlyTotals(rows: Row<UlpMonthlyRow>[]): ReportSummaryTotals {
  const dailyTarget = sumSubRowField(rows, (r) => r.dailyTarget);
  const cumulativeTarget = sumSubRowField(rows, (r) => r.cumulativeTarget);
  const dailyRealization = sumSubRowField(rows, (r) => r.dailyRealization);
  const cumulativeRealization = sumSubRowField(rows, (r) => r.cumulativeRealization);
  return {
    dailyTarget,
    cumulativeTarget,
    dailyRealization,
    cumulativeRealization,
    percentage: calcReportPercentage(cumulativeRealization, cumulativeTarget),
    status: calcReportStatus(cumulativeRealization, cumulativeTarget),
  };
}

export function ReportTableMonthly({ groups, grandTotal }: ReportTableMonthlyProps) {
  const data = useMemo(() => groups.flatMap((group) => group.ulps), [groups]);

  const normalizedGrandTotal = useMemo<ReportSummaryTotals>(
    () => ({
      dailyTarget: grandTotal.dailyTarget,
      cumulativeTarget: grandTotal.cumulativeTarget,
      dailyRealization: grandTotal.dailyRealization,
      cumulativeRealization: grandTotal.cumulativeRealization,
      percentage: grandTotal.cumulativePercentage,
      status: grandTotal.status,
    }),
    [grandTotal]
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "no",
        header: "NO",
        enableSorting: false,
        enableHiding: false,
        meta: {
          align: "center",
          headerClassName: "w-12",
          label: "Nomor",
        },
        footer: () => null,
      }),

      columnHelper.accessor("up3Name", {
        id: "up3Name",
        header: "UP3",
        enableHiding: false,
        meta: {
          align: "left",
          label: "UP3",
        },
        cell: (info) => (
          <span className="font-medium text-[#475569]">{info.getValue()}</span>
        ),
        footer: () => null,
      }),

      columnHelper.accessor("ulpName", {
        id: "ulpName",
        header: "NAMA ULP",
        enableHiding: false,
        meta: {
          align: "left",
          label: "Nama ULP",
        },
        cell: (info) => (
          <span className="font-semibold text-[#0f172a]">{info.getValue()}</span>
        ),
        footer: ({ table }) => {
          const { label } = getEffectiveFooterTotals(table, computeFilteredMonthlyTotals);
          return (
            <span className="text-[#006877] font-bold uppercase tracking-wider">
              {label}
            </span>
          );
        },
      }),

      columnHelper.accessor("dailyTarget", {
        id: "dailyTarget",
        header: "TARGET HARIAN",
        aggregationFn: "sum",
        meta: {
          align: "right",
          headerClassName: "w-32",
          label: "Target Harian",
        },
        cell: (info) => (
          <span className="font-mono text-[#64748b]">
            {info.getValue().toLocaleString("id-ID")}
          </span>
        ),
        aggregatedCell: (info) => (
          <span className="font-mono text-[#475569]">
            {Number(info.getValue() ?? 0).toLocaleString("id-ID")}
          </span>
        ),
        footer: ({ table }) => {
          const { totals } = getEffectiveFooterTotals(table, computeFilteredMonthlyTotals);
          return (
            <span className="font-mono text-[#475569]">
              {totals.dailyTarget.toLocaleString("id-ID")}
            </span>
          );
        },
      }),

      columnHelper.accessor("cumulativeTarget", {
        id: "cumulativeTarget",
        header: "TARGET KUMULATIF",
        aggregationFn: "sum",
        meta: {
          align: "right",
          headerClassName: "w-36",
          label: "Target Kumulatif",
        },
        cell: (info) => (
          <span className="font-mono text-[#0f172a]">
            {info.getValue().toLocaleString("id-ID")}
          </span>
        ),
        aggregatedCell: (info) => (
          <span className="font-mono text-[#0f172a]">
            {Number(info.getValue() ?? 0).toLocaleString("id-ID")}
          </span>
        ),
        footer: ({ table }) => {
          const { totals } = getEffectiveFooterTotals(table, computeFilteredMonthlyTotals);
          return (
            <span className="font-mono text-[#0f172a]">
              {(totals.cumulativeTarget ?? 0).toLocaleString("id-ID")}
            </span>
          );
        },
      }),

      columnHelper.accessor("dailyRealization", {
        id: "dailyRealization",
        header: "REALISASI HARIAN",
        aggregationFn: "sum",
        meta: {
          align: "right",
          headerClassName: "w-32",
          label: "Realisasi Harian",
        },
        cell: (info) => (
          <span className="font-mono text-[#64748b]">
            {info.getValue().toLocaleString("id-ID")}
          </span>
        ),
        aggregatedCell: (info) => (
          <span className="font-mono text-[#475569]">
            {Number(info.getValue() ?? 0).toLocaleString("id-ID")}
          </span>
        ),
        footer: ({ table }) => {
          const { totals } = getEffectiveFooterTotals(table, computeFilteredMonthlyTotals);
          return (
            <span className="font-mono text-[#475569]">
              {totals.dailyRealization.toLocaleString("id-ID")}
            </span>
          );
        },
      }),

      columnHelper.accessor("cumulativeRealization", {
        id: "cumulativeRealization",
        header: "REALISASI KUMULATIF",
        aggregationFn: "sum",
        meta: {
          align: "right",
          headerClassName: "w-36",
          label: "Realisasi Kumulatif",
        },
        cell: (info) => (
          <span className="font-mono font-bold text-[#0f172a]">
            {info.getValue().toLocaleString("id-ID")}
          </span>
        ),
        aggregatedCell: (info) => (
          <span className="font-mono font-bold text-[#006877]">
            {Number(info.getValue() ?? 0).toLocaleString("id-ID")}
          </span>
        ),
        footer: ({ table }) => {
          const { totals } = getEffectiveFooterTotals(table, computeFilteredMonthlyTotals);
          return (
            <span className="font-mono font-bold text-sm text-[#006877]">
              {(totals.cumulativeRealization ?? 0).toLocaleString("id-ID")}
            </span>
          );
        },
      }),

      columnHelper.accessor("cumulativePercentage", {
        id: "cumulativePercentage",
        header: "% KUMULATIF",
        aggregationFn: (_columnId, leafRows) => {
          const realization = sumSubRowField(leafRows, (r) => r.cumulativeRealization);
          const target = sumSubRowField(leafRows, (r) => r.cumulativeTarget);
          return calcReportPercentage(realization, target);
        },
        meta: {
          align: "right",
          headerClassName: "w-28",
          label: "% Kumulatif",
        },
        cell: (info) => {
          const isPass = info.row.original.status === "TERCAPAI";
          return (
            <span className={`font-mono font-bold ${isPass ? "text-[#15803d]" : "text-[#b45309]"}`}>
              {info.getValue().toFixed(1)}%
            </span>
          );
        },
        aggregatedCell: ({ row }) => {
          const realization = sumSubRowField(row.subRows, (r) => r.cumulativeRealization);
          const target = sumSubRowField(row.subRows, (r) => r.cumulativeTarget);
          const pct = calcReportPercentage(realization, target);
          const status = calcReportStatus(realization, target);
          return (
            <span
              className={`font-mono font-bold ${
                status === "TERCAPAI" ? "text-[#15803d]" : "text-[#b45309]"
              }`}
            >
              {pct.toFixed(1)}%
            </span>
          );
        },
        footer: ({ table }) => {
          const { totals } = getEffectiveFooterTotals(table, computeFilteredMonthlyTotals);
          return (
            <span className="font-mono font-bold text-sm text-[#006877]">
              {totals.percentage.toFixed(1)}%
            </span>
          );
        },
      }),

      columnHelper.accessor("status", {
        id: "status",
        header: "KETERANGAN",
        filterFn: "equalsString",
        aggregationFn: (_columnId, leafRows) => {
          const realization = sumSubRowField(leafRows, (r) => r.cumulativeRealization);
          const target = sumSubRowField(leafRows, (r) => r.cumulativeTarget);
          return calcReportStatus(realization, target);
        },
        meta: {
          align: "center",
          headerClassName: "w-36",
          label: "Keterangan",
        },
        cell: (info) => {
          const val = info.getValue();
          const isPass = val === "TERCAPAI";
          return (
            <Badge
              variant={isPass ? "success" : "warning"}
              className="text-[10px] py-0 px-2 uppercase font-semibold"
            >
              {val}
            </Badge>
          );
        },
        aggregatedCell: ({ row }) => {
          const realization = sumSubRowField(row.subRows, (r) => r.cumulativeRealization);
          const target = sumSubRowField(row.subRows, (r) => r.cumulativeTarget);
          const status = calcReportStatus(realization, target);
          return (
            <Badge
              variant={status === "TERCAPAI" ? "success" : "warning"}
              className="text-[10px] py-0 px-2 uppercase font-bold"
            >
              {status}
            </Badge>
          );
        },
        footer: ({ table }) => {
          const { totals } = getEffectiveFooterTotals(table, computeFilteredMonthlyTotals);
          return (
            <Badge
              variant={totals.status === "TERCAPAI" ? "success" : "warning"}
              className="text-xs font-bold"
            >
              {totals.status}
            </Badge>
          );
        },
      }),
    ],
    []
  );

  return (
    <ReportDataTable
      data={data}
      columns={columns}
      grandTotal={normalizedGrandTotal}
      tableLabel="Laporan Bulanan Kumulatif"
      getRowPercentage={(row) => row.cumulativePercentage}
      getGroupPercentage={(subRows) => {
        const realization = sumSubRowField(subRows, (r) => r.cumulativeRealization);
        const target = sumSubRowField(subRows, (r) => r.cumulativeTarget);
        return calcReportPercentage(realization, target);
      }}
      getGroupStatus={(subRows) => {
        const realization = sumSubRowField(subRows, (r) => r.cumulativeRealization);
        const target = sumSubRowField(subRows, (r) => r.cumulativeTarget);
        return calcReportStatus(realization, target);
      }}
      getMobileMetrics={(row) => [
        { label: "Target Harian", value: row.dailyTarget.toLocaleString("id-ID") },
        { label: "Realisasi Harian", value: row.dailyRealization.toLocaleString("id-ID") },
        { label: "Target Kumulatif", value: row.cumulativeTarget.toLocaleString("id-ID") },
        {
          label: "Realisasi Kumulatif",
          value: row.cumulativeRealization.toLocaleString("id-ID"),
          highlight: true,
        },
      ]}
      getMobileGroupMetrics={(subRows) => {
        const dailyTarget = sumSubRowField(subRows, (r) => r.dailyTarget);
        const dailyRealization = sumSubRowField(subRows, (r) => r.dailyRealization);
        const cumulativeTarget = sumSubRowField(subRows, (r) => r.cumulativeTarget);
        const cumulativeRealization = sumSubRowField(subRows, (r) => r.cumulativeRealization);
        return [
          { label: "Target Harian", value: dailyTarget.toLocaleString("id-ID") },
          { label: "Realisasi Harian", value: dailyRealization.toLocaleString("id-ID") },
          { label: "Target Kumulatif", value: cumulativeTarget.toLocaleString("id-ID") },
          {
            label: "Realisasi Kumulatif",
            value: cumulativeRealization.toLocaleString("id-ID"),
            highlight: true,
          },
        ];
      }}
      getFilteredTotals={computeFilteredMonthlyTotals}
      renderMobileFooterMetrics={(totals) => [
        { label: "Target Harian", value: totals.dailyTarget.toLocaleString("id-ID") },
        { label: "Realisasi Harian", value: totals.dailyRealization.toLocaleString("id-ID") },
        {
          label: "Target Kumulatif",
          value: (totals.cumulativeTarget ?? 0).toLocaleString("id-ID"),
        },
        {
          label: "Realisasi Kumulatif",
          value: (totals.cumulativeRealization ?? 0).toLocaleString("id-ID"),
        },
      ]}
    />
  );
}
