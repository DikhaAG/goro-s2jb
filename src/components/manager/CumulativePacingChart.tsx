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
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>Kurva Laju Kumulatif Bulanan (Pacing Curve)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Trayektori riil harian (Cyan) vs garis linier target bulanan (Amber Dashed)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-1 bg-cyan-400 rounded" />
            <span className="text-slate-300">Realisasi Riil</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-1 border-t-2 border-dashed border-amber-400" />
            <span className="text-slate-400">Target Linier</span>
          </div>
        </div>
      </div>

      {/* Hover Info Banner */}
      <div className="h-7 flex items-center text-xs">
        {hoveredPoint ? (
          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-3 py-1 rounded-md text-slate-200">
            <span className="font-semibold text-cyan-400">{hoveredPoint.dateLabel}</span>
            <span>Target: <strong className="font-mono">{hoveredPoint.targetCumulative.toLocaleString("id-ID")}</strong></span>
            <span>
              Realisasi:{" "}
              <strong className="font-mono text-emerald-400">
                {hoveredPoint.actualCumulative !== null
                  ? hoveredPoint.actualCumulative.toLocaleString("id-ID")
                  : "-"}
              </strong>
            </span>
            {hoveredPoint.actualCumulative !== null && (
              <span
                className={`font-semibold ${
                  hoveredPoint.actualCumulative >= hoveredPoint.targetCumulative
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                ({hoveredPoint.actualCumulative >= hoveredPoint.targetCumulative ? "Surplus" : "Defisit"}{" "}
                {Math.abs(hoveredPoint.actualCumulative - hoveredPoint.targetCumulative).toLocaleString("id-ID")})
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-500 text-xs italic">
            Arahkan kursor ke titik kurva untuk melihat rincian capaian harian
          </span>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[650px]"
          style={{ maxHeight: "300px" }}
        >
          <defs>
            <linearGradient id="cyanArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00a3e0" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00a3e0" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
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
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {val.toLocaleString("id-ID")}
                </text>
              </g>
            );
          })}

          {/* X Axis ticks */}
          {points.map((p, idx) => {
            if (p.day === 1 || p.day % 5 === 0 || p.day === totalDaysInMonth) {
              const x = getX(p.day);
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={height - paddingBottom}
                    x2={x}
                    y2={height - paddingBottom + 5}
                    stroke="#475569"
                  />
                  <text
                    x={x}
                    y={height - paddingBottom + 18}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    H-{p.day}
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* Area under actual path */}
          {areaPath && <path d={areaPath} fill="url(#cyanArea)" />}

          {/* Target Dashed Line */}
          <path
            d={targetPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.85"
          />

          {/* Actual Line */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="#00a3e0"
              strokeWidth="2.5"
              className="drop-shadow-[0_0_8px_rgba(0,163,224,0.5)]"
            />
          )}

          {/* Interactive Data Points on Actual Line */}
          {actualPoints.map((p) => {
            const cx = getX(p.day);
            const cy = getY(p.actualCumulative!);
            const isHovered = hoveredPoint?.day === p.day;

            return (
              <g
                key={p.day}
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? "6" : "3.5"}
                  fill={isHovered ? "#38bdf8" : "#00a3e0"}
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
