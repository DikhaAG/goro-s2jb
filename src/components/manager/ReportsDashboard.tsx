"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createParser, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { trpc } from "@/lib/trpc";
import { ExecutiveKpiCards } from "./ExecutiveKpiCards";
import { ReportTable } from "./ReportTable";
import { PerformanceChart } from "./PerformanceChart";
import { CumulativePacingChart } from "./CumulativePacingChart";
import { TargetCalendarModal } from "./TargetCalendarModal";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  Loader2,
  AlertOctagon,
  TrendingUp,
  BarChart3,
  ListOrdered,
  RotateCw,
  CheckCircle2,
  Sparkles,
  X,
  Database,
  Clock,
  ArrowRight,
  CalendarDays,
  Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { wibDateOf, wibToday } from "@/lib/wibDate";

const REPORT_TAB_IDS = ["MONTHLY", "DAILY", "CHARTS"] as const;
type ReportTab = (typeof REPORT_TAB_IDS)[number];

const REPORT_TABS: { id: ReportTab; label: string; icon: LucideIcon }[] = [
  { id: "MONTHLY", label: "Laporan Bulanan", icon: ListOrdered },
  { id: "DAILY", label: "Laporan Harian", icon: Calendar },
  { id: "CHARTS", label: "Grafik & Pacing", icon: BarChart3 },
];

/** A "YYYY-MM-DD" date in the URL; anything else falls back to today. */
const parseAsReportDate = createParser({
  parse: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null),
  serialize: (value: string) => value,
});

const EMPTY_KPIS = {
  totalCumulativeRealization: 0,
  totalCumulativeTarget: 0,
  cumulativeAchievementRate: 0,
  dailyRealizationToday: 0,
  dailyTargetToday: 0,
  top3Ulps: [],
  bottom3Ulps: [],
};

const RECENT_BATCH_WINDOW_MS = 30 * 60 * 1000;

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// Date keys parse as UTC midnight, so format them in UTC to keep the same calendar day.
const dateKeyFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function ReportsDashboard() {
  const utils = trpc.useUtils();
  const sessionQuery = trpc.auth.getSession.useQuery();
  const user = sessionQuery.data;
  const isAuthorized = user?.role === "MANAGER" || user?.role === "SUPER_ADMIN";

  // Posisi Tanggal: the one reporting date. The server derives the month from it.
  const [selectedDate, setSelectedDate] = useQueryState("tanggal", parseAsReportDate.withDefault(wibToday()));
  const [selectedUp3Id, setSelectedUp3Id] = useQueryState("up3", parseAsString.withDefault(""));
  const [activeTab, setActiveTab] = useQueryState("tab", parseAsStringLiteral(REPORT_TAB_IDS).withDefault("MONTHLY"));

  const [isTargetCalendarOpen, setIsTargetCalendarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedBatchId, setDismissedBatchId] = useState<string | null>(null);

  const unitsQuery = trpc.master.getUnits.useQuery();

  // The server bumps lastSyncTimestamp whenever reviews or the Kalender Target change.
  const syncStatusQuery = trpc.report.getSyncStatus.useQuery(undefined, {
    enabled: isAuthorized,
    refetchInterval: 3000,
  });
  const syncStatus = syncStatusQuery.data;

  const previousSyncTimestamp = useRef<string | null>(null);
  useEffect(() => {
    const currentSyncTimestamp = syncStatus?.lastSyncTimestamp;
    if (!currentSyncTimestamp) return;

    const hasNewData =
      previousSyncTimestamp.current !== null && previousSyncTimestamp.current !== currentSyncTimestamp;
    previousSyncTimestamp.current = currentSyncTimestamp;

    if (hasNewData) utils.report.invalidate();
  }, [syncStatus?.lastSyncTimestamp, utils]);

  const reportInput = { posisiTanggal: selectedDate, up3Id: selectedUp3Id || undefined };

  const kpiQuery = trpc.report.getKpis.useQuery({ posisiTanggal: selectedDate }, { enabled: isAuthorized });
  const dailyQuery = trpc.report.getDaily.useQuery(reportInput, {
    enabled: isAuthorized && (activeTab === "DAILY" || activeTab === "CHARTS"),
  });
  const monthlyQuery = trpc.report.getMonthly.useQuery(reportInput, {
    enabled: isAuthorized && (activeTab === "MONTHLY" || activeTab === "CHARTS"),
  });
  const pacingQuery = trpc.report.getPacing.useQuery(reportInput, {
    enabled: isAuthorized && activeTab === "CHARTS",
  });

  const lastRefreshedAt = Math.max(
    kpiQuery.dataUpdatedAt,
    dailyQuery.dataUpdatedAt,
    monthlyQuery.dataUpdatedAt,
    pacingQuery.dataUpdatedAt
  );

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refetches only the report queries that are currently shown.
      await utils.report.invalidate();
    } finally {
      setIsRefreshing(false);
    }
  };

  const openExport = (format: "excel" | "pdf") => {
    const params = new URLSearchParams({ posisiTanggal: selectedDate });
    if (selectedUp3Id) params.set("up3Id", selectedUp3Id);
    window.open(`/api/export/${format}?${params}`, "_blank");
  };

  const latestBatch = syncStatus?.latestBatch;
  const isRecentBatch =
    latestBatch?.status === "COMPLETED" &&
    latestBatch.id !== dismissedBatchId &&
    latestBatch.completedAt &&
    Date.now() - new Date(latestBatch.completedAt).getTime() < RECENT_BATCH_WINDOW_MS;

  // Reports group reviews by WIB day, so the suggested date must be the WIB day too.
  const latestApprovedDate = syncStatus?.latestApprovedReviewDate
    ? wibDateOf(new Date(syncStatus.latestApprovedReviewDate))
    : null;
  const hasNoRealizationOnSelectedDate =
    dailyQuery.data?.grandTotal.dailyRealization === 0 || kpiQuery.data?.dailyRealizationToday === 0;
  const showDateSuggestion =
    latestApprovedDate !== null && latestApprovedDate !== selectedDate && hasNoRealizationOnSelectedDate;

  // RBAC Access Control Guard
  if (sessionQuery.isLoading) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center text-[#64748b]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00a2b9]" />
      </div>
    );
  }

  if (user && !isAuthorized) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#fed7aa] rounded-2xl p-6 text-center space-y-4 shadow-xs">
          <div className="p-3 bg-[#fff7ed] border border-[#fed7aa] rounded-full w-14 h-14 mx-auto flex items-center justify-center text-[#b45309]">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Akses Ditolak (403 Forbidden)</h2>
            <p className="text-xs text-[#64748b] mt-1">
              Modul Laporan Eksekutif khusus diperuntukkan bagi Role Manager Wilayah atau Super Admin.
              Akun Anda terdaftar sebagai <span className="text-[#b45309] font-mono font-semibold">{user.role}</span>.
            </p>
          </div>
          <Link href={user.role === "PEGAWAI" ? "/reviews" : "/intake"}>
            <Button className="w-full bg-[#00a2b9] hover:bg-[#008b9e] text-white text-xs mt-2 min-h-[44px] h-11 font-semibold rounded-xl">
              Kembali ke Modul {user.role === "PEGAWAI" ? "Triase & Data Ulasan" : "Entri Eviden"}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Title Header with Export Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#00A3E0]" />
              <span>Pusat Laporan Eksekutif & Intelijen Kinerja</span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Agregasi real-time seluruh unit pelaksana PLN UID S2JB dengan proteksi Target Immutability.
          </p>

          {/* Live Realtime Telemetry Bar */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sinkronisasi Otomatis Aktif</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs">
              <Clock className="w-3.5 h-3.5 text-[#64748b]" />
              <span>
                Terakhir disinkronkan: {lastRefreshedAt > 0 ? timeFormatter.format(lastRefreshedAt) : "-"}
              </span>
            </span>

            {syncStatus?.totalApprovedCount !== undefined && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f0fdfa] text-[#006877] border border-[#bae6fd] text-xs font-semibold">
                <Database className="w-3.5 h-3.5 text-[#00a2b9]" />
                <span>{syncStatus.totalApprovedCount.toLocaleString("id-ID")} Ulasan Terverifikasi</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsTargetCalendarOpen(true)}
            className="h-9 min-h-[36px] text-xs gap-2 bg-white border-slate-200 hover:border-teal-600 text-slate-700 hover:text-teal-700 font-medium rounded-xl shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
            title="Atur target harian per tanggal"
          >
            <CalendarDays className="w-4 h-4 text-teal-600" aria-hidden />
            <span>Kalender Target</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-9 min-h-[36px] text-xs gap-2 bg-white border-slate-200 hover:border-[#006877] text-slate-700 hover:text-[#006877] font-medium rounded-xl shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
            title="Segarkan data laporan dari database terbaru"
          >
            <RotateCw className={cn("w-4 h-4 text-[#006877]", isRefreshing && "animate-spin")} />
            <span>{isRefreshing ? "Menyinkronkan..." : "Segarkan Data"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => openExport("excel")}
            className="h-9 min-h-[36px] text-xs gap-2 bg-white border-slate-200 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 font-medium rounded-xl shadow-sm transition-all active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor Excel (.xlsx)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => openExport("pdf")}
            className="h-9 min-h-[36px] text-xs gap-2 bg-white border-slate-200 hover:border-[#00A3E0] text-slate-700 hover:text-[#00A3E0] font-medium rounded-xl shadow-sm transition-all active:scale-[0.98]"
          >
            <Printer className="w-4 h-4 text-[#00A3E0]" />
            <span>Cetak PDF</span>
          </Button>
        </div>
      </div>

      {/* 1. Recent Migration Completed Live Notification Banner */}
      {isRecentBatch && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-700" />
            </div>
            <div>
              <span className="font-bold text-emerald-950">
                Migrasi Selesai ({latestBatch.fileName}):
              </span>{" "}
              <span>
                {latestBatch.processedRows.toLocaleString("id-ID")} baris data berhasil di-ingest. Seluruh metrik laporan telah langsung diperbarui berdasarkan data ulasan terbaru.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedBatchId(latestBatch.id)}
            className="text-emerald-700 hover:text-emerald-950 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
            title="Tutup pemberitahuan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Smart Date Jump Suggestion Banner */}
      {showDateSuggestion && (
        <div className="p-4 rounded-2xl bg-[#f0fdfa] border border-[#bae6fd] text-[#006877] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#e7eeff] border border-[#bae6fd] flex items-center justify-center shrink-0 text-[#006877]">
              <Sparkles className="w-4.5 h-4.5 text-[#00a2b9]" />
            </div>
            <div>
              <span className="font-bold text-[#0f172a]">
                Pemberitahuan Data Ulasan Terbaru:
              </span>{" "}
              <span className="text-[#475569]">
                Terdapat data ulasan terverifikasi pada tanggal{" "}
                <strong className="text-[#0f172a]">{dateKeyFormatter.format(new Date(latestApprovedDate))}</strong>.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(latestApprovedDate)}
            className="min-h-[36px] px-3.5 py-1.5 bg-[#006877] hover:bg-[#00525e] text-white font-bold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0 focus-utility-ring"
          >
            <span>Buka Periode Ini</span>
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      )}

      {/* Executive KPI Overview Cards */}
      <ExecutiveKpiCards kpis={kpiQuery.data ?? EMPTY_KPIS} />

      {/* Global Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
        {/* Left Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-x-auto">
          {REPORT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer focus-utility-ring whitespace-nowrap",
                activeTab === id
                  ? "bg-[#e7eeff] text-[#006877] border border-[#cfdaf2] font-semibold"
                  : "text-[#64748b] hover:text-[#0f172a]"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Right Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <Filter className="w-3.5 h-3.5 text-[#64748b]" />
            <span className="font-semibold">Filter UP3:</span>
            <select
              value={selectedUp3Id}
              onChange={(e) => setSelectedUp3Id(e.target.value)}
              className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-3 py-2 min-h-[38px] focus-utility-ring"
            >
              <option value="">Semua UP3 (UID S2JB)</option>
              {unitsQuery.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <span className="font-semibold">Posisi Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-2.5 py-1.5 min-h-[38px] focus-utility-ring"
            />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "MONTHLY" && (
        <ReportQueryState
          query={monthlyQuery}
          loadingText="Memuat laporan bulanan kumulatif..."
          errorTitle="Gagal memuat laporan bulanan kumulatif."
        >
          {(monthly) => (
            <>
              {monthly.defaultTargetDates.length > 0 && (
                <DefaultTargetNote onOpenCalendar={() => setIsTargetCalendarOpen(true)}>
                  {monthly.defaultTargetDates.length} tanggal sejak awal bulan belum diatur di Kalender Target, jadi
                  Target Kumulatif memakai nilai default untuk tanggal itu (hari kerja 50, akhir pekan 20).
                </DefaultTargetNote>
              )}
              <ReportTable mode="monthly" groups={monthly.groups} grandTotal={monthly.grandTotal} />
            </>
          )}
        </ReportQueryState>
      )}

      {activeTab === "DAILY" && (
        <ReportQueryState
          query={dailyQuery}
          loadingText="Memuat laporan harian..."
          errorTitle="Gagal memuat laporan harian."
        >
          {(daily) => (
            <>
              {daily.targetIsDefault && (
                <DefaultTargetNote onOpenCalendar={() => setIsTargetCalendarOpen(true)}>
                  Tanggal ini belum diatur di Kalender Target, jadi target harian memakai nilai default (hari kerja 50, akhir pekan 20).
                </DefaultTargetNote>
              )}
              <ReportTable mode="daily" groups={daily.groups} grandTotal={daily.grandTotal} />
            </>
          )}
        </ReportQueryState>
      )}

      {activeTab === "CHARTS" && (
        <div className="space-y-4">
          {monthlyQuery.data && <PerformanceChart groups={monthlyQuery.data.groups} />}
          {pacingQuery.data && <CumulativePacingChart pacingData={pacingQuery.data} />}
        </div>
      )}

      <TargetCalendarModal
        isOpen={isTargetCalendarOpen}
        onClose={() => setIsTargetCalendarOpen(false)}
        initialDate={selectedDate}
      />
    </div>
  );
}

interface ReportQuery<TData> {
  data: TData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: { message: string } | null;
  refetch: () => unknown;
}

/** Shows the loading or error state of a report query, and the report itself once it has data. */
function ReportQueryState<TData>({
  query,
  loadingText,
  errorTitle,
  children,
}: {
  query: ReportQuery<TData>;
  loadingText: string;
  errorTitle: string;
  children: (data: TData) => React.ReactNode;
}) {
  if (query.isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-2 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
        <Loader2 className="w-6 h-6 animate-spin text-[#00a2b9]" />
        <span className="text-xs text-[#64748b]">{loadingText}</span>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="p-6 bg-[#fef2f2] border border-[#fecaca] rounded-2xl text-center space-y-3">
        <p className="text-sm font-semibold text-[#b91c1c]">{errorTitle}</p>
        <p className="text-xs text-[#7f1d1d]">
          {query.error?.message || "Terjadi gangguan koneksi ke server laporan."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => query.refetch()}
          className="min-h-[44px] px-4 rounded-xl border-[#fca5a5] bg-white text-[#b91c1c] hover:bg-[#fef2f2] text-xs font-semibold"
        >
          Muat Ulang Laporan
        </Button>
      </div>
    );
  }

  if (query.data === undefined) return null;
  return <div>{children(query.data)}</div>;
}

/** Says when a report used the fixed default target because the Kalender Target had no entry (ADR-0002). */
function DefaultTargetNote({ children, onOpenCalendar }: { children: React.ReactNode; onOpenCalendar: () => void }) {
  return (
    <div className="mb-3 flex flex-col gap-3 rounded-2xl bg-[#f8fafc] p-4 sm:flex-row sm:items-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#475569] text-white">
        <Info className="h-5 w-5" aria-hidden />
      </div>
      <p className="flex-1 text-xs text-[#334155]">{children}</p>
      <button
        type="button"
        onClick={onOpenCalendar}
        className="min-h-[44px] self-start rounded-xl px-3 text-xs font-semibold text-[#006877] hover:underline focus-utility-ring cursor-pointer sm:self-auto"
      >
        Atur Kalender Target
      </button>
    </div>
  );
}
