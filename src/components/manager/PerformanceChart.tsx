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
    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
            <span>Grafik Komparasi Realisasi vs Target Kumulatif ULP</span>
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Perbandingan capaian riil (Teal) terhadap target bulanan (Abu-Abu) per unit
          </p>
        </div>

        {/* UP3 Filter Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b] font-semibold">Unit:</span>
          <select
            value={selectedUp3Id}
            onChange={(e) => setSelectedUp3Id(e.target.value)}
            className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-3 py-1.5 min-h-[38px] focus-utility-ring font-sans"
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
          <div className="w-3 h-3 rounded bg-[#00a2b9] shadow-xs" />
          <span className="text-[#0f172a]">Realisasi Kumulatif</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#cbd5e1]" />
          <span className="text-[#64748b]">Target Kumulatif</span>
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
                  stroke="#f1f5f9"
                  strokeDasharray="4 4"
                />
                <text
                  x="40"
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-[#94a3b8] font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {displayUlps.map((ulp, idx) => {
            const groupX = 55 + idx * (barWidth * 2 + gap);
            const targetHeight = (ulp.cumulativeTarget / maxVal) * chartHeight;
            const targetY = chartHeight - targetHeight + 20;

            const realHeight = (ulp.cumulativeRealization / maxVal) * chartHeight;
            const realY = chartHeight - realHeight + 20;

            return (
              <g key={ulp.ulpId} className="group/bar cursor-pointer">
                {/* Target Bar (Gray) */}
                <rect
                  x={groupX}
                  y={targetY}
                  width={barWidth}
                  height={targetHeight}
                  fill="#e2e8f0"
                  rx="3"
                  className="transition-colors hover:fill-[#cbd5e1]"
                />

                {/* Realization Bar (Teal) */}
                <rect
                  x={groupX + barWidth + 2}
                  y={realY}
                  width={barWidth}
                  height={realHeight}
                  fill="#00a2b9"
                  rx="3"
                  className="transition-colors hover:fill-[#008b9e]"
                />

                {/* X-axis Label (ULP Name) */}
                <text
                  x={groupX + barWidth}
                  y={chartHeight + 35}
                  textAnchor="end"
                  transform={`rotate(-45, ${groupX + barWidth}, ${chartHeight + 35})`}
                  className="text-[9px] fill-[#64748b] font-medium"
                >
                  {ulp.ulpName.replace("ULP ", "")}
                </text>

                {/* Tooltip on hover */}
                <title>
                  {`${ulp.ulpName}\nTarget: ${ulp.cumulativeTarget}\nRealisasi: ${ulp.cumulativeRealization} (${ulp.cumulativePercentage.toFixed(1)}%)`}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
