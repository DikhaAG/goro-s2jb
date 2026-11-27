"use client";

import { useMemo, type ReactNode } from "react";
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
  type Header,
  type Row,
  type RowData,
  type Table,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatNumber } from "@/lib/utils";
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
    label?: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    grandTotal?: ReportTotals;
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
  dailyTarget: number;
  dailyRealization: number;
  cumulativeTarget?: number;
  cumulativeRealization?: number;
};

type ReportTotals = Record<FigureKey, number> & { percentage: number; status: AchievementStatus };

type StatusFilter = "ALL" | AchievementStatus;

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

const STATUS_FILTERS: { value: StatusFilter; label: string; activeClass: string; idleClass: string }[] = [
  {
    value: "ALL",
    label: "Semua",
    activeClass: "bg-[#006877] text-white border-[#006877]",
    idleClass: "bg-white text-[#334155] border-[#cbd5e1] hover:bg-[#f1f5f9]",
  },
  {
    value: "TERCAPAI",
    label: "Tercapai",
    activeClass: "bg-[#15803d] text-white border-[#15803d]",
    idleClass: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0] hover:bg-[#dcfce7]",
  },
  {
    value: "TIDAK TERCAPAI",
    label: "Tidak Tercapai",
    activeClass: "bg-[#b45309] text-white border-[#b45309]",
    idleClass: "bg-[#fff7ed] text-[#b45309] border-[#fed7aa] hover:bg-[#ffedd5]",
  },
];

const GROUPING_OPTIONS = [
  { grouped: true, label: "Grup UP3", Icon: Layers },
  { grouped: false, label: "Peringkat ULP", Icon: ListFilter },
];

const METRIC_TILE_CLASSES = {
  group: { tile: "bg-white border-[#e2e8f0]", label: "text-[#64748b]" },
  leaf: { tile: "bg-[#f8fafc] border-[#f1f5f9]", label: "text-[#64748b]" },
  total: { tile: "bg-white/80 border-[#cbd5e1]", label: "text-[#475569]" },
};

const ALIGN_CLASS = { left: "", center: "text-center", right: "text-right" } as const;
const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

const FIGURE_KEYS: FigureKey[] = ["dailyTarget", "dailyRealization", "cumulativeTarget", "cumulativeRealization"];
const GROUP_COLUMN = "up3Name";
const FOOTER_LABEL = "TOTAL UID S2JB";
const FILTERED_FOOTER_LABEL = "TOTAL HASIL FILTER";
const SEARCH_PLACEHOLDER = "Cari nama atau kode ULP / UP3...";

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const groupLabel = (row: Row<ReportRow>) => String(row.groupingValue ?? "");

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

function mobileMetrics(mode: ReportMode, totals: ReportTotals) {
  return mode.mobileFigures.map((key) => ({
    label: mode.figures.find((f) => f.key === key)!.label,
    value: formatNumber(totals[key]),
    highlight: key === mode.realization,
  }));
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

function hasActiveLocalFilter(table: Table<ReportRow>): boolean {
  const { globalFilter, columnFilters } = table.getState();
  return String(globalFilter ?? "").trim().length > 0 || columnFilters.length > 0;
}

function resetLocalFilters(table: Table<ReportRow>) {
  table.resetGlobalFilter();
  table.resetColumnFilters();
  table.resetSorting();
}

/** The server grand total, or the sum of the rows left after search and status filtering. */
function footerSummary(table: Table<ReportRow>): { totals: ReportTotals; label: string } {
  const { grandTotal, mode } = table.options.meta!;
  if (!hasActiveLocalFilter(table)) return { totals: grandTotal!, label: FOOTER_LABEL };
  return { totals: totalsOfRows(mode!, table.getFilteredRowModel().flatRows), label: FILTERED_FOOTER_LABEL };
}

/** Status pill counts follow the text search but ignore the status filter itself, which is how TanStack facets work. */
function statusCounts(table: Table<ReportRow>): Record<StatusFilter, number> {
  const facets = table.getColumn("status")!.getFacetedUniqueValues();
  const achieved = facets.get("TERCAPAI") ?? 0;
  const missed = facets.get("TIDAK TERCAPAI") ?? 0;
  return { ALL: achieved + missed, TERCAPAI: achieved, "TIDAK TERCAPAI": missed };
}

// Keyed by TanStack's memoized row array, so numbering reruns only when the visible rows change.
const leafNumberCache = new WeakMap<Row<ReportRow>[], Map<string, number>>();

/** 1..N across visible ULP rows, continuing through UP3 groups. */
function leafNumberOf(table: Table<ReportRow>, rowId: string): number | undefined {
  const rows = table.getRowModel().rows;
  let numbers = leafNumberCache.get(rows);
  if (!numbers) {
    numbers = new Map();
    for (const row of rows) {
      if (!row.getIsGrouped()) numbers.set(row.id, numbers.size + 1);
    }
    leafNumberCache.set(rows, numbers);
  }
  return numbers.get(rowId);
}

function statusTextClass(status: AchievementStatus): string {
  return status === "TERCAPAI" ? "text-[#15803d]" : "text-[#b45309]";
}

function StatusBadge({ status, className }: { status: AchievementStatus; className: string }) {
  return (
    <Badge variant={status === "TERCAPAI" ? "success" : "warning"} className={className}>
      {status}
    </Badge>
  );
}

function StatusPercentage({ percentage, status }: { percentage: number; status: AchievementStatus }) {
  return <span className={cn("font-mono font-bold", statusTextClass(status))}>{formatPercent(percentage)}</span>;
}

function ExpandChevron({ expanded }: { expanded: boolean }) {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return <Icon className="w-4 h-4" aria-hidden />;
}

function GroupToggleButton({ row }: { row: Row<ReportRow> }) {
  const expanded = row.getIsExpanded();
  return (
    <button
      type="button"
      onClick={row.getToggleExpandedHandler()}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Tutup" : "Buka"} grup ${groupLabel(row)}`}
      className="w-7 h-7 rounded-lg bg-white border border-[#cbd5e1] text-[#006877] inline-flex items-center justify-center hover:border-[#00a2b9] cursor-pointer focus-utility-ring"
    >
      <ExpandChevron expanded={expanded} />
    </button>
  );
}

function GroupLabelButton({ row }: { row: Row<ReportRow> }) {
  return (
    <button
      type="button"
      onClick={row.getToggleExpandedHandler()}
      aria-expanded={row.getIsExpanded()}
      className="inline-flex items-center gap-2 text-left text-[#006877] hover:text-[#004e5a] cursor-pointer rounded-md focus-utility-ring"
    >
      <Building2 className="w-4 h-4 shrink-0 text-[#006877]" aria-hidden />
      <span className="font-bold tracking-wide text-xs">{groupLabel(row)}</span>
      <span className="px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-[11px] font-mono font-semibold text-[#334155]">
        {row.subRows.length} ULP
      </span>
    </button>
  );
}

const columnHelper = createColumnHelper<ReportRow>();

/** Leaf rows render `cell`; UP3 group rows render `aggregatedCell` from the same column. */
function buildColumns(mode: ReportMode): ColumnDef<ReportRow, any>[] {
  const rowPercentage = (row: ReportRow) =>
    achievementPercentage(row[mode.realization] ?? 0, row[mode.target] ?? 0);
  const groupTotals = (row: Row<ReportRow>) => totalsOfRows(mode, row.subRows);

  return [
    columnHelper.display({
      id: "no",
      header: "NO",
      enableHiding: false,
      meta: { align: "center", headerClassName: "w-12", cellClassName: "px-3", label: "Nomor" },
      cell: ({ row, table }) => (
        <span className="font-mono text-[#64748b]">{leafNumberOf(table, row.id)}</span>
      ),
      aggregatedCell: ({ row }) => <GroupToggleButton row={row} />,
    }),
    columnHelper.accessor("up3Name", {
      id: GROUP_COLUMN,
      header: "UP3",
      enableHiding: false,
      meta: { align: "left", label: "UP3" },
      cell: (info) => <span className="font-medium text-[#475569]">{info.getValue()}</span>,
    }),
    columnHelper.accessor("ulpName", {
      id: "ulpName",
      header: "NAMA ULP",
      enableHiding: false,
      meta: { align: "left", label: "Nama ULP" },
      cell: (info) => <span className="font-semibold text-[#0f172a]">{info.getValue()}</span>,
      aggregatedCell: ({ row }) => <GroupLabelButton row={row} />,
      footer: ({ table }) => (
        <span className="text-[#006877] font-bold uppercase tracking-wider">{footerSummary(table).label}</span>
      ),
    }),
    ...mode.figures.map((figure) =>
      columnHelper.accessor((row) => row[figure.key] ?? 0, {
        id: figure.key,
        header: figure.header,
        aggregationFn: "sum",
        meta: { align: "right", headerClassName: figure.width, label: figure.label },
        cell: (info) => <span className={TONE_CLASSES[figure.tone].cell}>{formatNumber(info.getValue())}</span>,
        aggregatedCell: (info) => (
          <span className={TONE_CLASSES[figure.tone].aggregated}>{formatNumber(Number(info.getValue() ?? 0))}</span>
        ),
        footer: ({ table }) => (
          <span className={TONE_CLASSES[figure.tone].footer}>
            {formatNumber(footerSummary(table).totals[figure.key])}
          </span>
        ),
      })
    ),
    columnHelper.accessor(rowPercentage, {
      id: "percentage",
      header: mode.percentageHeader,
      // Group rows sort by these aggregates, so they stay even though aggregatedCell recomputes them.
      aggregationFn: (_columnId, leafRows) => totalsOfRows(mode, leafRows).percentage,
      meta: { align: "right", headerClassName: "w-28", label: mode.percentageLabel },
      cell: (info) => <StatusPercentage percentage={info.getValue()} status={info.row.original.status} />,
      aggregatedCell: ({ row }) => <StatusPercentage {...groupTotals(row)} />,
      footer: ({ table }) => (
        <span className="font-mono font-bold text-sm text-[#006877]">
          {formatPercent(footerSummary(table).totals.percentage)}
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
        <StatusBadge status={groupTotals(row).status} className="text-[10px] py-0 px-2 uppercase font-bold" />
      ),
      footer: ({ table }) => (
        <StatusBadge status={footerSummary(table).totals.status} className="text-xs font-bold" />
      ),
    }),
  ];
}

/** Laporan Harian or Laporan Bulanan as one grouped, filterable table; the mode picks the figures and the basis for status. */
export function ReportTable({ mode: modeKey, groups, grandTotal: serverGrandTotal }: ReportTableProps) {
  const mode = MODES[modeKey];
  const data = useMemo<ReportRow[]>(
    () => (groups as Array<{ ulps: ReportRow[] }>).flatMap((group) => group.ulps),
    [groups]
  );
  const grandTotal = useMemo(() => toTotals(mode, serverGrandTotal), [mode, serverGrandTotal]);
  const columns = useMemo(() => buildColumns(mode), [mode]);

  const table = useReactTable({
    data,
    columns,
    initialState: { grouping: [GROUP_COLUMN], expanded: true },
    meta: { grandTotal, mode },
    getRowId: (row) => row.ulpId,
    globalFilterFn: matchesReportQuery,
    groupedColumnMode: "remove",
    autoResetAll: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const hasRows = table.getRowModel().rows.length > 0;

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs overflow-hidden">
      <ReportToolbar table={table} tableLabel={mode.tableLabel} totalCount={data.length} />
      {hasRows ? (
        <>
          <DesktopReportTable table={table} />
          <MobileReportList table={table} mode={mode} />
        </>
      ) : (
        <EmptyState table={table} hasData={data.length > 0} />
      )}
    </div>
  );
}

function ToolbarToggle({
  pressed,
  onClick,
  className,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn("text-xs font-semibold transition-colors cursor-pointer focus-utility-ring", className)}
    >
      {children}
    </button>
  );
}

function ReportToolbar({
  table,
  tableLabel,
  totalCount,
}: {
  table: Table<ReportRow>;
  tableLabel: string;
  totalCount: number;
}) {
  const { globalFilter = "", sorting, grouping } = table.getState();
  const statusColumn = table.getColumn("status")!;
  const statusFilter = (statusColumn.getFilterValue() as AchievementStatus | undefined) ?? "ALL";
  const counts = statusCounts(table);
  const isGrouped = grouping.length > 0;
  const isAllGroupsExpanded = table.getIsAllRowsExpanded();
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());

  const showGrouped = (grouped: boolean) => {
    table.setGrouping(grouped ? [GROUP_COLUMN] : []);
    if (grouped) table.setExpanded(true);
  };

  return (
    <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc] space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden
          />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            aria-label={`Cari data di ${tableLabel}`}
            className="w-full bg-white border border-[#cbd5e1] text-[#0f172a] placeholder-[#64748b] text-xs rounded-xl pl-9 pr-9 min-h-[44px] sm:min-h-[38px] transition-all focus-utility-ring"
          />
          {globalFilter && (
            <button
              type="button"
              onClick={() => table.resetGlobalFilter()}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] cursor-pointer focus-utility-ring"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center p-0.5 rounded-xl bg-white border border-[#cbd5e1]"
            role="group"
            aria-label="Mode pengelompokan tabel"
          >
            {GROUPING_OPTIONS.map(({ grouped, label, Icon }) => (
              <ToolbarToggle
                key={label}
                pressed={isGrouped === grouped}
                onClick={() => showGrouped(grouped)}
                className={cn(
                  "min-h-[40px] sm:min-h-[34px] px-3 rounded-lg inline-flex items-center gap-1.5",
                  isGrouped === grouped ? "bg-[#e7eeff] text-[#006877]" : "text-[#475569] hover:text-[#0f172a]"
                )}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden />
                <span>{label}</span>
              </ToolbarToggle>
            ))}
          </div>

          {isGrouped && table.getRowModel().rows.length > 0 && (
            <button
              type="button"
              onClick={() => table.toggleAllRowsExpanded(!isAllGroupsExpanded)}
              className="min-h-[44px] sm:min-h-[36px] px-3 rounded-xl bg-white border border-[#cbd5e1] text-xs font-semibold text-[#334155] hover:text-[#006877] hover:border-[#00a2b9] inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-utility-ring"
            >
              {isAllGroupsExpanded ? (
                <ChevronsDownUp className="w-3.5 h-3.5" aria-hidden />
              ) : (
                <ChevronsUpDown className="w-3.5 h-3.5" aria-hidden />
              )}
              <span>{isAllGroupsExpanded ? "Tutup Semua Grup" : "Buka Semua Grup"}</span>
            </button>
          )}

          {hideableColumns.length > 0 && (
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="min-h-[36px] px-3 rounded-xl bg-white border border-[#cbd5e1] text-xs font-semibold text-[#334155] hover:text-[#006877] hover:border-[#00a2b9] inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-utility-ring"
                  >
                    <Columns3 className="w-3.5 h-3.5" aria-hidden />
                    <span>Kolom</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Tampilkan Kolom</DropdownMenuLabel>
                  {hideableColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(checked) => column.toggleVisibility(checked)}
                      // Keep the menu open so several columns can be toggled in one go.
                      onSelect={(e) => e.preventDefault()}
                    >
                      {column.columnDef.meta?.label ?? column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter status capaian">
          {STATUS_FILTERS.map((option) => (
            <ToolbarToggle
              key={option.value}
              pressed={statusFilter === option.value}
              onClick={() => statusColumn.setFilterValue(option.value === "ALL" ? undefined : option.value)}
              className={cn(
                "min-h-[36px] px-3 py-1 rounded-lg border",
                statusFilter === option.value ? option.activeClass : option.idleClass
              )}
            >
              {option.label} ({counts[option.value]})
            </ToolbarToggle>
          ))}

          {(hasActiveLocalFilter(table) || sorting.length > 0) && (
            <button
              type="button"
              onClick={() => resetLocalFilters(table)}
              className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-[#475569] hover:text-[#0f172a] hover:bg-[#e2e8f0]/60 inline-flex items-center gap-1 cursor-pointer focus-utility-ring"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="text-xs text-[#475569]">
          Menampilkan{" "}
          <span className="font-mono font-bold text-[#0f172a]">{table.getFilteredRowModel().flatRows.length}</span>{" "}
          dari <span className="font-mono font-bold text-[#0f172a]">{totalCount}</span> ULP
        </div>
      </div>
    </div>
  );
}

function EmptyState({ table, hasData }: { table: Table<ReportRow>; hasData: boolean }) {
  return (
    <div className="py-12 px-6 text-center space-y-3">
      <p className="text-sm font-semibold text-[#0f172a]">
        {hasData
          ? "Tidak ada unit ULP yang cocok dengan pencarian atau filter status saat ini."
          : "Belum ada unit ULP untuk filter UP3 yang dipilih."}
      </p>
      <p className="text-xs text-[#64748b]">
        {hasData
          ? "Hapus kata kunci pencarian atau pilih filter Semua untuk menampilkan seluruh ULP."
          : "Ubah pilihan Filter UP3 di atas untuk melihat unit lain."}
      </p>
      {hasActiveLocalFilter(table) && (
        <button
          type="button"
          onClick={() => resetLocalFilters(table)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#006877] hover:bg-[#00525e] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer focus-utility-ring"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden />
          <span>Reset Filter Pencarian</span>
        </button>
      )}
    </div>
  );
}

function DesktopReportTable({ table }: { table: Table<ReportRow> }) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-xs text-left border-collapse font-sans">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569] font-bold uppercase tracking-wider text-[11px]"
            >
              {headerGroup.headers.map((header) => (
                <HeaderCell key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>

        <tbody className="divide-y divide-[#f1f5f9]">
          {table.getRowModel().rows.map((row) => (
            <BodyRow key={row.id} row={row} />
          ))}
        </tbody>

        <tfoot>
          {table.getFooterGroups().map((footerGroup) => (
            <tr
              key={footerGroup.id}
              className="bg-[#e7eeff] font-bold text-[#0f172a] border-t-2 border-[#00a2b9] text-xs"
            >
              {footerGroup.headers.map((header) => (
                <td
                  key={header.id}
                  className={cn(
                    "py-3 px-4 border-r border-[#cbd5e1] last:border-r-0",
                    ALIGN_CLASS[header.column.columnDef.meta?.align ?? "left"]
                  )}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}

function HeaderCell({ header }: { header: Header<ReportRow, unknown> }) {
  const { column } = header;
  const canSort = column.getCanSort();
  const sorted = column.getIsSorted();
  const align = column.columnDef.meta?.align ?? "left";
  const label = flexRender(column.columnDef.header, header.getContext());
  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <th
      scope="col"
      aria-sort={sorted ? ARIA_SORT[sorted] : canSort ? "none" : undefined}
      className={cn(
        "py-3 px-3.5 border-r border-[#e2e8f0] last:border-r-0 whitespace-nowrap select-none",
        ALIGN_CLASS[align],
        column.columnDef.meta?.headerClassName
      )}
    >
      {header.isPlaceholder ? null : canSort ? (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className={cn(
            "inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] hover:text-[#0f172a] transition-colors cursor-pointer rounded-md px-1 py-0.5 focus-utility-ring",
            align === "right" && "flex-row-reverse",
            sorted ? "text-[#006877]" : "text-[#475569]"
          )}
        >
          <span>{label}</span>
          <SortIcon className={cn("w-3.5 h-3.5 shrink-0", sorted ? "text-[#006877]" : "text-[#94a3b8]")} aria-hidden />
        </button>
      ) : (
        label
      )}
    </th>
  );
}

function BodyRow({ row }: { row: Row<ReportRow> }) {
  const isGroup = row.getIsGrouped();
  return (
    <tr
      className={
        isGroup
          ? "bg-[#f1f5f9] hover:bg-[#e7eeff]/70 font-bold text-[#0f172a] border-y border-[#e2e8f0] transition-colors"
          : "hover:bg-[#f8fafc] transition-colors text-[#334155]"
      }
    >
      {row.getVisibleCells().map((cell) => {
        const { meta, cell: leafCell, aggregatedCell } = cell.column.columnDef;
        return (
          <td
            key={cell.id}
            className={cn(
              "py-2.5 px-4 border-r last:border-r-0",
              isGroup ? "border-[#e2e8f0]" : "border-[#f1f5f9]",
              ALIGN_CLASS[meta?.align ?? "left"],
              meta?.cellClassName
            )}
          >
            {flexRender(cell.getIsAggregated() ? aggregatedCell : leafCell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );
}

function MobileReportList({ table, mode }: { table: Table<ReportRow>; mode: ReportMode }) {
  const footer = footerSummary(table);
  const isGrouped = table.getState().grouping.length > 0;

  return (
    <div className="md:hidden divide-y divide-[#e2e8f0]">
      {table.getRowModel().rows.map((row) =>
        row.getIsGrouped() ? (
          <MobileGroupCard key={row.id} row={row} mode={mode} />
        ) : (
          <MobileLeafCard
            key={row.id}
            row={row}
            mode={mode}
            leafNumber={leafNumberOf(table, row.id)}
            showUp3={!isGrouped}
          />
        )
      )}

      <div className="p-4 bg-[#e7eeff] border-t-2 border-[#00a2b9] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#006877]">{footer.label}</span>
          <MobileStatus
            percentage={footer.totals.percentage}
            status={footer.totals.status}
            percentageClassName="text-[#006877]"
            badgeClassName="font-bold"
          />
        </div>
        <MetricGrid variant="total" metrics={mobileMetrics(mode, footer.totals)} />
      </div>
    </div>
  );
}

function MobileGroupCard({ row, mode }: { row: Row<ReportRow>; mode: ReportMode }) {
  const expanded = row.getIsExpanded();
  const totals = totalsOfRows(mode, row.subRows);

  return (
    <div className="bg-[#f1f5f9]/90 p-4 space-y-2.5">
      <button
        type="button"
        onClick={row.getToggleExpandedHandler()}
        aria-expanded={expanded}
        className="w-full min-h-[44px] flex items-center justify-between gap-2 text-left cursor-pointer rounded-xl focus-utility-ring"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-white border border-[#cbd5e1] text-[#006877] flex items-center justify-center shrink-0">
            <ExpandChevron expanded={expanded} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#006877] truncate">{groupLabel(row)}</div>
            <div className="text-[11px] text-[#475569]">Subtotal • {row.subRows.length} ULP</div>
          </div>
        </div>
        <MobileStatus percentage={totals.percentage} status={totals.status} badgeClassName="font-bold" />
      </button>

      <MetricGrid variant="group" metrics={mobileMetrics(mode, totals)} />
    </div>
  );
}

function MobileLeafCard({
  row,
  mode,
  leafNumber,
  showUp3,
}: {
  row: Row<ReportRow>;
  mode: ReportMode;
  leafNumber: number | undefined;
  showUp3: boolean;
}) {
  const item = row.original;
  const totals = toTotals(mode, item);

  return (
    <div className="p-4 bg-white space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-[#64748b]">#{leafNumber}</span>
            <span className="text-xs font-bold text-[#0f172a] truncate">{item.ulpName}</span>
          </div>
          {showUp3 && <div className="text-[11px] text-[#475569] mt-0.5">{item.up3Name}</div>}
        </div>
        <MobileStatus percentage={totals.percentage} status={item.status} badgeClassName="font-semibold" />
      </div>

      <MetricGrid variant="leaf" metrics={mobileMetrics(mode, totals)} />
    </div>
  );
}

function MobileStatus({
  percentage,
  status,
  percentageClassName = statusTextClass(status),
  badgeClassName,
}: {
  percentage: number;
  status: AchievementStatus;
  percentageClassName?: string;
  badgeClassName: string;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className={cn("font-mono text-xs font-bold", percentageClassName)}>{formatPercent(percentage)}</span>
      <StatusBadge status={status} className={cn("text-[10px]", badgeClassName)} />
    </div>
  );
}

function MetricGrid({
  variant,
  metrics,
}: {
  variant: keyof typeof METRIC_TILE_CLASSES;
  metrics: ReturnType<typeof mobileMetrics>;
}) {
  const classes = METRIC_TILE_CLASSES[variant];
  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric) => (
        <div key={metric.label} className={cn("rounded-xl border px-3 py-2", classes.tile)}>
          <div className={cn("text-[10px] font-semibold uppercase tracking-wider", classes.label)}>
            {metric.label}
          </div>
          <div
            className={cn(
              "font-mono text-xs font-bold mt-0.5",
              metric.highlight || variant === "total" ? "text-[#006877]" : "text-[#0f172a]"
            )}
          >
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}
