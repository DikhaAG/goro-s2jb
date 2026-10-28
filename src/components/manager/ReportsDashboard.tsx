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
          <Link href={user.role === "PEGAWAI" ? "/operator/triage" : "/intake"}>
            <Button className="w-full bg-[#00a2b9] hover:bg-[#008b9e] text-white text-xs mt-2 min-h-[44px] h-11 font-semibold rounded-xl">
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
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Title Header with Export Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a] flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#006877]" />
              <span>Pusat Laporan Eksekutif & Intelijen Kinerja</span>
            </h1>
          </div>
          <p className="text-xs text-[#64748b] mt-1">
            Agregasi real-time seluruh unit pelaksana PLN UID S2JB dengan proteksi Target Immutability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="h-10 min-h-[40px] text-xs gap-2 bg-white border-[#cbd5e1] hover:border-[#16a34a] text-[#0f172a] hover:text-[#15803d] font-semibold rounded-xl shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#16a34a]" />
            <span>Ekspor Excel (.xlsx)</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPdf}
            className="h-10 min-h-[40px] text-xs gap-2 bg-white border-[#cbd5e1] hover:border-[#00a2b9] text-[#0f172a] hover:text-[#006877] font-semibold rounded-xl shadow-xs"
          >
            <Printer className="w-4 h-4 text-[#00a2b9]" />
            <span>Cetak PDF</span>
          </Button>
        </div>
      </div>

      {/* Executive KPI Overview Cards */}
      <ExecutiveKpiCards kpis={kpis} />

      {/* Global Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
        {/* Left Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("MONTHLY")}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer focus-utility-ring whitespace-nowrap ${
              activeTab === "MONTHLY"
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
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer focus-utility-ring whitespace-nowrap ${
              activeTab === "DAILY"
                ? "bg-[#e7eeff] text-[#006877] border border-[#cfdaf2] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Laporan Harian</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("H1")}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer focus-utility-ring whitespace-nowrap ${
              activeTab === "H1"
                ? "bg-[#e7eeff] text-[#006877] border border-[#cfdaf2] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <span>Laporan H-1</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CHARTS")}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer focus-utility-ring whitespace-nowrap ${
              activeTab === "CHARTS"
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

      {activeTab === "H1" && (
        <div>
          {h1Query.isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-2 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
              <Loader2 className="w-6 h-6 animate-spin text-[#00a2b9]" />
              <span className="text-xs text-[#64748b]">Memuat laporan H-1...</span>
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
    </div>
  );
}
