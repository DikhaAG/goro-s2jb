"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ExecutiveKpiCards } from "./ExecutiveKpiCards";
import { ReportTableDaily } from "./ReportTableDaily";
import { ReportTableH1 } from "./ReportTableH1";
import { ReportTableMonthly } from "./ReportTableMonthly";
import { PerformanceChart } from "./PerformanceChart";
import { CumulativePacingChart } from "./CumulativePacingChart";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  Loader2,
  AlertOctagon,
  TrendingUp,
  BarChart3,
  ListOrdered,
} from "lucide-react";

type ReportTab = "DAILY" | "H1" | "MONTHLY" | "CHARTS";

export function ReportsDashboard() {
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

  const unitsQuery = trpc.master.getUnits.useQuery();
  const isAuthorized = user?.role === "MANAGER" || user?.role === "SUPER_ADMIN";

  // Report Queries
  const kpiQuery = trpc.report.getKpis.useQuery(
    { date: selectedDate },
    { enabled: isAuthorized }
  );

  const dailyQuery = trpc.report.getDaily.useQuery(
    { date: selectedDate, up3Id: selectedUp3Id || undefined },
    { enabled: isAuthorized && (activeTab === "DAILY" || activeTab === "CHARTS") }
  );

  const h1Query = trpc.report.getH1.useQuery(
    { date: selectedDate, up3Id: selectedUp3Id || undefined },
    { enabled: isAuthorized && activeTab === "H1" }
  );

  const monthlyQuery = trpc.report.getMonthly.useQuery(
    {
      year: selectedYear,
      month: selectedMonth,
      up3Id: selectedUp3Id || undefined,
      asOfDate: selectedDate,
    },
    { enabled: isAuthorized && (activeTab === "MONTHLY" || activeTab === "CHARTS") }
  );

  const pacingQuery = trpc.report.getPacing.useQuery(
    {
      year: selectedYear,
      month: selectedMonth,
      up3Id: selectedUp3Id || undefined,
    },
    { enabled: isAuthorized && activeTab === "CHARTS" }
  );

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
      <div className="min-h-screen flex items-center justify-center bg-[#070b13] text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (user && user.role !== "MANAGER" && user.role !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b13] p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-full w-14 h-14 mx-auto flex items-center justify-center text-red-400">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Akses Ditolak (403 Forbidden)</h2>
            <p className="text-xs text-slate-400 mt-1">
              Modul Laporan Eksekutif khusus diperuntukkan bagi Role Manager Wilayah atau Super Admin.
              Akun Anda terdaftar sebagai <span className="text-amber-400 font-mono">{user.role}</span>.
            </p>
          </div>
          <Link href={user.role === "PEGAWAI" ? "/triage" : "/intake"}>
            <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs mt-2">
              Kembali ke Modul {user.role === "PEGAWAI" ? "Verifikator Triase" : "Entri Eviden"}
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
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Kembali ke Beranda"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs">
              📊
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide text-white">
                GORO S2JB <span className="text-cyan-400">2026</span>
              </span>
              <span className="text-xs text-slate-400 ml-2 font-mono">/ Executive Reports</span>
            </div>
          </div>
        </div>

        {/* Export Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="h-8 text-xs gap-1.5 bg-slate-900 border-slate-700 hover:border-emerald-500 text-slate-200 hover:text-emerald-300 font-medium"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ekspor Excel (.xlsx)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPdf}
            className="h-8 text-xs gap-1.5 bg-slate-900 border-slate-700 hover:border-cyan-500 text-slate-200 hover:text-cyan-300 font-medium"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cetak PDF</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              <span>Pusat Laporan Eksekutif & Intelijen Kinerja</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Agregasi real-time seluruh unit pelaksana PLN UID S2JB dengan proteksi Target Immutability.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400">Pengguna:</span>
            <span className="text-slate-200 font-semibold">{user?.name || "Manager Wilayah"}</span>
            <span className="text-cyan-400 font-mono text-[10px] uppercase">({user?.role || "MANAGER"})</span>
          </div>
        </div>

        {/* Executive KPI Overview Cards */}
        <ExecutiveKpiCards kpis={kpis} />

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
          {/* Left Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab("MONTHLY")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "MONTHLY"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Laporan Bulanan</span>
            </button>

            <button
              onClick={() => setActiveTab("DAILY")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "DAILY"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Laporan Harian</span>
            </button>

            <button
              onClick={() => setActiveTab("H1")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "H1"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Laporan H-1</span>
            </button>

            <button
              onClick={() => setActiveTab("CHARTS")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "CHARTS"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Grafik & Pacing</span>
            </button>
          </div>

          {/* Right Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Filter UP3:</span>
              <select
                value={selectedUp3Id}
                onChange={(e) => setSelectedUp3Id(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Semua UP3 (UID S2JB)</option>
                {unitsQuery.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span>Posisi Tanggal:</span>
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
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "MONTHLY" && (
          <div>
            {monthlyQuery.isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-2 bg-slate-900/40 border border-slate-800 rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400">Memuat laporan bulanan kumulatif...</span>
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
              <div className="h-64 flex flex-col items-center justify-center space-y-2 bg-slate-900/40 border border-slate-800 rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400">Memuat laporan harian...</span>
              </div>
            ) : dailyQuery.data ? (
              <ReportTableDaily
                groups={dailyQuery.data.groups}
                grandTotal={dailyQuery.data.grandTotal}
              />
            ) : null}
          </div>
        )}

        {activeTab === "H1" && (
          <div>
            {h1Query.isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-2 bg-slate-900/40 border border-slate-800 rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400">Memuat laporan H-1...</span>
              </div>
            ) : h1Query.data ? (
              <ReportTableH1
                groups={h1Query.data.groups}
                grandTotal={h1Query.data.grandTotal}
                h1Date={h1Query.data.targetDate}
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
      </main>
    </div>
  );
}
