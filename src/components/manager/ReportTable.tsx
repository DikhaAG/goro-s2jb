"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type GroupingState,
  type Row,
  type RowData,
  type SortingState,
  type Table,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns3,
  Layers,
  ListFilter,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  achievementPercentage,
  achievementStatus,
  type AchievementStatus,
} from "@/lib/achievementMath";
import type { DailyReport, MonthlyReport } from "@/server/services/achievementReport";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "center" | "right";
    headerClassName?: string;
    cellClassName?: string;
    footerClassName?: string;
    hideable?: boolean;
    label?: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    grandTotal?: ReportTotals;
    hasActiveLocalFilter?: boolean;
    mode?: ReportMode;
  }
}

export type ReportTableMode = "daily" | "monthly";

type ReportTableProps =
  | { mode: "daily"; groups: DailyReport["groups"]; grandTotal: DailyReport["grandTotal"] }
  | { mode: "monthly"; groups: MonthlyReport["groups"]; grandTotal: MonthlyReport["grandTotal"] };

type FigureKey = "dailyTarget" | "dailyRealization" | "cumulativeTarget" | "cumulativeRealization";

/** One ULP row of either Laporan Harian or Laporan Bulanan; the daily rows carry no cumulative figures. */
type ReportRow = {
  ulpId: string;
  ulpCode: string;
  ulpName: string;
  up3Id: string;
  up3Name: string;
  status: AchievementStatus;
} & { dailyTarget: number; dailyRealization: number } & Partial<Record<"cumulativeTarget" | "cumulativeRealization", number>>;

type ReportTotals = Record<FigureKey, number> & { percentage: number; status: AchievementStatus };

/** How a figure column reads: muted context, the target the status is judged on, or the Realisasi being judged. */
type FigureTone = "muted" | "basis" | "realization";

interface FigureColumn {
  key: FigureKey;
  header: string;
  label: string;
  width: string;
  tone: FigureTone;
}

interface ReportMode {
  tableLabel: string;
  /** Table columns, left to right. */
  figures: FigureColumn[];
  /** Mobile cards pair the daily and cumulative figures, so their order differs from the table. */
  mobileFigures: FigureKey[];
  /** Percentage and status are judged on this pair. */
  realization: FigureKey;
  target: FigureKey;
  percentageHeader: string;
  percentageLabel: string;
}

const MODES: Record<ReportTableMode, ReportMode> = {
  daily: {
    tableLabel: "Laporan Harian",
    figures: [
      { key: "dailyTarget", header: "TARGET HARIAN", label: "Target Harian", width: "w-36", tone: "muted" },
      { key: "dailyRealization", header: "REALISASI HARIAN", label: "Realisasi Harian", width: "w-36", tone: "realization" },
    ],
    mobileFigures: ["dailyTarget", "dailyRealization"],
    realization: "dailyRealization",
    target: "dailyTarget",
    percentageHeader: "% HARIAN",
    percentageLabel: "% Harian",
  },
  monthly: {
    tableLabel: "Laporan Bulanan Kumulatif",
    figures: [
      { key: "dailyTarget", header: "TARGET HARIAN", label: "Target Harian", width: "w-32", tone: "muted" },
      { key: "cumulativeTarget", header: "TARGET KUMULATIF", label: "Target Kumulatif", width: "w-36", tone: "basis" },
      { key: "dailyRealization", header: "REALISASI HARIAN", label: "Realisasi Harian", width: "w-32", tone: "muted" },
      { key: "cumulativeRealization", header: "REALISASI KUMULATIF", label: "Realisasi Kumulatif", width: "w-36", tone: "realization" },
    ],
    mobileFigures: ["dailyTarget", "dailyRealization", "cumulativeTarget", "cumulativeRealization"],
    realization: "cumulativeRealization",
    target: "cumulativeTarget",
    percentageHeader: "% KUMULATIF",
    percentageLabel: "% Kumulatif",
  },
};

const TONE_CLASSES: Record<FigureTone, { cell: string; aggregated: string; footer: string }> = {
  muted: {
    cell: "font-mono text-[#64748b]",
    aggregated: "font-mono text-[#475569]",
    footer: "font-mono text-[#475569]",
  },
  basis: {
    cell: "font-mono text-[#0f172a]",
    aggregated: "font-mono text-[#0f172a]",
    footer: "font-mono text-[#0f172a]",
  },
  realization: {
    cell: "font-mono font-bold text-[#0f172a]",
    aggregated: "font-mono font-bold text-[#006877]",
    footer: "font-mono font-bold text-sm text-[#006877]",
  },
};

const FIGURE_KEYS: FigureKey[] = ["dailyTarget", "dailyRealization", "cumulativeTarget", "cumulativeRealization"];
const FOOTER_LABEL = "TOTAL UID S2JB";
const FILTERED_FOOTER_LABEL = "TOTAL HASIL FILTER";
const SEARCH_PLACEHOLDER = "Cari nama atau kode ULP / UP3...";

function toTotals(mode: ReportMode, figures: Partial<Record<FigureKey, number>>): ReportTotals {
  const sums = Object.fromEntries(FIGURE_KEYS.map((key) => [key, figures[key] ?? 0])) as Record<FigureKey, number>;
  return {
    ...sums,
    percentage: achievementPercentage(sums[mode.realization], sums[mode.target]),
    status: achievementStatus(sums[mode.realization], sums[mode.target]),
  };
}

function totalsOfRows(mode: ReportMode, rows: Row<ReportRow>[]): ReportTotals {
  const sums: Partial<Record<FigureKey, number>> = {};
  for (const row of rows) {
    for (const key of FIGURE_KEYS) sums[key] = (sums[key] ?? 0) + (row.original[key] ?? 0);
  }
  return toTotals(mode, sums);
}

function mobileMetrics(mode: ReportMode, totals: ReportTotals, highlightRealization: boolean) {
  return mode.mobileFigures.map((key) => ({
    label: mode.figures.find((f) => f.key === key)!.label,
    value: totals[key].toLocaleString("id-ID"),
    highlight: highlightRealization && key === mode.realization,
  }));
}

function footerTotals(table: Table<ReportRow>): { totals: ReportTotals; label: string } {
  const meta = table.options.meta!;
  if (meta.hasActiveLocalFilter) {
    return { totals: totalsOfRows(meta.mode!, table.getFilteredRowModel().flatRows), label: FILTERED_FOOTER_LABEL };
  }
  return { totals: meta.grandTotal!, label: FOOTER_LABEL };
}

function matchesReportQuery(row: Row<ReportRow>, _columnId: string, filterValue: unknown): boolean {
  const query = String(filterValue ?? "").trim().toLowerCase();
  if (!query) return true;
  const item = row.original;
  return (
    item.ulpName.toLowerCase().includes(query) ||
    item.ulpCode.toLowerCase().includes(query) ||
    item.up3Name.toLowerCase().includes(query)
  );
}

function StatusBadge({ status, className }: { status: AchievementStatus; className: string }) {
  return (
    <Badge variant={status === "TERCAPAI" ? "success" : "warning"} className={className}>
      {status}
    </Badge>
  );
}

function statusTextClass(status: AchievementStatus): string {
  return status === "TERCAPAI" ? "text-[#15803d]" : "text-[#b45309]";
}

const columnHelper = createColumnHelper<ReportRow>();

function buildColumns(mode: ReportMode): ColumnDef<ReportRow, any>[] {
  const rowPercentage = (row: ReportRow) =>
    achievementPercentage(row[mode.realization] ?? 0, row[mode.target] ?? 0);

  return [
    columnHelper.display({
      id: "no",
      header: "NO",
      enableSorting: false,
      enableHiding: false,
      meta: { align: "center", headerClassName: "w-12", label: "Nomor" },
      footer: () => null,
    }),
    columnHelper.accessor("up3Name", {
      id: "up3Name",
      header: "UP3",
      enableHiding: false,
      meta: { align: "left", label: "UP3" },
      cell: (info) => <span className="font-medium text-[#475569]">{info.getValue()}</span>,
      footer: () => null,
    }),
    columnHelper.accessor("ulpName", {
      id: "ulpName",
      header: "NAMA ULP",
      enableHiding: false,
      meta: { align: "left", label: "Nama ULP" },
      cell: (info) => <span className="font-semibold text-[#0f172a]">{info.getValue()}</span>,
      footer: ({ table }) => (
        <span className="text-[#006877] font-bold uppercase tracking-wider">{footerTotals(table).label}</span>
      ),
    }),
    ...mode.figures.map((figure) =>
      columnHelper.accessor((row) => row[figure.key] ?? 0, {
        id: figure.key,
        header: figure.header,
        aggregationFn: "sum",
        meta: { align: "right", headerClassName: figure.width, label: figure.label },
        cell: (info) => (
          <span className={TONE_CLASSES[figure.tone].cell}>{info.getValue().toLocaleString("id-ID")}</span>
        ),
        aggregatedCell: (info) => (
          <span className={TONE_CLASSES[figure.tone].aggregated}>
            {Number(info.getValue() ?? 0).toLocaleString("id-ID")}
          </span>
        ),
        footer: ({ table }) => (
          <span className={TONE_CLASSES[figure.tone].footer}>
            {footerTotals(table).totals[figure.key].toLocaleString("id-ID")}
          </span>
        ),
      })
    ),
    columnHelper.accessor(rowPercentage, {
      id: "percentage",
      header: mode.percentageHeader,
      aggregationFn: (_columnId, leafRows) => totalsOfRows(mode, leafRows).percentage,
      meta: { align: "right", headerClassName: "w-28", label: mode.percentageLabel },
      cell: (info) => (
        <span className={cn("font-mono font-bold", statusTextClass(info.row.original.status))}>
          {info.getValue().toFixed(1)}%
        </span>
      ),
      aggregatedCell: ({ row }) => {
        const { percentage, status } = totalsOfRows(mode, row.subRows);
        return <span className={cn("font-mono font-bold", statusTextClass(status))}>{percentage.toFixed(1)}%</span>;
      },
      footer: ({ table }) => (
        <span className="font-mono font-bold text-sm text-[#006877]">
          {footerTotals(table).totals.percentage.toFixed(1)}%
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: "KETERANGAN",
      filterFn: "equalsString",
      aggregationFn: (_columnId, leafRows) => totalsOfRows(mode, leafRows).status,
      meta: { align: "center", headerClassName: "w-36", label: "Keterangan" },
      cell: (info) => (
        <StatusBadge status={info.getValue()} className="text-[10px] py-0 px-2 uppercase font-semibold" />
      ),
      aggregatedCell: ({ row }) => (
        <StatusBadge
          status={totalsOfRows(mode, row.subRows).status}
          className="text-[10px] py-0 px-2 uppercase font-bold"
        />
      ),
      footer: ({ table }) => (
        <StatusBadge status={footerTotals(table).totals.status} className="text-xs font-bold" />
      ),
    }),
  ];
}

/** Laporan Harian or Laporan Bulanan as one grouped, filterable table; the mode picks the figures and the basis for status. */
export function ReportTable({ mode: modeKey, groups, grandTotal: serverGrandTotal }: ReportTableProps) {
  const mode = MODES[modeKey];
  const tableLabel = mode.tableLabel;
  const data = useMemo<ReportRow[]>(
    () => (groups as Array<{ ulps: ReportRow[] }>).flatMap((group) => group.ulps),
    [groups]
  );
  const grandTotal = useMemo(() => toTotals(mode, serverGrandTotal), [mode, serverGrandTotal]);
  const columns = useMemo(() => buildColumns(mode), [mode]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [grouping, setGrouping] = useState<GroupingState>(["up3Name"]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState<boolean>(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const isGrouped = grouping.length > 0;
  const statusFilter =
    (columnFilters.find((f) => f.id === "status")?.value as string | undefined) ?? "ALL";
  const hasActiveLocalFilter = globalFilter.trim().length > 0 || statusFilter !== "ALL";

  useEffect(() => {
    if (!isColumnMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setIsColumnMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsColumnMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isColumnMenuOpen]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      grouping,
      expanded,
      columnVisibility,
    },
    meta: {
      grandTotal,
      hasActiveLocalFilter,
      mode,
    },
    getRowId: (row) => row.ulpId,
    globalFilterFn: matchesReportQuery,
    groupedColumnMode: "remove",
    autoResetAll: false,
    autoResetExpanded: false,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const filteredLeafRows = table.getFilteredRowModel().flatRows;
  const activeTotals = useMemo(
    () => (hasActiveLocalFilter ? totalsOfRows(mode, filteredLeafRows) : grandTotal),
    [hasActiveLocalFilter, filteredLeafRows, mode, grandTotal]
  );

  // Count status facets across rows matching the current text search
  const statusCounts = useMemo(() => {
    const query = globalFilter.trim().toLowerCase();
    let achieved = 0;
    let missed = 0;
    for (const item of data) {
      if (
        query &&
        !item.ulpName.toLowerCase().includes(query) &&
        !item.ulpCode.toLowerCase().includes(query) &&
        !item.up3Name.toLowerCase().includes(query)
      ) {
        continue;
      }
      if (item.status === "TERCAPAI") achieved++;
      else missed++;
    }
    return {
      all: achieved + missed,
      achieved,
      missed,
    };
  }, [data, globalFilter]);

  // Pre-compute sequential leaf row numbers (1..N) for visible leaf rows
  const leafIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 1;
    for (const row of table.getRowModel().rows) {
      if (!row.getIsGrouped()) {
        map.set(row.id, idx++);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getRowModel().rows]);

  const setStatusFilter = (nextStatus: "ALL" | AchievementStatus) => {
    setColumnFilters((prev) => {
      const withoutStatus = prev.filter((f) => f.id !== "status");
      if (nextStatus === "ALL") return withoutStatus;
      return [...withoutStatus, { id: "status", value: nextStatus }];
    });
  };

  const handleToggleGroupingMode = (mode: "GROUPED" | "FLAT") => {
    if (mode === "GROUPED") {
      setGrouping(["up3Name"]);
      setExpanded(true);
    } else {
      setGrouping([]);
    }
  };

  const handleResetFilters = () => {
    setGlobalFilter("");
    setColumnFilters([]);
    setSorting([]);
  };

  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && column.id !== "up3Name");

  const renderedRows = table.getRowModel().rows;
  const isAllGroupsExpanded = table.getIsAllRowsExpanded();

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs overflow-hidden">
      {/* Table Command Toolbar */}
      <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden
            />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              aria-label={`Cari data di ${tableLabel}`}
              className="w-full bg-white border border-[#cbd5e1] text-[#0f172a] placeholder-[#64748b] text-xs rounded-xl pl-9 pr-9 min-h-[44px] sm:min-h-[38px] transition-all focus-utility-ring"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => setGlobalFilter("")}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] cursor-pointer focus-utility-ring"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grouping, Expand/Collapse, and Column Visibility Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Grouping Toggle */}
            <div
              className="inline-flex items-center p-0.5 rounded-xl bg-white border border-[#cbd5e1]"
              role="group"
              aria-label="Mode pengelompokan tabel"
            >
              <button
                type="button"
                onClick={() => handleToggleGroupingMode("GROUPED")}
                className={cn(
                  "min-h-[40px] sm:min-h-[34px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-utility-ring",
                  isGrouped
                    ? "bg-[#e7eeff] text-[#006877]"
                    : "text-[#475569] hover:text-[#0f172a]"
                )}
              >
                <Layers className="w-3.5 h-3.5" aria-hidden />
                <span>Grup UP3</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleGroupingMode("FLAT")}
                className={cn(
                  "min-h-[40px] sm:min-h-[34px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-utility-ring",
                  !isGrouped
                    ? "bg-[#e7eeff] text-[#006877]"
                    : "text-[#475569] hover:text-[#0f172a]"
                )}
              >
                <ListFilter className="w-3.5 h-3.5" aria-hidden />
                <span>Peringkat ULP</span>
              </button>
            </div>

            {/* Expand / Collapse All Groups */}
            {isGrouped && renderedRows.length > 0 && (
              <button
                type="button"
                onClick={() => table.toggleAllRowsExpanded(!isAllGroupsExpanded)}
                className="min-h-[44px] sm:min-h-[36px] px-3 rounded-xl bg-white border border-[#cbd5e1] text-xs font-semibold text-[#334155] hover:text-[#006877] hover:border-[#00a2b9] inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-utility-ring"
              >
                {isAllGroupsExpanded ? (
                  <>
                    <ChevronsDownUp className="w-3.5 h-3.5" aria-hidden />
                    <span>Tutup Semua Grup</span>
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="w-3.5 h-3.5" aria-hidden />
                    <span>Buka Semua Grup</span>
                  </>
                )}
              </button>
            )}

            {/* Column Visibility Picker (Desktop) */}
            {hideableColumns.length > 0 && (
              <div className="relative hidden md:block" ref={columnMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsColumnMenuOpen((prev) => !prev)}
                  aria-expanded={isColumnMenuOpen}
                  aria-haspopup="menu"
                  className="min-h-[36px] px-3 rounded-xl bg-white border border-[#cbd5e1] text-xs font-semibold text-[#334155] hover:text-[#006877] hover:border-[#00a2b9] inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-utility-ring"
                >
                  <Columns3 className="w-3.5 h-3.5" aria-hidden />
                  <span>Kolom</span>
                </button>
                {isColumnMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1.5 w-52 rounded-xl border border-[#e2e8f0] bg-white p-2 shadow-lg z-30 space-y-1"
                  >
                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                      Tampilkan Kolom
                    </div>
                    {hideableColumns.map((column) => (
                      <label
                        key={column.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#f8fafc] text-xs text-[#0f172a] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          onChange={column.getToggleVisibilityHandler()}
                          className="w-4 h-4 rounded border-[#cbd5e1] text-[#00a2b9] focus-utility-ring"
                        />
                        <span>{column.columnDef.meta?.label ?? column.id}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Filter Pills + Active Result Telemetry */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter status capaian">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer focus-utility-ring",
                statusFilter === "ALL"
                  ? "bg-[#006877] text-white border-[#006877]"
                  : "bg-white text-[#334155] border-[#cbd5e1] hover:bg-[#f1f5f9]"
              )}
            >
              Semua ({statusCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("TERCAPAI")}
              className={cn(
                "min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer focus-utility-ring",
                statusFilter === "TERCAPAI"
                  ? "bg-[#15803d] text-white border-[#15803d]"
                  : "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0] hover:bg-[#dcfce7]"
              )}
            >
              Tercapai ({statusCounts.achieved})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("TIDAK TERCAPAI")}
              className={cn(
                "min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer focus-utility-ring",
                statusFilter === "TIDAK TERCAPAI"
                  ? "bg-[#b45309] text-white border-[#b45309]"
                  : "bg-[#fff7ed] text-[#b45309] border-[#fed7aa] hover:bg-[#ffedd5]"
              )}
            >
              Tidak Tercapai ({statusCounts.missed})
            </button>

            {(hasActiveLocalFilter || sorting.length > 0) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-[#475569] hover:text-[#0f172a] hover:bg-[#e2e8f0]/60 inline-flex items-center gap-1 cursor-pointer focus-utility-ring"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="text-xs text-[#475569]">
            Menampilkan{" "}
            <span className="font-mono font-bold text-[#0f172a]">{filteredLeafRows.length}</span>{" "}
            dari{" "}
            <span className="font-mono font-bold text-[#0f172a]">{data.length}</span> ULP
          </div>
        </div>
      </div>

      {/* Empty State */}
      {renderedRows.length === 0 ? (
        <div className="py-12 px-6 text-center space-y-3">
          <p className="text-sm font-semibold text-[#0f172a]">
            {data.length === 0
              ? "Belum ada unit ULP untuk filter UP3 yang dipilih."
              : "Tidak ada unit ULP yang cocok dengan pencarian atau filter status saat ini."}
          </p>
          <p className="text-xs text-[#64748b]">
            {data.length === 0
              ? "Ubah pilihan Filter UP3 di atas untuk melihat unit lain."
              : "Hapus kata kunci pencarian atau pilih filter Semua untuk menampilkan seluruh ULP."}
          </p>
          {hasActiveLocalFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#006877] hover:bg-[#00525e] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer focus-utility-ring"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden />
              <span>Reset Filter Pencarian</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Data Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse font-sans">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569] font-bold uppercase tracking-wider text-[11px]"
                  >
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      const align = header.column.columnDef.meta?.align ?? "left";
                      const ariaSort =
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                          ? "descending"
                          : canSort
                          ? "none"
                          : undefined;

                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={ariaSort}
                          className={cn(
                            "py-3 px-3.5 border-r border-[#e2e8f0] last:border-r-0 whitespace-nowrap select-none",
                            align === "right" && "text-right",
                            align === "center" && "text-center",
                            header.column.columnDef.meta?.headerClassName
                          )}
                        >
                          {header.isPlaceholder ? null : canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className={cn(
                                "inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] hover:text-[#0f172a] transition-colors cursor-pointer rounded-md px-1 py-0.5 focus-utility-ring",
                                align === "right" && "flex-row-reverse",
                                sorted ? "text-[#006877]" : "text-[#475569]"
                              )}
                            >
                              <span>
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                              </span>
                              {sorted === "asc" ? (
                                <ArrowUp className="w-3.5 h-3.5 text-[#006877] shrink-0" aria-hidden />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="w-3.5 h-3.5 text-[#006877] shrink-0" aria-hidden />
                              ) : (
                                <ArrowUpDown className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" aria-hidden />
                              )}
                            </button>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>

              <tbody className="divide-y divide-[#f1f5f9]">
                {renderedRows.map((row) => {
                  if (row.getIsGrouped()) {
                    const groupExpanded = row.getIsExpanded();
                    const groupLabel = String(row.groupingValue ?? "");
                    const ulpCount = row.subRows.length;
                    const visibleCells = row.getVisibleCells();

                    return (
                      <tr
                        key={row.id}
                        className="bg-[#f1f5f9] hover:bg-[#e7eeff]/70 font-bold text-[#0f172a] border-y border-[#e2e8f0] transition-colors"
                      >
                        {visibleCells.map((cell) => {
                          const colId = cell.column.id;
                          const align = cell.column.columnDef.meta?.align ?? "left";

                          // First column (NO) stays blank on grouped subtotal row
                          if (colId === "no") {
                            return (
                              <td
                                key={cell.id}
                                className="py-2.5 px-3 text-center border-r border-[#e2e8f0]"
                              >
                                <button
                                  type="button"
                                  onClick={row.getToggleExpandedHandler()}
                                  aria-expanded={groupExpanded}
                                  aria-label={`${groupExpanded ? "Tutup" : "Buka"} grup ${groupLabel}`}
                                  className="w-7 h-7 rounded-lg bg-white border border-[#cbd5e1] text-[#006877] inline-flex items-center justify-center hover:border-[#00a2b9] cursor-pointer focus-utility-ring"
                                >
                                  {groupExpanded ? (
                                    <ChevronDown className="w-4 h-4" aria-hidden />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" aria-hidden />
                                  )}
                                </button>
                              </td>
                            );
                          }

                          // ULP Name column renders UP3 Group Header + ULP count
                          if (colId === "ulpName") {
                            return (
                              <td
                                key={cell.id}
                                className="py-2.5 px-4 border-r border-[#e2e8f0]"
                              >
                                <button
                                  type="button"
                                  onClick={row.getToggleExpandedHandler()}
                                  className="inline-flex items-center gap-2 text-left text-[#006877] hover:text-[#004e5a] cursor-pointer rounded-md focus-utility-ring"
                                >
                                  <Building2 className="w-4 h-4 shrink-0 text-[#006877]" aria-hidden />
                                  <span className="font-bold tracking-wide text-xs">
                                    {groupLabel}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-[11px] font-mono font-semibold text-[#334155]">
                                    {ulpCount} ULP
                                  </span>
                                </button>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={cell.id}
                              className={cn(
                                "py-2.5 px-4 border-r border-[#e2e8f0] last:border-r-0",
                                align === "right" && "text-right",
                                align === "center" && "text-center"
                              )}
                            >
                              {cell.getIsAggregated()
                                ? flexRender(
                                    cell.column.columnDef.aggregatedCell,
                                    cell.getContext()
                                  )
                                : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }

                  // Leaf ULP Row
                  const leafNumber = leafIndexMap.get(row.id) ?? row.index + 1;
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-[#f8fafc] transition-colors text-[#334155]"
                    >
                      {row.getVisibleCells().map((cell) => {
                        const align = cell.column.columnDef.meta?.align ?? "left";
                        if (cell.column.id === "no") {
                          return (
                            <td
                              key={cell.id}
                              className="py-2.5 px-3 text-center font-mono text-[#64748b] border-r border-[#f1f5f9]"
                            >
                              {leafNumber}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              "py-2.5 px-4 border-r border-[#f1f5f9] last:border-r-0",
                              align === "right" && "text-right",
                              align === "center" && "text-center",
                              cell.column.columnDef.meta?.cellClassName
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                {table.getFooterGroups().map((footerGroup) => (
                  <tr
                    key={footerGroup.id}
                    className="bg-[#e7eeff] font-bold text-[#0f172a] border-t-2 border-[#00a2b9] text-xs"
                  >
                    {footerGroup.headers.map((header) => {
                      const align = header.column.columnDef.meta?.align ?? "left";
                      return (
                        <td
                          key={header.id}
                          className={cn(
                            "py-3 px-4 border-r border-[#cbd5e1] last:border-r-0",
                            align === "right" && "text-right",
                            align === "center" && "text-center",
                            header.column.columnDef.meta?.footerClassName
                          )}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.footer,
                                header.getContext()
                              )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>

          {/* Mobile Responsive Card List */}
          <div className="md:hidden divide-y divide-[#e2e8f0]">
            {renderedRows.map((row) => {
              if (row.getIsGrouped()) {
                const groupExpanded = row.getIsExpanded();
                const groupLabel = String(row.groupingValue ?? "");
                const groupTotals = totalsOfRows(mode, row.subRows);
                const groupPct = groupTotals.percentage;
                const groupStatus = groupTotals.status;
                const groupMetrics = mobileMetrics(mode, groupTotals, true);

                return (
                  <div key={row.id} className="bg-[#f1f5f9]/90 p-4 space-y-2.5">
                    <button
                      type="button"
                      onClick={row.getToggleExpandedHandler()}
                      aria-expanded={groupExpanded}
                      className="w-full min-h-[44px] flex items-center justify-between gap-2 text-left cursor-pointer rounded-xl focus-utility-ring"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-white border border-[#cbd5e1] text-[#006877] flex items-center justify-center shrink-0">
                          {groupExpanded ? (
                            <ChevronDown className="w-4 h-4" aria-hidden />
                          ) : (
                            <ChevronRight className="w-4 h-4" aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#006877] truncate">
                            {groupLabel}
                          </div>
                          <div className="text-[11px] text-[#475569]">
                            Subtotal • {row.subRows.length} ULP
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            "font-mono text-xs font-bold",
                            groupStatus === "TERCAPAI" ? "text-[#15803d]" : "text-[#b45309]"
                          )}
                        >
                          {groupPct.toFixed(1)}%
                        </span>
                        <Badge
                          variant={groupStatus === "TERCAPAI" ? "success" : "warning"}
                          className="text-[10px] font-bold"
                        >
                          {groupStatus}
                        </Badge>
                      </div>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      {groupMetrics.map((metric) => (
                        <div
                          key={metric.label}
                          className="bg-white rounded-xl border border-[#e2e8f0] px-3 py-2"
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
                            {metric.label}
                          </div>
                          <div
                            className={cn(
                              "font-mono text-xs font-bold mt-0.5",
                              metric.highlight ? "text-[#006877]" : "text-[#0f172a]"
                            )}
                          >
                            {metric.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              // Leaf ULP Mobile Card
              const item = row.original;
              const leafNumber = leafIndexMap.get(row.id) ?? row.index + 1;
              const itemTotals = toTotals(mode, item);
              const pct = itemTotals.percentage;
              const metrics = mobileMetrics(mode, itemTotals, true);

              return (
                <div key={row.id} className="p-4 bg-white space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-[#64748b]">
                          #{leafNumber}
                        </span>
                        <span className="text-xs font-bold text-[#0f172a] truncate">
                          {item.ulpName}
                        </span>
                      </div>
                      {!isGrouped && (
                        <div className="text-[11px] text-[#475569] mt-0.5">
                          {item.up3Name}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "font-mono text-xs font-bold",
                          item.status === "TERCAPAI" ? "text-[#15803d]" : "text-[#b45309]"
                        )}
                      >
                        {pct.toFixed(1)}%
                      </span>
                      <Badge
                        variant={item.status === "TERCAPAI" ? "success" : "warning"}
                        className="text-[10px] font-semibold"
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="bg-[#f8fafc] rounded-xl border border-[#f1f5f9] px-3 py-2"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
                          {metric.label}
                        </div>
                        <div
                          className={cn(
                            "font-mono text-xs font-bold mt-0.5",
                            metric.highlight ? "text-[#006877]" : "text-[#0f172a]"
                          )}
                        >
                          {metric.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Mobile Grand Total Card */}
            <div className="p-4 bg-[#e7eeff] border-t-2 border-[#00a2b9] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#006877]">
                  {hasActiveLocalFilter ? FILTERED_FOOTER_LABEL : FOOTER_LABEL}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#006877]">
                    {activeTotals.percentage.toFixed(1)}%
                  </span>
                  <Badge
                    variant={activeTotals.status === "TERCAPAI" ? "success" : "warning"}
                    className="text-[10px] font-bold"
                  >
                    {activeTotals.status}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {mobileMetrics(mode, activeTotals, false).map((metric) => (
                  <div
                    key={metric.label}
                    className="bg-white/80 rounded-xl border border-[#cbd5e1] px-3 py-2"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#475569]">
                      {metric.label}
                    </div>
                    <div className="font-mono text-xs font-bold text-[#006877] mt-0.5">
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
