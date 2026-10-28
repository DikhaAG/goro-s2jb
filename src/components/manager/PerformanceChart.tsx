"use client";

import React, { useState } from "react";
import { Up3GroupMonthly } from "@/server/services/reportService";

interface PerformanceChartProps {
  groups: Up3GroupMonthly[];
}

export function PerformanceChart({ groups }: PerformanceChartProps) {
  const [selectedUp3Id, setSelectedUp3Id] = useState<string>("ALL");

  const displayUlps = React.useMemo(() => {
    if (selectedUp3Id === "ALL") {
      return groups.flatMap((g) => g.ulps);
    }
    const found = groups.find((g) => g.up3Id === selectedUp3Id);
    return found ? found.ulps : [];
  }, [groups, selectedUp3Id]);

  const maxVal = React.useMemo(() => {
    let max = 100;
    for (const u of displayUlps) {
      if (u.cumulativeTarget > max) max = u.cumulativeTarget;
      if (u.cumulativeRealization > max) max = u.cumulativeRealization;
    }
    return Math.ceil(max * 1.15);
  }, [displayUlps]);

  const chartHeight = 260;
  const barWidth = 14;
  const gap = 18;
  const chartWidth = Math.max(displayUlps.length * (barWidth * 2 + gap) + 60, 600);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>Grafik Komparasi Realisasi vs Target Kumulatif ULP</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Perbandingan capaian riil (Cyan) terhadap target bulanan (Slate) per unit
          </p>
        </div>

        {/* UP3 Filter Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Unit:</span>
          <select
            value={selectedUp3Id}
            onChange={(e) => setSelectedUp3Id(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-sans"
          >
            <option value="ALL">Semua UP3 (Seluruh ULP)</option>
            {groups.map((g) => (
              <option key={g.up3Id} value={g.up3Id}>
                {g.up3Name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs font-medium">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-cyan-400 shadow-sm" />
          <span className="text-slate-300">Realisasi Kumulatif</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-700" />
          <span className="text-slate-400">Target Kumulatif</span>
        </div>
      </div>

      {/* SVG Scrollable Container */}
      <div className="overflow-x-auto pb-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 60}`}
          className="w-full h-auto min-w-[600px]"
          style={{ maxHeight: "320px" }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = chartHeight - pct * chartHeight + 20;
            const val = Math.round(pct * maxVal);
            return (
              <g key={idx}>
                <line
                  x1="45"
                  y1={y}
                  x2={chartWidth - 10}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                />
                <text
                  x="40"
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {displayUlps.map((ulp, idx) => {
            const x = 55 + idx * (barWidth * 2 + gap);
            const targetHeight = (ulp.cumulativeTarget / maxVal) * chartHeight;
            const realHeight = (ulp.cumulativeRealization / maxVal) * chartHeight;
            const targetY = chartHeight - targetHeight + 20;
            const realY = chartHeight - realHeight + 20;
            const isPass = ulp.cumulativePercentage >= 100;

            return (
              <g key={ulp.ulpId} className="group/bar cursor-pointer">
                {/* Target Bar (Background / Slate) */}
                <rect
                  x={x}
                  y={targetY}
                  width={barWidth}
                  height={targetHeight}
                  fill="#334155"
                  rx="2"
                  className="transition-all hover:fill-slate-600"
                >
                  <title>
                    {ulp.ulpName} - Target: {ulp.cumulativeTarget.toLocaleString("id-ID")}
                  </title>
                </rect>

                {/* Realization Bar (Foreground / Cyan) */}
                <rect
                  x={x + barWidth + 2}
                  y={realY}
                  width={barWidth}
                  height={realHeight}
                  fill={isPass ? "#10b981" : "#00a3e0"}
                  rx="2"
                  className="transition-all hover:opacity-90"
                >
                  <title>
                    {ulp.ulpName} - Realisasi: {ulp.cumulativeRealization.toLocaleString("id-ID")} (
                    {ulp.cumulativePercentage.toFixed(1)}%)
                  </title>
                </rect>

                {/* Percentage label on top of realization */}
                <text
                  x={x + barWidth + 2 + barWidth / 2}
                  y={realY - 5}
                  textAnchor="middle"
                  fill={isPass ? "#34d399" : "#38bdf8"}
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {Math.round(ulp.cumulativePercentage)}%
                </text>

                {/* ULP Label (Rotated) */}
                <text
                  x={x + barWidth}
                  y={chartHeight + 35}
                  textAnchor="end"
                  transform={`rotate(-40 ${x + barWidth} ${chartHeight + 35})`}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="sans-serif"
                >
                  {ulp.ulpName.replace("ULP ", "")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
