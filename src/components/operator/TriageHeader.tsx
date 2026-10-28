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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
              <span>Dasbor Verifikasi Triase Operator</span>
            </h1>
            <span className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider">
              Human-in-the-Loop
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Peninjauan presisi untuk ulasan Zona Kuning (70% - 89.9%) dan eviden terindikasi manipulasi visual.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-medium">{operatorName}</span>
          <span className="text-slate-500 font-mono text-[10px] uppercase">({operatorRole})</span>
        </div>
      </div>

      {/* Tactical Metric Cards (Command Bar) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Yellow Queue Count */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-amber-500/40 transition-colors">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Antrean Zona Kuning
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-400 font-mono">
                {metrics.yellowQueueCount.toLocaleString("id-ID")}
              </span>
              <span className="text-xs text-slate-500">perlu aksi</span>
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Metric 2: Verified Today */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-emerald-500/40 transition-colors">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Terverifikasi Hari Ini
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {metrics.verifiedTodayCount.toLocaleString("id-ID")}
              </span>
              <span className="text-xs text-slate-500">oleh verifikator</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        {/* Metric 3: AI Automation Rate */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-cyan-500/40 transition-colors">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Tingkat Otomasi AI
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-cyan-400 font-mono">
                {metrics.aiAutomationRate}%
              </span>
              <span className="text-xs text-slate-500">Hijau & Merah otonom</span>
            </div>
          </div>
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
            <Cpu className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
