"use client";

import React from "react";
import { Award, AlertTriangle, TrendingUp, Calendar, Zap, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExecutiveKpiCardsProps {
  kpis: {
    totalCumulativeRealization: number;
    totalCumulativeTarget: number;
    cumulativeAchievementRate: number;
    dailyRealizationToday: number;
    dailyTargetToday: number;
    top3Ulps: Array<{
      ulpId: string;
      ulpName: string;
      up3Name: string;
      cumulativePercentage: number;
      cumulativeRealization: number;
    }>;
    bottom3Ulps: Array<{
      ulpId: string;
      ulpName: string;
      up3Name: string;
      cumulativePercentage: number;
      cumulativeRealization: number;
    }>;
  };
}

export function ExecutiveKpiCards({ kpis }: ExecutiveKpiCardsProps) {
  const isPass = kpis.cumulativeAchievementRate >= 100.0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Card 1: Total Realisasi Kumulatif UID */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-cyan-500/40 transition-colors shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Realisasi Kumulatif UID
          </span>
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-400 font-mono">
              {kpis.totalCumulativeRealization.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-slate-400">
              / {kpis.totalCumulativeTarget.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Badge variant={isPass ? "success" : "warning"} className="text-xs font-mono font-bold">
              {kpis.cumulativeAchievementRate.toFixed(1)}%
            </Badge>
            <span className="text-[11px] text-slate-500">Target Kumulatif Bulan Ini</span>
          </div>
        </div>
      </div>

      {/* Card 2: Realisasi Harian Hari Ini */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Realisasi Harian Hari Ini
          </span>
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {kpis.dailyRealizationToday.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-slate-400">
              / {kpis.dailyTargetToday.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Badge
              variant={
                kpis.dailyTargetToday > 0 &&
                (kpis.dailyRealizationToday / kpis.dailyTargetToday) * 100 >= 100
                  ? "success"
                  : "warning"
              }
              className="text-xs font-mono font-bold"
            >
              {kpis.dailyTargetToday > 0
                ? `${((kpis.dailyRealizationToday / kpis.dailyTargetToday) * 100).toFixed(1)}%`
                : "0.0%"}
            </Badge>
            <span className="text-[11px] text-slate-500">Capaian Hari Berjalan</span>
          </div>
        </div>
      </div>

      {/* Card 3: Leaderboard Top 3 ULP */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/40 transition-colors shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Top 3 ULP Tertinggi</span>
          </span>
        </div>
        <div className="space-y-1.5 mt-2">
          {kpis.top3Ulps.length > 0 ? (
            kpis.top3Ulps.map((ulp, idx) => (
              <div key={ulp.ulpId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-mono text-[10px] text-amber-400 font-bold w-3.5">
                    #{idx + 1}
                  </span>
                  <span className="text-slate-200 truncate font-medium">{ulp.ulpName}</span>
                </div>
                <span className="font-mono text-emerald-400 font-bold ml-2">
                  {ulp.cumulativePercentage.toFixed(1)}%
                </span>
              </div>
            ))
          ) : (
            <span className="text-xs text-slate-500 italic">Belum ada data</span>
          )}
        </div>
      </div>

      {/* Card 4: Underperforming Bottom 3 ULP */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-red-500/40 transition-colors shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>Perhatian Intervensi</span>
          </span>
        </div>
        <div className="space-y-1.5 mt-2">
          {kpis.bottom3Ulps.length > 0 ? (
            kpis.bottom3Ulps.map((ulp, idx) => (
              <div key={ulp.ulpId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-mono text-[10px] text-red-400 font-bold w-3.5">
                    #{idx + 1}
                  </span>
                  <span className="text-slate-200 truncate font-medium">{ulp.ulpName}</span>
                </div>
                <span className="font-mono text-red-400 font-bold ml-2">
                  {ulp.cumulativePercentage.toFixed(1)}%
                </span>
              </div>
            ))
          ) : (
            <span className="text-xs text-slate-500 italic">Belum ada data</span>
          )}
        </div>
      </div>
    </div>
  );
}
