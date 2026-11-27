"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import type { AchievementStatus } from "@/server/services/achievementReport";

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
    grandTotal?: ReportSummaryTotals;
    hasActiveLocalFilter?: boolean;
    footerLabel?: string;
  }
}

export interface BaseReportRow {
  ulpId: string;
  ulpCode: string;
  ulpName: string;
  up3Id: string;
  up3Name: string;
  dailyTarget: number;
  dailyRealization: number;
  status: AchievementStatus;
}

export interface ReportSummaryTotals {
  dailyTarget: number;
  dailyRealization: number;
  percentage: number;
  status: AchievementStatus;
  cumulativeTarget?: number;
  cumulativeRealization?: number;
}

export interface MobileMetricItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface ReportDataTableProps<TData extends BaseReportRow> {
  data: TData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  grandTotal: ReportSummaryTotals;
  tableLabel: string;
  searchPlaceholder?: string;
  getMobileMetrics: (row: TData) => MobileMetricItem[];
  getMobileGroupMetrics: (subRows: Row<TData>[]) => MobileMetricItem[];
  getRowPercentage: (row: TData) => number;
  getGroupPercentage: (subRows: Row<TData>[]) => number;
  getGroupStatus: (subRows: Row<TData>[]) => AchievementStatus;
  footerLabel?: string;
  getFilteredTotals: (rows: Row<TData>[]) => ReportSummaryTotals;
  renderMobileFooterMetrics: (totals: ReportSummaryTotals) => MobileMetricItem[];
}

export function calcReportPercentage(realization: number, target: number): number {
  return target > 0 ? Math.round((realization / target) * 1000) / 10 : 0;
}

export function calcReportStatus(realization: number, target: number): AchievementStatus {
  return target > 0 && realization >= target ? "TERCAPAI" : "TIDAK TERCAPAI";
}

export function sumSubRowField<TData extends BaseReportRow>(
  subRows: Row<TData>[],
  selector: (row: TData) => number
): number {
  let total = 0;
  for (const row of subRows) {
    total += selector(row.original);
  }
  return total;
}

function matchesReportQuery<TData extends BaseReportRow>(
  row: Row<TData>,
  _columnId: string,
  filterValue: unknown
): boolean {
  const query = String(filterValue ?? "").trim().toLowerCase();
  if (!query) return true;
  const item = row.original;
  return (
    item.ulpName.toLowerCase().includes(query) ||
    item.ulpCode.toLowerCase().includes(query) ||
    item.up3Name.toLowerCase().includes(query)
  );
}

export function ReportDataTable<TData extends BaseReportRow>({
  data,
  columns,
  grandTotal,
  tableLabel,
  searchPlaceholder = "Cari nama atau kode ULP / UP3...",
  getMobileMetrics,
  getMobileGroupMetrics,
  getRowPercentage,
  getGroupPercentage,
  getGroupStatus,
  footerLabel = "TOTAL UID S2JB",
  getFilteredTotals,
  renderMobileFooterMetrics,
}: ReportDataTableProps<TData>) {
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
      footerLabel,
    },
    getRowId: (row) => row.ulpId,
    globalFilterFn: matchesReportQuery,
    groupedColumnMode: "remove",
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
    () => (hasActiveLocalFilter ? getFilteredTotals(filteredLeafRows) : grandTotal),
    [hasActiveLocalFilter, filteredLeafRows, getFilteredTotals, grandTotal]
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
              placeholder={searchPlaceholder}
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
                const groupPct = getGroupPercentage(row.subRows);
                const groupStatus = getGroupStatus(row.subRows);
                const groupMetrics = getMobileGroupMetrics(row.subRows);

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
              const pct = getRowPercentage(item);
              const metrics = getMobileMetrics(item);

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
                  {hasActiveLocalFilter ? "TOTAL HASIL FILTER" : footerLabel}
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
                {renderMobileFooterMetrics(activeTotals).map((metric) => (
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

export function getEffectiveFooterTotals<TData extends BaseReportRow>(
  table: Table<TData>,
  computeFiltered: (rows: Row<TData>[]) => ReportSummaryTotals
): { totals: ReportSummaryTotals; label: string } {
  const meta = table.options.meta;
  if (meta?.hasActiveLocalFilter) {
    return {
      totals: computeFiltered(table.getFilteredRowModel().flatRows),
      label: "TOTAL HASIL FILTER",
    };
  }
  return {
    totals: meta?.grandTotal ?? computeFiltered(table.getFilteredRowModel().flatRows),
    label: meta?.footerLabel ?? "TOTAL UID S2JB",
  };
}
