"use client";

import React from "react";
import { Award, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total Realisasi Kumulatif UID */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
            Realisasi Kumulatif UID
          </span>
          <div className="p-2 bg-[#e7eeff] border border-[#cfdaf2] rounded-xl text-[#006877]">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0f172a] font-mono">
              {kpis.totalCumulativeRealization.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-[#64748b]">
              / {kpis.totalCumulativeTarget.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#f1f5f9]">
            <Badge variant={isPass ? "success" : "warning"} className="text-xs font-mono font-bold">
              {kpis.cumulativeAchievementRate.toFixed(1)}%
            </Badge>
            <span className="text-[11px] text-[#64748b]">Target Kumulatif Bulan Ini</span>
          </div>
        </div>
      </div>

      {/* Card 2: Realisasi Harian Hari Ini */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
            Realisasi Harian Hari Ini
          </span>
          <div className="p-2 bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl text-[#16a34a]">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0f172a] font-mono">
              {kpis.dailyRealizationToday.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-[#64748b]">
              / {kpis.dailyTargetToday.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#f1f5f9]">
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
            <span className="text-[11px] text-[#64748b]">Capaian Hari Berjalan</span>
          </div>
        </div>
      </div>

      {/* Card 3: Leaderboard Top 3 ULP */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#b45309]" />
            <span>Top 3 ULP Tertinggi</span>
          </span>
        </div>
        <div className="space-y-2 mt-3 pt-2 border-t border-[#f1f5f9]">
          {kpis.top3Ulps.length > 0 ? (
            kpis.top3Ulps.map((ulp, idx) => (
              <div key={ulp.ulpId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-mono text-[10px] text-[#b45309] font-bold w-4">
                    #{idx + 1}
                  </span>
                  <span className="text-[#0f172a] truncate font-medium">{ulp.ulpName}</span>
                </div>
                <span className="font-mono text-[#15803d] font-bold ml-2">
                  {ulp.cumulativePercentage.toFixed(1)}%
                </span>
              </div>
            ))
          ) : (
            <span className="text-xs text-[#94a3b8] italic">Belum ada data</span>
          )}
        </div>
      </div>

      {/* Card 4: Underperforming Bottom 3 ULP */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-[#b91c1c]" />
            <span>Perhatian Intervensi</span>
          </span>
        </div>
        <div className="space-y-2 mt-3 pt-2 border-t border-[#f1f5f9]">
          {kpis.bottom3Ulps.length > 0 ? (
            kpis.bottom3Ulps.map((ulp, idx) => (
              <div key={ulp.ulpId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-mono text-[10px] text-[#b91c1c] font-bold w-4">
                    #{idx + 1}
                  </span>
                  <span className="text-[#0f172a] truncate font-medium">{ulp.ulpName}</span>
                </div>
                <span className="font-mono text-[#b91c1c] font-bold ml-2">
                  {ulp.cumulativePercentage.toFixed(1)}%
                </span>
              </div>
            ))
          ) : (
            <span className="text-xs text-[#94a3b8] italic">Belum ada data</span>
          )}
        </div>
      </div>
    </div>
  );
}
