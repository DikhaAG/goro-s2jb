"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ExecutiveKpiCards } from "./ExecutiveKpiCards";
import { ReportTableDaily } from "./ReportTableDaily";
import { ReportTableMonthly } from "./ReportTableMonthly";
import { PerformanceChart } from "./PerformanceChart";
import { CumulativePacingChart } from "./CumulativePacingChart";
import { TargetSettingsModal } from "./TargetSettingsModal";
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
  Activity,
  Database,
  Clock,
  ArrowRight,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ReportTab = "MONTHLY" | "DAILY" | "CHARTS";

export function ReportsDashboard() {
  const utils = trpc.useUtils();
  const sessionQuery = trpc.auth.getSession.useQuery();
  const user = sessionQuery.data;

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState<string>(
    now.toISOString().split("T")[0]
  );
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedUp3Id, setSelectedUp3Id] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ReportTab>("MONTHLY");
  const [isTargetSettingsOpen, setIsTargetSettingsOpen] = useState<boolean>(false);

  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(now);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [dismissedBatchId, setDismissedBatchId] = useState<string | null>(null);
  const prevSyncTimestampRef = useRef<string | null>(null);

  const unitsQuery = trpc.master.getUnits.useQuery();
  const isAuthorized = user?.role === "MANAGER" || user?.role === "SUPER_ADMIN";

  // Watch migration completion and new reviews sync status in real time
  const syncStatusQuery = trpc.report.getSyncStatus.useQuery(undefined, {
    enabled: isAuthorized,
    refetchInterval: 3000,
  });

  // Automatically invalidate and update report data when an import completes or reviews are updated
  useEffect(() => {
    if (!syncStatusQuery.data) return;
    const currentSync = syncStatusQuery.data.lastSyncTimestamp;
    if (prevSyncTimestampRef.current && prevSyncTimestampRef.current !== currentSync) {
      utils.report.getKpis.invalidate();
      utils.report.getDaily.invalidate();
      utils.report.getMonthly.invalidate();
      utils.report.getPacing.invalidate();
      setLastRefreshedAt(new Date());
    }
    prevSyncTimestampRef.current = currentSync;
  }, [syncStatusQuery.data?.lastSyncTimestamp, utils]);

  // Report Queries with background auto-refresh
  const kpiQuery = trpc.report.getKpis.useQuery(
    { date: selectedDate },
    { enabled: isAuthorized, refetchInterval: 10000 }
  );

  const dailyQuery = trpc.report.getDaily.useQuery(
    { date: selectedDate, up3Id: selectedUp3Id || undefined },
    { enabled: isAuthorized && (activeTab === "DAILY" || activeTab === "CHARTS"), refetchInterval: 10000 }
  );

  const monthlyQuery = trpc.report.getMonthly.useQuery(
    {
      year: selectedYear,
      month: selectedMonth,
      up3Id: selectedUp3Id || undefined,
      asOfDate: selectedDate,
    },
    { enabled: isAuthorized && (activeTab === "MONTHLY" || activeTab === "CHARTS"), refetchInterval: 10000 }
  );

  const pacingQuery = trpc.report.getPacing.useQuery(
    {
      year: selectedYear,
      month: selectedMonth,
      up3Id: selectedUp3Id || undefined,
    },
    { enabled: isAuthorized && activeTab === "CHARTS", refetchInterval: 10000 }
  );

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      kpiQuery.refetch(),
      dailyQuery.refetch(),
      monthlyQuery.refetch(),
      pacingQuery.refetch(),
      syncStatusQuery.refetch(),
    ]);
    setLastRefreshedAt(new Date());
    setIsRefreshing(false);
  };

  const handleJumpToLatestDate = () => {
    if (!syncStatusQuery.data?.latestApprovedReviewDate) return;
    const latestDateStr = syncStatusQuery.data.latestApprovedReviewDate.split("T")[0];
    setSelectedDate(latestDateStr);
    const d = new Date(latestDateStr);
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth() + 1);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const latestBatch = syncStatusQuery.data?.latestBatch;
  const isRecentBatch =
    latestBatch &&
    latestBatch.status === "COMPLETED" &&
    latestBatch.id !== dismissedBatchId &&
    latestBatch.completedAt &&
    Date.now() - new Date(latestBatch.completedAt).getTime() < 1000 * 60 * 30;

  const latestApprovedDateStr = syncStatusQuery.data?.latestApprovedReviewDate
    ? syncStatusQuery.data.latestApprovedReviewDate.split("T")[0]
    : null;
  const showDateSuggestion =
    latestApprovedDateStr &&
    latestApprovedDateStr !== selectedDate &&
    (dailyQuery.data?.grandTotal.dailyRealization === 0 || kpiQuery.data?.dailyRealizationToday === 0);

  const handleExportExcel = () => {
    let url = `/api/export/excel?date=${selectedDate}&year=${selectedYear}&month=${selectedMonth}`;
    if (selectedUp3Id) url += `&up3Id=${selectedUp3Id}`;
    window.open(url, "_blank");
  };

  const handleExportPdf = () => {
    let url = `/api/export/pdf?date=${selectedDate}&year=${selectedYear}&month=${selectedMonth}`;
    if (selectedUp3Id) url += `&up3Id=${selectedUp3Id}`;
    window.open(url, "_blank");
  };

  // RBAC Access Control Guard
  if (sessionQuery.isLoading) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center text-[#64748b]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00a2b9]" />
      </div>
    );
  }

  if (user && user.role !== "MANAGER" && user.role !== "SUPER_ADMIN") {
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

  const kpis = kpiQuery.data || {
    totalCumulativeRealization: 0,
    totalCumulativeTarget: 0,
    cumulativeAchievementRate: 0,
    dailyRealizationToday: 0,
    dailyTargetToday: 0,
    top3Ulps: [],
    bottom3Ulps: [],
  };

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
              <span>Terakhir disinkronkan: {formatTime(lastRefreshedAt)}</span>
            </span>

            {syncStatusQuery.data?.totalApprovedCount !== undefined && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f0fdfa] text-[#006877] border border-[#bae6fd] text-xs font-semibold">
                <Database className="w-3.5 h-3.5 text-[#00a2b9]" />
                <span>{syncStatusQuery.data.totalApprovedCount.toLocaleString("id-ID")} Ulasan Terverifikasi</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsTargetSettingsOpen(true)}
            className="h-9 min-h-[36px] text-xs gap-2 bg-white border-slate-200 hover:border-teal-600 text-slate-700 hover:text-teal-700 font-medium rounded-xl shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
            title="Atur target kuota harian kerja dan akhir pekan"
          >
            <Sliders className="w-4 h-4 text-teal-600" />
            <span>Atur Target</span>
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
            onClick={handleExportExcel}
            className="h-9 min-h-[36px] text-xs gap-2 bg-white border-slate-200 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 font-medium rounded-xl shadow-sm transition-all active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor Excel (.xlsx)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPdf}
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
                <strong className="text-[#0f172a]">{formatDateDisplay(latestApprovedDateStr)}</strong>.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleJumpToLatestDate}
            className="min-h-[36px] px-3.5 py-1.5 bg-[#006877] hover:bg-[#00525e] text-white font-bold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0 focus-utility-ring"
          >
            <span>Buka Periode Ini</span>
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      )}

      {/* Executive KPI Overview Cards */}
      <ExecutiveKpiCards kpis={kpis} />

      {/* Global Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
        {/* Left Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("MONTHLY")}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer focus-utility-ring whitespace-nowrap ${activeTab === "MONTHLY"
                ? "bg-[#e7eeff] text-[#006877] border border-[#cfdaf2] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
              }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Laporan Bulanan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("DAILY")}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer focus-utility-ring whitespace-nowrap ${activeTab === "DAILY"
                ? "bg-[#e7eeff] text-[#006877] border border-[#cfdaf2] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
              }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Laporan Harian</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CHARTS")}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer focus-utility-ring whitespace-nowrap ${activeTab === "CHARTS"
                ? "bg-[#e7eeff] text-[#006877] border border-[#cfdaf2] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
              }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Grafik & Pacing</span>
          </button>
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
                const val = e.target.value;
                setSelectedDate(val);
                if (val) {
                  const d = new Date(val);
                  setSelectedYear(d.getFullYear());
                  setSelectedMonth(d.getMonth() + 1);
                }
              }}
              className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-2.5 py-1.5 min-h-[38px] focus-utility-ring"
            />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "MONTHLY" && (
        <div>
          {monthlyQuery.isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-2 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
              <Loader2 className="w-6 h-6 animate-spin text-[#00a2b9]" />
              <span className="text-xs text-[#64748b]">Memuat laporan bulanan kumulatif...</span>
            </div>
          ) : monthlyQuery.data ? (
            <ReportTableMonthly
              groups={monthlyQuery.data.groups}
              grandTotal={monthlyQuery.data.grandTotal}
            />
          ) : null}
        </div>
      )}

      {activeTab === "DAILY" && (
        <div>
          {dailyQuery.isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-2 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
              <Loader2 className="w-6 h-6 animate-spin text-[#00a2b9]" />
              <span className="text-xs text-[#64748b]">Memuat laporan harian...</span>
            </div>
          ) : dailyQuery.data ? (
            <ReportTableDaily
              groups={dailyQuery.data.groups}
              grandTotal={dailyQuery.data.grandTotal}
            />
          ) : null}
        </div>
      )}

      {activeTab === "CHARTS" && (
        <div className="space-y-4">
          {monthlyQuery.data && (
            <PerformanceChart groups={monthlyQuery.data.groups} />
          )}

          {pacingQuery.data && (
            <CumulativePacingChart pacingData={pacingQuery.data} />
          )}
        </div>
      )}

      {/* Target Settings Configuration Modal */}
      <TargetSettingsModal
        isOpen={isTargetSettingsOpen}
        onClose={() => setIsTargetSettingsOpen(false)}
      />
    </div>
  );
}
