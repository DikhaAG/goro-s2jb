"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  RotateCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Layers,
  Database,
  Eye,
  Check,
  Copy,
  AlertCircle,
  FileText,
  Calendar,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export interface MigrationBatchItem {
  id: string;
  fileName: string;
  fileSize: number;
  filePath?: string | null;
  targetType: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  lastProcessedRow?: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PAUSED" | string;
  errorMessage?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  _count?: {
    errors: number;
  };
}

interface MigrationBatchTableProps {
  batches: MigrationBatchItem[];
  isLoading: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const columnHelper = createColumnHelper<MigrationBatchItem>();

export function MigrationBatchTable({
  batches,
  isLoading,
  isRefetching,
  onRefresh,
}: MigrationBatchTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Selected batch for detail modal
  const [selectedBatch, setSelectedBatch] = useState<MigrationBatchItem | null>(null);
  const [errorLogPage, setErrorLogPage] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Query error logs when modal is open and batch has failures
  const errorLogsQuery = trpc.migration.getBatchErrorLogs.useQuery(
    {
      batchId: selectedBatch?.id || "",
      page: errorLogPage,
      pageSize: 10,
    },
    {
      enabled: Boolean(selectedBatch && selectedBatch.failedRows > 0),
    }
  );

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Status Tab counts calculation
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: batches.length,
      COMPLETED: 0,
      PROCESSING: 0,
      PENDING: 0,
      FAILED: 0,
    };
    for (const b of batches) {
      if (b.status === "COMPLETED") counts.COMPLETED++;
      else if (b.status === "PROCESSING") counts.PROCESSING++;
      else if (b.status === "PENDING" || b.status === "PAUSED") counts.PENDING++;
      else if (b.status === "FAILED") counts.FAILED++;
    }
    return counts;
  }, [batches]);

  // Filter data based on active status tab
  const filteredData = useMemo(() => {
    if (statusFilter === "ALL") return batches;
    if (statusFilter === "PENDING") {
      return batches.filter((b) => b.status === "PENDING" || b.status === "PAUSED");
    }
    return batches.filter((b) => b.status === statusFilter);
  }, [batches, statusFilter]);

  // Memoized Column Definitions adhering to TanStack Table Best Practices
  const columns = useMemo(
    () => [
      columnHelper.accessor("createdAt", {
        id: "createdAt",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              type="button"
              onClick={column.getToggleSortingHandler()}
              className="flex items-center gap-1.5 font-bold text-xs text-[#475569] hover:text-[#0f172a] uppercase tracking-wider transition-colors cursor-pointer group"
              title="Urutkan berdasarkan waktu unggah"
            >
              <span>Waktu Unggah</span>
              <span className="p-0.5 rounded group-hover:bg-slate-200/60 transition-colors">
                {isSorted === "asc" ? (
                  <ArrowUp className="w-3.5 h-3.5 text-[#006877]" />
                ) : isSorted === "desc" ? (
                  <ArrowDown className="w-3.5 h-3.5 text-[#006877]" />
                ) : (
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#94a3b8] opacity-60 group-hover:opacity-100" />
                )}
              </span>
            </button>
          );
        },
        cell: (info) => {
          const dateVal = info.getValue();
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-xs text-[#0f172a]">
                {formatDateTime(dateVal)}
              </span>
              <span className="text-xs text-[#64748b] font-mono">
                {new Date(dateVal).toLocaleDateString("id-ID", { weekday: "long" })}
              </span>
            </div>
          );
        },
      }),

      columnHelper.accessor("fileName", {
        id: "fileName",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              type="button"
              onClick={column.getToggleSortingHandler()}
              className="flex items-center gap-1.5 font-bold text-xs text-[#475569] hover:text-[#0f172a] uppercase tracking-wider transition-colors cursor-pointer group"
              title="Urutkan berdasarkan nama berkas"
            >
              <span>Berkas Sumber</span>
              <span className="p-0.5 rounded group-hover:bg-slate-200/60 transition-colors">
                {isSorted === "asc" ? (
                  <ArrowUp className="w-3.5 h-3.5 text-[#006877]" />
                ) : isSorted === "desc" ? (
                  <ArrowDown className="w-3.5 h-3.5 text-[#006877]" />
                ) : (
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#94a3b8] opacity-60 group-hover:opacity-100" />
                )}
              </span>
            </button>
          );
        },
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-start gap-2.5 max-w-[280px]">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-700 mt-0.5">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="font-bold text-xs text-[#0f172a] truncate hover:text-[#006877] transition-colors cursor-pointer"
                  title={row.fileName}
                  onClick={() => setSelectedBatch(row)}
                >
                  {row.fileName}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-[#64748b]">
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[#475569]">
                    {formatBytes(row.fileSize)}
                  </span>
                  <span className="font-mono text-[#94a3b8] truncate">
                    ID: {row.id.slice(0, 8)}...
                  </span>
                </div>
              </div>
            </div>
          );
        },
      }),

      columnHelper.accessor("targetType", {
        id: "targetType",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              type="button"
              onClick={column.getToggleSortingHandler()}
              className="flex items-center gap-1.5 font-bold text-xs text-[#475569] hover:text-[#0f172a] uppercase tracking-wider transition-colors cursor-pointer group"
              title="Urutkan berdasarkan target skema"
            >
              <span>Target Skema</span>
              <span className="p-0.5 rounded group-hover:bg-slate-200/60 transition-colors">
                {isSorted === "asc" ? (
                  <ArrowUp className="w-3.5 h-3.5 text-[#006877]" />
                ) : isSorted === "desc" ? (
                  <ArrowDown className="w-3.5 h-3.5 text-[#006877]" />
                ) : (
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#94a3b8] opacity-60 group-hover:opacity-100" />
                )}
              </span>
            </button>
          );
        },
        cell: (info) => {
          const val = info.getValue();
          const isFormRaw = val === "FORM_RESPONSES_RAW";
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border",
                isFormRaw
                  ? "bg-[#006877]/10 text-[#006877] border-[#006877]/20"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
              )}
            >
              <Database className="w-3 h-3" />
              {isFormRaw ? "Google Form Raw" : "Laporan Acuan"}
            </span>
          );
        },
      }),

      columnHelper.accessor("processedRows", {
        id: "progress",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              type="button"
              onClick={column.getToggleSortingHandler()}
              className="flex items-center gap-1.5 font-bold text-xs text-[#475569] hover:text-[#0f172a] uppercase tracking-wider transition-colors cursor-pointer group"
              title="Urutkan berdasarkan progres baris"
            >
              <span>Progres & Baris</span>
              <span className="p-0.5 rounded group-hover:bg-slate-200/60 transition-colors">
                {isSorted === "asc" ? (
                  <ArrowUp className="w-3.5 h-3.5 text-[#006877]" />
                ) : isSorted === "desc" ? (
                  <ArrowDown className="w-3.5 h-3.5 text-[#006877]" />
                ) : (
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#94a3b8] opacity-60 group-hover:opacity-100" />
                )}
              </span>
            </button>
          );
        },
        cell: (info) => {
          const row = info.row.original;
          const total = Math.max(row.totalRows, 1);
          const percent =
            row.status === "COMPLETED"
              ? 100
              : Math.min(100, Math.round((row.processedRows / total) * 100));

          return (
            <div className="w-36 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[#0f172a]">
                  {row.processedRows.toLocaleString("id-ID")}
                </span>
                <span className="text-[#64748b]">
                  {row.totalRows > 0 ? `/ ${row.totalRows.toLocaleString("id-ID")}` : "Baris"}
                </span>
                <span className="font-bold text-[#006877]">{percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70">
                <div
                  className={cn(
                    "h-full transition-all duration-500 rounded-full",
                    row.status === "COMPLETED"
                      ? "bg-emerald-500"
                      : row.status === "FAILED"
                      ? "bg-rose-500"
                      : "bg-[#00a2b9]"
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        },
      }),

      columnHelper.accessor("failedRows", {
        id: "failedRows",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              type="button"
              onClick={column.getToggleSortingHandler()}
              className="flex items-center justify-end w-full gap-1.5 font-bold text-xs text-[#475569] hover:text-[#0f172a] uppercase tracking-wider transition-colors cursor-pointer group text-right"
              title="Urutkan berdasarkan jumlah baris gagal"
            >
              <span>Gagal</span>
              <span className="p-0.5 rounded group-hover:bg-slate-200/60 transition-colors">
                {isSorted === "asc" ? (
                  <ArrowUp className="w-3.5 h-3.5 text-[#006877]" />
                ) : isSorted === "desc" ? (
                  <ArrowDown className="w-3.5 h-3.5 text-[#006877]" />
                ) : (
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#94a3b8] opacity-60 group-hover:opacity-100" />
                )}
              </span>
            </button>
          );
        },
        cell: (info) => {
          const failed = info.getValue();
          const row = info.row.original;
          if (failed <= 0) {
            return (
              <div className="text-right">
                <span className="font-mono text-xs text-[#94a3b8] bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                  0
                </span>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedBatch(row)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold font-mono hover:bg-rose-100 transition-colors cursor-pointer"
                title="Klik untuk melihat catatan baris gagal"
              >
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>{failed.toLocaleString("id-ID")}</span>
              </button>
            </div>
          );
        },
      }),

      columnHelper.accessor("status", {
        id: "status",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              type="button"
              onClick={column.getToggleSortingHandler()}
              className="flex items-center justify-center w-full gap-1.5 font-bold text-xs text-[#475569] hover:text-[#0f172a] uppercase tracking-wider transition-colors cursor-pointer group text-center"
              title="Urutkan berdasarkan status"
            >
              <span>Status</span>
              <span className="p-0.5 rounded group-hover:bg-slate-200/60 transition-colors">
                {isSorted === "asc" ? (
                  <ArrowUp className="w-3.5 h-3.5 text-[#006877]" />
                ) : isSorted === "desc" ? (
                  <ArrowDown className="w-3.5 h-3.5 text-[#006877]" />
                ) : (
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#94a3b8] opacity-60 group-hover:opacity-100" />
                )}
              </span>
            </button>
          );
        },
        cell: (info) => {
          const status = info.getValue();
          const isCompleted = status === "COMPLETED";
          const isFailed = status === "FAILED";
          const isProcessing = status === "PROCESSING";

          return (
            <div className="flex items-center justify-center">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                  isCompleted
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : isFailed
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : isProcessing
                    ? "bg-sky-50 text-sky-700 border-sky-200 animate-pulse"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isCompleted
                      ? "bg-emerald-600"
                      : isFailed
                      ? "bg-rose-600"
                      : isProcessing
                      ? "bg-sky-600"
                      : "bg-amber-600"
                  )}
                />
                {status}
              </span>
            </div>
          );
        },
      }),

      columnHelper.display({
        id: "actions",
        header: () => (
          <span className="block text-right font-bold text-xs text-[#475569] uppercase tracking-wider">
            Aksi
          </span>
        ),
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedBatch(b)}
                className="p-1.5 text-[#475569] hover:text-[#006877] hover:bg-[#e7eeff] rounded-lg transition-colors border border-transparent hover:border-[#bae6fd] cursor-pointer"
                title="Lihat detail lengkap batch"
              >
                <Eye className="w-4 h-4" />
              </button>

              <Link
                href={`/reviews?batchId=${b.id}`}
                className="p-1.5 text-[#475569] hover:text-[#15803d] hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200 cursor-pointer"
                title="Buka daftar ulasan batch ini"
              >
                <FileText className="w-4 h-4" />
              </Link>

              {b.status === "PROCESSING" && (
                <Link
                  href="/migration/monitor"
                  className="p-1.5 text-[#00a2b9] hover:text-[#006877] hover:bg-sky-50 rounded-lg transition-colors border border-sky-200 animate-pulse cursor-pointer"
                  title="Pantau progres live worker"
                >
                  <Activity className="w-4 h-4" />
                </Link>
              )}
            </div>
          );
        },
      }),
    ],
    []
  );

  // Initialize TanStack Table instance
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs overflow-hidden flex flex-col">
      {/* 1. Header Toolbar with Status Filter Tabs & Action Bar */}
      <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e7eeff] border border-[#bae6fd] flex items-center justify-center text-[#006877] shrink-0">
              <Layers className="w-4 h-4 text-[#006877]" />
            </div>
            <div>
              <h3 className="font-black text-sm text-[#0f172a] tracking-tight">
                Riwayat Batch Migrasi Massal
              </h3>
              <p className="text-xs text-[#64748b]">
                Manajemen rekam data historis, status eksekusi parser streaming, dan catatan log kegagalan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onRefresh}
              className="min-h-[38px] px-3 py-1.5 bg-[#f8fafc] hover:bg-slate-100 text-[#334155] border border-[#cbd5e1] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 focus-utility-ring cursor-pointer"
              title="Segarkan data batch"
            >
              <RotateCw className={cn("w-3.5 h-3.5", isRefetching ? "animate-spin text-[#006877]" : "text-[#64748b]")} />
              <span>Segarkan</span>
            </button>
            <span className="text-xs font-mono text-[#006877] font-bold bg-[#e7eeff] border border-[#bae6fd] px-3 py-1.5 rounded-xl">
              {filteredData.length} Batch Ditampilkan
            </span>
          </div>
        </div>

        {/* 2. Controls Row: Status Filter Tabs + Search Input */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                table.setPageIndex(0);
              }}
              className={cn(
                "min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                statusFilter === "ALL"
                  ? "bg-[#006877] text-white border-[#006877] shadow-xs"
                  : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-50"
              )}
            >
              <span>Semua</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-xs font-mono",
                  statusFilter === "ALL" ? "bg-white/20 text-white" : "bg-slate-100 text-[#475569]"
                )}
              >
                {statusCounts.ALL}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("COMPLETED");
                table.setPageIndex(0);
              }}
              className={cn(
                "min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                statusFilter === "COMPLETED"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-50"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Selesai</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-xs font-mono",
                  statusFilter === "COMPLETED" ? "bg-white/20 text-white" : "bg-slate-100 text-[#475569]"
                )}
              >
                {statusCounts.COMPLETED}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("PROCESSING");
                table.setPageIndex(0);
              }}
              className={cn(
                "min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                statusFilter === "PROCESSING"
                  ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                  : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-50"
              )}
            >
              <Activity className="w-3.5 h-3.5 text-sky-500 animate-pulse" />
              <span>Berjalan</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-xs font-mono",
                  statusFilter === "PROCESSING" ? "bg-white/20 text-white" : "bg-slate-100 text-[#475569]"
                )}
              >
                {statusCounts.PROCESSING}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("FAILED");
                table.setPageIndex(0);
              }}
              className={cn(
                "min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                statusFilter === "FAILED"
                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                  : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-50"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Gagal</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-xs font-mono",
                  statusFilter === "FAILED" ? "bg-white/20 text-white" : "bg-slate-100 text-[#475569]"
                )}
              >
                {statusCounts.FAILED}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("PENDING");
                table.setPageIndex(0);
              }}
              className={cn(
                "min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                statusFilter === "PENDING"
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-slate-50"
              )}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Tertunda</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-xs font-mono",
                  statusFilter === "PENDING" ? "bg-white/20 text-white" : "bg-slate-100 text-[#475569]"
                )}
              >
                {statusCounts.PENDING}
              </span>
            </button>
          </div>

          {/* Global Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={globalFilter ?? ""}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                table.setPageIndex(0);
              }}
              placeholder="Cari nama berkas, skema, ID..."
              className="w-full min-h-[38px] pl-9 pr-8 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] placeholder-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006877]/20 focus:border-[#006877] transition-all"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => setGlobalFilter("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-0.5 cursor-pointer"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Table Surface */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="py-3 px-4 select-none"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-xs text-[#64748b]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RotateCw className="w-6 h-6 animate-spin text-[#006877]" />
                    <span className="font-medium">Memuat riwayat batch migrasi...</span>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-xs text-[#64748b]">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[#94a3b8]">
                      <FileSpreadsheet className="w-6 h-6 text-[#94a3b8]" />
                    </div>
                    <p className="font-bold text-sm text-[#0f172a]">
                      {globalFilter || statusFilter !== "ALL"
                        ? "Tidak Ada Batch yang Cocok"
                        : "Belum Ada Batch Migrasi"}
                    </p>
                    <p className="text-xs text-[#64748b]">
                      {globalFilter || statusFilter !== "ALL"
                        ? "Coba ubah kata kunci pencarian atau pilih tab status lain."
                        : "Unggah rekam berkas CSV atau Excel historis menggunakan form di atas."}
                    </p>
                    {(globalFilter || statusFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setGlobalFilter("");
                          setStatusFilter("ALL");
                        }}
                        className="mt-2 px-3 py-1.5 bg-[#e7eeff] text-[#006877] text-xs font-bold rounded-xl border border-[#bae6fd] hover:bg-[#d6e4ff] transition-colors cursor-pointer"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => setSelectedBatch(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="py-3.5 px-4 align-middle"
                      onClick={(e) => {
                        // Prevent row modal trigger when clicking direct action links/buttons
                        if ((e.target as HTMLElement).closest("a, button")) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. TanStack Table Pagination Footer Bar */}
      {!isLoading && table.getFilteredRowModel().rows.length > 0 && (
        <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            <span>
              Menampilkan{" "}
              <strong className="text-[#0f172a]">
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              </strong>{" "}
              sampai{" "}
              <strong className="text-[#0f172a]">
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}
              </strong>{" "}
              dari{" "}
              <strong className="text-[#0f172a] font-mono">
                {table.getFilteredRowModel().rows.length}
              </strong>{" "}
              batch
            </span>
          </div>

          <div className="flex items-center gap-2 self-center sm:self-auto">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-xs text-[#64748b]">Per halaman:</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                }}
                className="text-xs font-bold bg-white border border-[#cbd5e1] rounded-lg px-2 py-1 text-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#006877] cursor-pointer"
              >
                {[5, 10, 20, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#334155] hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Halaman pertama"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#334155] hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 text-xs font-bold text-[#0f172a] bg-white border border-[#cbd5e1] rounded-lg">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
              </span>

              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#334155] hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Halaman berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#334155] hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Halaman terakhir"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Detailed Batch Inspector Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-[#0f172a] truncate" title={selectedBatch.fileName}>
                      {selectedBatch.fileName}
                    </h3>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                        selectedBatch.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : selectedBatch.status === "FAILED"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : selectedBatch.status === "PROCESSING"
                          ? "bg-sky-50 text-sky-700 border border-sky-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      )}
                    >
                      {selectedBatch.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#64748b] mt-0.5">
                    <span>Batch ID: <strong className="font-mono text-[#0f172a]">{selectedBatch.id}</strong></span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(selectedBatch.id)}
                      className="text-[#64748b] hover:text-[#006877] transition-colors cursor-pointer"
                      title="Salin Batch ID"
                    >
                      {copiedId === selectedBatch.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200 transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs text-[#64748b] block mb-1">Ukuran Berkas</span>
                  <span className="text-sm font-bold font-mono text-[#0f172a]">
                    {formatBytes(selectedBatch.fileSize)}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs text-[#64748b] block mb-1">Total Baris</span>
                  <span className="text-sm font-bold font-mono text-[#0f172a]">
                    {selectedBatch.totalRows.toLocaleString("id-ID")}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                  <span className="text-xs text-emerald-700 block mb-1">Baris Berhasil</span>
                  <span className="text-sm font-bold font-mono text-emerald-700">
                    {selectedBatch.processedRows.toLocaleString("id-ID")}
                  </span>
                </div>

                <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl">
                  <span className="text-xs text-rose-700 block mb-1">Baris Gagal</span>
                  <span className="text-sm font-bold font-mono text-rose-700">
                    {selectedBatch.failedRows.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Progress & Duration */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#475569]">Rasio Keberhasilan Migrasi</span>
                  <span className="text-[#006877] font-bold font-mono">
                    {selectedBatch.totalRows > 0
                      ? Math.round((selectedBatch.processedRows / selectedBatch.totalRows) * 100)
                      : selectedBatch.status === "COMPLETED"
                      ? 100
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      selectedBatch.status === "COMPLETED" ? "bg-emerald-500" : "bg-[#00a2b9]"
                    )}
                    style={{
                      width: `${
                        selectedBatch.totalRows > 0
                          ? Math.round((selectedBatch.processedRows / selectedBatch.totalRows) * 100)
                          : selectedBatch.status === "COMPLETED"
                          ? 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-[#64748b] pt-1 font-mono">
                  <span>Dibuat: {formatDateTime(selectedBatch.createdAt)}</span>
                  {selectedBatch.completedAt && (
                    <span>Selesai: {formatDateTime(selectedBatch.completedAt)}</span>
                  )}
                </div>
              </div>

              {/* Error Message if failed */}
              {selectedBatch.errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <strong className="block font-bold">Pesan Kesalahan Sistem:</strong>
                    <span className="font-mono text-xs mt-0.5 block">{selectedBatch.errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Error Logs Table Section */}
              {selectedBatch.failedRows > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#0f172a] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Catatan Baris Gagal ({selectedBatch.failedRows} baris)</span>
                    </h4>
                    {errorLogsQuery.data && errorLogsQuery.data.totalPages > 1 && (
                      <span className="text-xs text-[#64748b]">
                        Halaman {errorLogsQuery.data.page} dari {errorLogsQuery.data.totalPages}
                      </span>
                    )}
                  </div>

                  {errorLogsQuery.isLoading ? (
                    <div className="py-6 text-center text-xs text-[#64748b] animate-pulse">
                      Memuat rincian kesalahan...
                    </div>
                  ) : !errorLogsQuery.data?.errors || errorLogsQuery.data.errors.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[#64748b] bg-slate-50 rounded-xl">
                      Tidak ada detail log kegagalan yang tersimpan.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 border-b border-slate-200 text-[#475569] font-bold">
                          <tr>
                            <th className="py-2 px-3 w-20">Baris</th>
                            <th className="py-2 px-3">Penyebab Kesalahan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {errorLogsQuery.data.errors.map((err) => (
                            <tr key={err.id} className="hover:bg-rose-50/40">
                              <td className="py-2.5 px-3 font-mono font-bold text-rose-600 align-top">
                                #{err.rowNumber}
                              </td>
                              <td className="py-2.5 px-3 text-[#0f172a] align-top">
                                <p className="font-semibold text-rose-700">{err.errorReason}</p>
                                {err.rawRowData && (
                                  <details className="mt-1">
                                    <summary className="text-xs text-[#64748b] cursor-pointer hover:text-[#006877]">
                                      Lihat data mentah
                                    </summary>
                                    <pre className="mt-1 p-1.5 bg-slate-100 rounded text-xs font-mono text-[#334155] max-h-24 overflow-x-auto whitespace-pre-wrap">
                                      {err.rawRowData}
                                    </pre>
                                  </details>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Error log pagination buttons */}
                      {errorLogsQuery.data.totalPages > 1 && (
                        <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setErrorLogPage((p) => Math.max(1, p - 1))}
                            disabled={errorLogPage <= 1}
                            className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40"
                          >
                            Sebelumnya
                          </button>
                          <span className="text-xs text-[#64748b]">
                            {errorLogPage} / {errorLogsQuery.data.totalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setErrorLogPage((p) =>
                                Math.min(errorLogsQuery.data.totalPages, p + 1)
                              )
                            }
                            disabled={errorLogPage >= errorLogsQuery.data.totalPages}
                            className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40"
                          >
                            Berikutnya
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/reviews?batchId=${selectedBatch.id}`}
                className="px-3.5 py-2 bg-[#006877] hover:bg-[#00525e] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Buka Ulasan Batch Ini</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <div className="flex items-center gap-2">
                {selectedBatch.status === "PROCESSING" && (
                  <Link
                    href="/migration/monitor"
                    className="px-3 py-2 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Pantau Live</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedBatch(null)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-[#475569] border border-[#cbd5e1] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
