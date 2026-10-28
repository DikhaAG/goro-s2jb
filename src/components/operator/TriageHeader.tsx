"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Cpu, ShieldCheck } from "lucide-react";

interface TriageHeaderProps {
  operatorName?: string;
  operatorRole?: string;
  metrics: {
    yellowQueueCount: number;
    verifiedTodayCount: number;
    aiAutomationRate: number;
    totalReviewsCount?: number;
  };
}

export function TriageHeader({
  operatorName = "Petugas Verifikator",
  operatorRole = "PEGAWAI",
  metrics,
}: TriageHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Top Title & User Profile Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a] flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#006877]" />
              <span>Dasbor Verifikasi Triase Operator</span>
            </h1>
            <span className="bg-[#e7eeff] text-[#006877] border border-[#cfdaf2] text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Human-in-the-Loop
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-1">
            Peninjauan presisi untuk ulasan Zona Kuning (70% - 89.9%) dan eviden terindikasi manipulasi visual.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-[#e2e8f0] px-3.5 py-1.5 rounded-xl text-xs shadow-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-[#16a34a] animate-pulse" />
          <span className="text-[#0f172a] font-semibold">{operatorName}</span>
          <span className="text-[#64748b] font-mono text-[10px] uppercase">({operatorRole})</span>
        </div>
      </div>

      {/* Tactical Metric Cards (Command Bar) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Yellow Queue Count */}
        <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-2xl p-4 flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-semibold text-[#b45309] uppercase tracking-wider block">
              Antrean Zona Kuning
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-[#9a3412] font-mono">
                {metrics.yellowQueueCount.toLocaleString("id-ID")}
              </span>
              <span className="text-xs text-[#b45309]">perlu aksi</span>
            </div>
          </div>
          <div className="p-3 bg-white border border-[#fed7aa] rounded-xl text-[#b45309] shadow-xs">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Verified Today */}
        <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl p-4 flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-semibold text-[#15803d] uppercase tracking-wider block">
              Terverifikasi Hari Ini
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-[#166534] font-mono">
                {metrics.verifiedTodayCount.toLocaleString("id-ID")}
              </span>
              <span className="text-xs text-[#15803d]">oleh verifikator</span>
            </div>
          </div>
          <div className="p-3 bg-white border border-[#a7f3d0] rounded-xl text-[#16a34a] shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: AI Automation Rate */}
        <div className="bg-[#e7eeff] border border-[#cfdaf2] rounded-2xl p-4 flex items-center justify-between transition-colors">
          <div>
            <span className="text-xs font-semibold text-[#006877] uppercase tracking-wider block">
              Tingkat Otomasi AI
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-[#006877] font-mono">
                {metrics.aiAutomationRate}%
              </span>
              <span className="text-xs text-[#006877]">Hijau & Merah otonom</span>
            </div>
          </div>
          <div className="p-3 bg-white border border-[#cfdaf2] rounded-xl text-[#00a2b9] shadow-xs">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
