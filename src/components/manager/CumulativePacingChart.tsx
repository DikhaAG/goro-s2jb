"use client";

import React, { useState } from "react";

interface PacingPoint {
  day: number;
  dateLabel: string;
  targetCumulative: number;
  actualCumulative: number | null;
}

interface CumulativePacingChartProps {
  pacingData: {
    year: number;
    month: number;
    totalCumulativeTarget: number;
    totalDaysInMonth: number;
    points: PacingPoint[];
  };
}

export function CumulativePacingChart({ pacingData }: CumulativePacingChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<PacingPoint | null>(null);

  const { points, totalCumulativeTarget, totalDaysInMonth } = pacingData;
  const maxVal = Math.max(totalCumulativeTarget * 1.1, 100);

  const width = 800;
  const height = 280;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 40;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  // Scale functions
  const getX = (day: number) => paddingLeft + ((day - 1) / (totalDaysInMonth - 1)) * innerWidth;
  const getY = (val: number) => height - paddingBottom - (val / maxVal) * innerHeight;

  // Construct target path (dashed line)
  const targetPath = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${getX(p.day)} ${getY(p.targetCumulative)}`)
    .join(" ");

  // Construct actual path (only for points where actualCumulative !== null)
  const actualPoints = points.filter((p) => p.actualCumulative !== null);
  const actualPath = actualPoints
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${getX(p.day)} ${getY(p.actualCumulative!)}`)
    .join(" ");

  // Construct area fill under actual line
  const areaPath =
    actualPoints.length > 0
      ? `${actualPath} L ${getX(actualPoints[actualPoints.length - 1].day)} ${height - paddingBottom} L ${getX(1)} ${height - paddingBottom} Z`
      : "";

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
            <span>Kurva Laju Kumulatif Bulanan (Pacing Curve)</span>
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Trayektori riil harian (Teal) vs garis linier target bulanan (Amber Putus-Putus)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-1 bg-[#00a2b9] rounded" />
            <span className="text-[#0f172a]">Realisasi Riil</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-1 border-t-2 border-dashed border-[#d97706]" />
            <span className="text-[#64748b]">Target Linier</span>
          </div>
        </div>
      </div>

      {/* Hover Info Banner */}
      <div className="h-7 flex items-center text-xs">
        {hoveredPoint ? (
          <div className="flex items-center gap-3 bg-[#f8fafc] border border-[#e2e8f0] px-3 py-1 rounded-xl text-[#0f172a] shadow-xs">
            <span className="font-semibold text-[#006877]">{hoveredPoint.dateLabel}</span>
            <span>Target: <strong className="font-mono">{hoveredPoint.targetCumulative.toLocaleString("id-ID")}</strong></span>
            <span>
              Realisasi:{" "}
              <strong className="font-mono text-[#15803d]">
                {hoveredPoint.actualCumulative !== null
                  ? hoveredPoint.actualCumulative.toLocaleString("id-ID")
                  : "-"}
              </strong>
            </span>
            {hoveredPoint.actualCumulative !== null && (
              <span
                className={`font-semibold ${
                  hoveredPoint.actualCumulative >= hoveredPoint.targetCumulative
                    ? "text-[#15803d]"
                    : "text-[#b45309]"
                }`}
              >
                ({((hoveredPoint.actualCumulative / (hoveredPoint.targetCumulative || 1)) * 100).toFixed(1)}%)
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 italic">Arahkan kursor ke titik kurva untuk melihat detail</span>
        )}
      </div>

      {/* Chart SVG Canvas */}
      <div className="overflow-x-auto pb-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[700px]"
          style={{ maxHeight: "300px" }}
        >
          {/* Subtle Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = height - paddingBottom - pct * innerHeight;
            const val = Math.round(pct * maxVal);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-[#94a3b8] font-mono"
                >
                  {val.toLocaleString("id-ID")}
                </text>
              </g>
            );
          })}

          {/* Area under actual path */}
          {areaPath && (
            <path
              d={areaPath}
              fill="rgba(0, 162, 185, 0.08)"
            />
          )}

          {/* Target Linier Path (Dashed Amber) */}
          <path
            d={targetPath}
            fill="none"
            stroke="#d97706"
            strokeWidth="2"
            strokeDasharray="5 5"
          />

          {/* Actual Realization Path (Teal Solid) */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="#00a2b9"
              strokeWidth="2.5"
            />
          )}

          {/* Data Points */}
          {points.map((p) => {
            const cx = getX(p.day);
            const cy = p.actualCumulative !== null ? getY(p.actualCumulative) : null;
            const isHovered = hoveredPoint?.day === p.day;

            return (
              <g key={p.day}>
                {/* Vertical hover guide */}
                {isHovered && (
                  <line
                    x1={cx}
                    y1={paddingTop}
                    x2={cx}
                    y2={height - paddingBottom}
                    stroke="#00a2b9"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Actual Realization Circle */}
                {cy !== null && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? "5" : "3.5"}
                    fill="#00a2b9"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="transition-all cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(p)}
                  />
                )}

                {/* Invisible larger hover hit area */}
                <rect
                  x={cx - innerWidth / totalDaysInMonth / 2}
                  y={paddingTop}
                  width={innerWidth / totalDaysInMonth}
                  height={innerHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* X-axis Day labels (every 5 days and last day) */}
                {(p.day === 1 || p.day % 5 === 0 || p.day === totalDaysInMonth) && (
                  <text
                    x={cx}
                    y={height - paddingBottom + 16}
                    textAnchor="middle"
                    className="text-[10px] fill-[#64748b] font-mono"
                  >
                    Tgl {p.day}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
