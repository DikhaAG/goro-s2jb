"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Activity,
  Wifi,
  Clock,
  TrendingUp,
  Layers,
  Zap,
  BarChart2,
  RefreshCw,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

export interface NetworkTrafficPoint {
  timestamp: number;
  rateKbps: number;
  bytesDelta: number;
  latencyMs: number;
  requestsCount: number;
  label?: string;
  completedCount?: number;
  failedCount?: number;
}

export type TimeRangeType = "HOUR" | "DAY" | "MONTH" | "YEAR";
export type HourSubMode = "live" | "24h";

interface NetworkTrafficChartProps {
  timeSeries?: NetworkTrafficPoint[];
  currentRateKbps?: number;
  averageLatencyMs?: number;
  isStreaming?: boolean;
  defaultRange?: TimeRangeType;
  className?: string;
}

type MetricType = "rate" | "latency" | "requests";

export function NetworkTrafficChart({
  timeSeries = [],
  currentRateKbps,
  averageLatencyMs,
  isStreaming = false,
  defaultRange = "HOUR",
  className,
}: NetworkTrafficChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("rate");
  const [timeRange, setTimeRange] = useState<TimeRangeType>(defaultRange);
  const [hourSubMode, setHourSubMode] = useState<HourSubMode>(isStreaming ? "live" : "24h");
  const [hoveredPoint, setHoveredPoint] = useState<NetworkTrafficPoint | null>(null);

  // Maintain sliding window buffer of up to 30 points for live mode
  const [buffer, setBuffer] = useState<NetworkTrafficPoint[]>([]);

  // Clear hover when switching ranges
  useEffect(() => {
    setHoveredPoint(null);
  }, [timeRange, hourSubMode]);

  useEffect(() => {
    if (timeSeries && timeSeries.length > 0) {
      setBuffer((prev) => {
        const map = new Map<number, NetworkTrafficPoint>();
        prev.forEach((pt) => {
          if (pt?.timestamp) map.set(pt.timestamp, pt);
        });
        timeSeries.forEach((pt) => {
          if (pt?.timestamp) map.set(pt.timestamp, pt);
        });
        const merged = Array.from(map.values())
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-30);
        return merged;
      });
    }
  }, [timeSeries]);

  const isLiveMode = timeRange === "HOUR" && hourSubMode === "live";

  // Historical data query for non-live modes
  const historyQuery = trpc.migration.getNetworkTrafficHistory.useQuery(
    { timeRange },
    {
      enabled: !isLiveMode,
      refetchInterval: timeRange === "HOUR" ? 15000 : 60000,
    }
  );

  const points: NetworkTrafficPoint[] = useMemo(() => {
    if (isLiveMode) {
      return buffer.length > 0 ? buffer : timeSeries;
    }
    return historyQuery.data?.points || [];
  }, [isLiveMode, buffer, timeSeries, historyQuery.data?.points]);

  // Compute peak and aggregate metrics defensively
  const peakRateKbps = useMemo(() => {
    if (!isLiveMode && historyQuery.data?.summary?.peakRateKbps !== undefined) {
      return historyQuery.data.summary.peakRateKbps;
    }
    if (!points || points.length === 0) return 0;
    return Math.max(...points.map((p) => p.rateKbps || 0), 0);
  }, [isLiveMode, historyQuery.data?.summary?.peakRateKbps, points]);

  const latestRateKbps = useMemo(() => {
    if (typeof currentRateKbps === "number" && currentRateKbps > 0) {
      return currentRateKbps;
    }
    if (points && points.length > 0) {
      return points[points.length - 1]?.rateKbps || 0;
    }
    return 0;
  }, [currentRateKbps, points]);

  const latestLatencyMs = useMemo(() => {
    if (!isLiveMode && historyQuery.data?.summary?.averageLatencyMs !== undefined) {
      return historyQuery.data.summary.averageLatencyMs;
    }
    if (typeof averageLatencyMs === "number" && averageLatencyMs > 0) {
      return averageLatencyMs;
    }
    if (points && points.length > 0) {
      return points[points.length - 1]?.latencyMs || 0;
    }
    return 0;
  }, [isLiveMode, historyQuery.data?.summary?.averageLatencyMs, averageLatencyMs, points]);

  const historicalTotalRequests = useMemo(() => {
    if (historyQuery.data?.summary?.totalRequests !== undefined) {
      return historyQuery.data.summary.totalRequests;
    }
    if (!points) return 0;
    return points.reduce((acc, p) => acc + (p.requestsCount || 0), 0);
  }, [historyQuery.data?.summary?.totalRequests, points]);

  const historicalTotalBytes = useMemo(() => {
    if (historyQuery.data?.summary?.totalBytes !== undefined) {
      return historyQuery.data.summary.totalBytes;
    }
    if (!points) return 0;
    return points.reduce((acc, p) => acc + (p.bytesDelta || 0), 0);
  }, [historyQuery.data?.summary?.totalBytes, points]);

  // Format helpers
  const formatRate = (kbps: number) => {
    if (kbps >= 1024) {
      return `${(kbps / 1024).toFixed(2)} MB/s`;
    }
    return `${Math.round(kbps)} KB/s`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatTime = (ts: number) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toTimeString().split(" ")[0]; // HH:mm:ss
  };

  // Dimensions for responsive SVG canvas
  const width = 800;
  const height = 240;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  // Extract values based on selected metric
  const metricValues = useMemo(() => {
    if (!points || points.length === 0) return [0];
    switch (selectedMetric) {
      case "rate":
        return points.map((p) => p.rateKbps || 0);
      case "latency":
        return points.map((p) => p.latencyMs || 0);
      case "requests":
        return points.map((p) => p.requestsCount || 0);
    }
  }, [points, selectedMetric]);

  const maxValRaw = Math.max(...metricValues, 1);
  const maxVal = Math.ceil(maxValRaw * 1.15) || 10;

  // Coordinate projections - STRICTLY empty array when points.length === 0 to prevent undefined point
  const coordinates = useMemo(() => {
    if (!points || points.length === 0) {
      return [];
    }
    if (points.length === 1) {
      const val =
        selectedMetric === "rate"
          ? points[0].rateKbps || 0
          : selectedMetric === "latency"
          ? points[0].latencyMs || 0
          : points[0].requestsCount || 0;
      const y = height - paddingBottom - (val / maxVal) * innerHeight;
      return [{ x: paddingLeft + innerWidth / 2, y, point: points[0], val }];
    }

    return points.map((p, idx) => {
      const x = paddingLeft + (idx / (points.length - 1)) * innerWidth;
      const val =
        selectedMetric === "rate"
          ? p.rateKbps || 0
          : selectedMetric === "latency"
          ? p.latencyMs || 0
          : p.requestsCount || 0;
      const y = height - paddingBottom - (val / maxVal) * innerHeight;
      return { x, y, point: p, val };
    });
  }, [points, selectedMetric, maxVal, innerWidth, innerHeight, paddingLeft, paddingBottom, height]);

  // Construct SVG Path
  const { linePath, areaPath } = useMemo(() => {
    if (!coordinates || coordinates.length === 0) {
      return { linePath: "", areaPath: "" };
    }
    if (coordinates.length === 1) {
      const { x, y } = coordinates[0];
      return {
        linePath: `M ${x} ${y}`,
        areaPath: `M ${x} ${y} L ${x} ${height - paddingBottom} Z`,
      };
    }

    // Smooth Bezier Curve interpolation
    let d = `M ${coordinates[0].x} ${coordinates[0].y}`;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const curr = coordinates[i];
      const next = coordinates[i + 1];
      const mx = (curr.x + next.x) / 2;
      d += ` C ${mx} ${curr.y}, ${mx} ${next.y}, ${next.x} ${next.y}`;
    }

    const firstX = coordinates[0].x;
    const lastX = coordinates[coordinates.length - 1].x;
    const baseY = height - paddingBottom;
    const area = `${d} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

    return { linePath: d, areaPath: area };
  }, [coordinates, height, paddingBottom]);

  // Range metadata labels
  const rangeDescription = useMemo(() => {
    switch (timeRange) {
      case "HOUR":
        return isLiveMode ? "Real-Time (Sliding Window 2 Detik)" : "24 Jam Terakhir";
      case "DAY":
        return "30 Hari Terakhir (Harian)";
      case "MONTH":
        return "12 Bulan Terakhir (Bulanan)";
      case "YEAR":
        return "Multi-Tahun (Tahunan)";
    }
  }, [timeRange, isLiveMode]);

  return (
    <div className={cn("bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-xs space-y-4", className)}>
      {/* 1. Header Ribbon & Time Range Controls */}
      <div className="flex flex-col gap-3.5 pb-3.5 border-b border-[#f1f5f9]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 border border-[#bae6fd]">
              <Activity className="w-4 h-4 text-[#006877]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[#0f172a]">
                  Grafik Lalu Lintas Jaringan
                </h4>
                {isLiveMode ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Live Stream
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                    <Calendar className="w-3.5 h-3.5 text-[#006877]" />
                    {timeRange === "HOUR" ? "Historis 24 Jam" : timeRange === "DAY" ? "Historis 30 Hari" : timeRange === "MONTH" ? "Historis 12 Bulan" : "Historis Tahunan"}
                  </span>
                )}
                {historyQuery.isFetching && (
                  <RefreshCw className="w-3.5 h-3.5 text-[#006877] animate-spin" />
                )}
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                {isLiveMode
                  ? "Pemantauan kecepatan transfer data Google Drive dan latensi jaringan interval 2 detik."
                  : `Analisis riwayat lalu lintas unduhan data Google Drive rentang ${rangeDescription}.`}
              </p>
            </div>
          </div>

          {/* Time Range Selector Tabs (Jam, Hari, Bulan, Tahun) */}
          <div className="flex items-center gap-1 bg-[#f8fafc] p-1 rounded-xl border border-[#e2e8f0] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setTimeRange("HOUR");
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                timeRange === "HOUR"
                  ? "bg-[#006877] text-white shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a] hover:bg-slate-100"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Jam</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeRange("DAY");
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                timeRange === "DAY"
                  ? "bg-[#006877] text-white shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a] hover:bg-slate-100"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Hari</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeRange("MONTH");
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                timeRange === "MONTH"
                  ? "bg-[#006877] text-white shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a] hover:bg-slate-100"
              )}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Bulan</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeRange("YEAR");
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                timeRange === "YEAR"
                  ? "bg-[#006877] text-white shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a] hover:bg-slate-100"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Tahun</span>
            </button>
          </div>
        </div>

        {/* Secondary Sub-Controls Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          {timeRange === "HOUR" ? (
            <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0] self-start">
              <button
                type="button"
                onClick={() => setHourSubMode("live")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  hourSubMode === "live"
                    ? "bg-white text-emerald-700 shadow-2xs"
                    : "text-[#64748b] hover:text-[#0f172a]"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>Live Real-Time</span>
              </button>
              <button
                type="button"
                onClick={() => setHourSubMode("24h")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  hourSubMode === "24h"
                    ? "bg-white text-[#006877] shadow-2xs"
                    : "text-[#64748b] hover:text-[#0f172a]"
                )}
              >
                <Clock className="w-3 h-3 text-[#006877]" />
                <span>24 Jam Terakhir</span>
              </button>
            </div>
          ) : (
            <div className="text-xs text-[#64748b] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#006877]" />
              <span>Periode Agregasi: <strong className="text-[#0f172a] font-semibold">{rangeDescription}</strong></span>
            </div>
          )}

          {/* Metric Selector Pills */}
          <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedMetric("rate")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                selectedMetric === "rate"
                  ? "bg-white text-[#006877] shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
              )}
            >
              Throughput (KB/s)
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric("latency")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                selectedMetric === "latency"
                  ? "bg-white text-[#006877] shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
              )}
            >
              Latensi (ms)
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric("requests")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                selectedMetric === "requests"
                  ? "bg-white text-[#006877] shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
              )}
            >
              Aliran Citra
            </button>
          </div>
        </div>
      </div>

      {/* 2. Summary Stat Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-[#64748b] block">
            {isLiveMode ? "Kecepatan Saat Ini" : "Total Citra Terproses"}
          </span>
          <span className="text-base font-bold font-mono text-[#006877] mt-0.5 block">
            {isLiveMode ? formatRate(latestRateKbps) : `${historicalTotalRequests.toLocaleString("id-ID")} req`}
          </span>
        </div>
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-[#64748b] block">Puncak Kecepatan</span>
          <span className="text-base font-bold font-mono text-[#0f172a] mt-0.5 block">
            {formatRate(peakRateKbps)}
          </span>
        </div>
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-[#64748b] block">Rata-rata Latensi</span>
          <span className="text-base font-bold font-mono text-[#0f172a] mt-0.5 block">
            {latestLatencyMs} ms
          </span>
        </div>
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-[#64748b] block">
            {isLiveMode ? "Titik Sampel Aktif" : "Total Volume Aliran"}
          </span>
          <span className="text-base font-bold font-mono text-[#0f172a] mt-0.5 block">
            {isLiveMode
              ? `${points.length} titik (~${points.length * 2} dtk)`
              : formatBytes(historicalTotalBytes)}
          </span>
        </div>
      </div>

      {/* 3. Interactive Tooltip Callout */}
      <div className="min-h-7 flex items-center text-xs">
        {hoveredPoint ? (
          <div className="flex items-center flex-wrap gap-2.5 bg-[#f0f9ff] border border-[#bae6fd] px-3 py-1.5 rounded-xl text-[#0369a1] shadow-xs">
            <span className="font-mono font-bold text-[#006877]">
              {hoveredPoint.label ? `${hoveredPoint.label}` : formatTime(hoveredPoint.timestamp)}
            </span>
            <span>
              Throughput: <strong className="font-mono text-[#0f172a]">{formatRate(hoveredPoint.rateKbps)}</strong>
            </span>
            <span>
              Latensi: <strong className="font-mono text-[#0f172a]">{hoveredPoint.latencyMs} ms</strong>
            </span>
            <span>
              Citra: <strong className="font-mono text-[#0f172a]">{hoveredPoint.requestsCount.toLocaleString("id-ID")} req</strong>
              {hoveredPoint.completedCount !== undefined && (
                <span className="text-emerald-700 ml-1 font-semibold">({hoveredPoint.completedCount} sukses)</span>
              )}
            </span>
            <span>
              Volume: <strong className="font-mono text-[#0f172a]">{formatBytes(hoveredPoint.bytesDelta)}</strong>
            </span>
          </div>
        ) : (
          <span className="text-[#64748b] italic">
            Arahkan kursor ke kurva grafik untuk melihat rincian throughput, latensi, dan volume unduhan pada titik waktu tersebut.
          </span>
        )}
      </div>

      {/* 4. Responsive SVG Vector Curve */}
      <div className="overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[620px]"
          style={{ maxHeight: "260px" }}
        >
          <defs>
            {/* Elegant Brand Gradient Fill */}
            <linearGradient id="networkGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#006877" stopOpacity="0.32" />
              <stop offset="60%" stopColor="#00a2b9" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#00a2b9" stopOpacity="0.01" />
            </linearGradient>
            {/* Scanning Guide Glow */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines and Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = height - paddingBottom - pct * innerHeight;
            const val = Math.round(pct * maxVal);
            const label =
              selectedMetric === "rate"
                ? formatRate(val)
                : selectedMetric === "latency"
                ? `${val} ms`
                : `${val} req`;

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
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#94a3b8] font-mono text-xs"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Empty / Loading State Message in SVG Canvas */}
          {coordinates.length === 0 && (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              className="fill-[#64748b] font-sans text-xs"
            >
              {historyQuery.isLoading
                ? "Memuat data riwayat lalu lintas jaringan..."
                : "Belum ada rekaman lalu lintas jaringan pada rentang ini"}
            </text>
          )}

          {/* Filled Gradient Area */}
          {areaPath && (
            <path d={areaPath} fill="url(#networkGradient)" className="transition-all duration-300" />
          )}

          {/* Smooth Curvature Stroke */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#00a2b9"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Interactive Hover Point Circles */}
          {coordinates.map((coord, idx) => {
            if (!coord?.point) return null;
            const isHovered = Boolean(hoveredPoint?.timestamp && coord.point.timestamp === hoveredPoint.timestamp);
            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredPoint(coord.point)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="cursor-pointer"
              >
                {/* Invisible larger hit target */}
                <circle cx={coord.x} cy={coord.y} r="14" fill="transparent" />

                {/* Visible Data Dot */}
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r={isHovered ? "6" : "3.5"}
                  fill={isHovered ? "#006877" : "#00a2b9"}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all duration-150"
                  filter={isHovered ? "url(#glow)" : undefined}
                />
              </g>
            );
          })}

          {/* Vertical Guide Line on Hover */}
          {hoveredPoint && (
            (() => {
              const hoveredCoord = coordinates.find(
                (c) => c.point?.timestamp === hoveredPoint.timestamp
              );
              if (!hoveredCoord) return null;
              return (
                <line
                  x1={hoveredCoord.x}
                  y1={paddingTop}
                  x2={hoveredCoord.x}
                  y2={height - paddingBottom}
                  stroke="#006877"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              );
            })()
          )}

          {/* X-Axis Baseline & Timestamp Labels */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />

          {coordinates.map((coord, idx) => {
            if (!coord?.point) return null;

            // Adaptive interval for label display depending on point density
            const step =
              timeRange === "YEAR"
                ? 1
                : timeRange === "MONTH"
                ? 2
                : Math.max(1, Math.floor(coordinates.length / 5));

            if (idx % step !== 0 && idx !== coordinates.length - 1) return null;

            const label = coord.point.label || (coord.point.timestamp ? formatTime(coord.point.timestamp) : "");

            return (
              <text
                key={idx}
                x={coord.x}
                y={height - paddingBottom + 18}
                textAnchor="middle"
                className="fill-[#64748b] font-mono text-xs"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* 5. Subtitle Note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#64748b] pt-2 border-t border-[#f1f5f9]">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#00a2b9]" />
          <span>
            {isLiveMode
              ? "Grafik berfluktuasi seiring streaming unduhan citra dan pemrosesan antrean di RAM Node.js."
              : `Menampilkan agregasi telemetri jaringan historis ${rangeDescription}.`}
          </span>
        </div>
        <span className="font-mono text-slate-400">PLN UID S2JB Telemetry Engine</span>
      </div>
    </div>
  );
}
