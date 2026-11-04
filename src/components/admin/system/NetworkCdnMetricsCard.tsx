"use client";

import React, { useState, useEffect } from "react";
import {
  Globe,
  Wifi,
  HardDrive,
  ShieldAlert,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface NetworkDownloaderHealthData {
  status: "up" | "degraded";
  total_requests: number;
  successful_streams: number;
  failed_streams: number;
  average_latency_ms: number;
  bytes_streamed_mb: number;
  cache_hit_rate_pct: number;
  candidate_hits: {
    endpoint_uc: number;
    endpoint_user_content: number;
    endpoint_lh3: number;
    direct_url: number;
  };
  rejection_reasons: {
    html_response: number;
    invalid_magic_bytes: number;
    timeout_abort: number;
    http_error: number;
  };
}

export function NetworkCdnMetricsCard() {
  const [data, setData] = useState<NetworkDownloaderHealthData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const body = await res.json();
        if (body?.services?.network_downloader) {
          setData(body.services.network_downloader);
        }
      }
    } catch {
      // ignore fetch errors
    } finally {
      setIsLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalHits =
    (data?.candidate_hits?.endpoint_uc || 0) +
    (data?.candidate_hits?.endpoint_user_content || 0) +
    (data?.candidate_hits?.endpoint_lh3 || 0) +
    (data?.candidate_hits?.direct_url || 0);

  const getPercentage = (count: number) => {
    if (totalHits === 0) return 0;
    return Math.round((count / totalHits) * 100);
  };

  const latency = data?.average_latency_ms || 0;
  const latencyBadgeColor =
    latency < 400
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : latency < 1000
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-rose-50 text-rose-700 border-rose-200";

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#006877]/10 flex items-center justify-center text-[#006877]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              Telemetri Jaringan CDN &amp; Google Drive (Zero-Storage)
            </h3>
            <p className="text-xs text-[#64748b]">
              Performa pengunduhan citra bukti ulasan langsung ke memori RAM tanpa persistensi disk.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchMetrics}
          disabled={isLoading}
          className="text-xs font-semibold text-[#006877] hover:text-[#00a2b9] flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>{lastUpdated.toLocaleTimeString("id-ID")}</span>
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Average Latency */}
        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#64748b] mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Wifi className="w-3.5 h-3.5 text-[#006877]" />
              Latensi Rata-rata
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${latencyBadgeColor}`}>
              {latency < 400 ? "Optimal" : latency < 1000 ? "Sedang" : "Lambat"}
            </span>
          </div>
          <div className="text-xl font-mono font-black text-[#0f172a] mt-1">
            {latency} <span className="text-xs font-normal text-[#64748b]">ms / request</span>
          </div>
          <div className="text-xs text-[#64748b] mt-1">
            Total Request: <strong className="text-[#0f172a]">{data?.total_requests || 0}</strong>
          </div>
        </div>

        {/* Metric 2: Bytes Streamed */}
        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#64748b] mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              Volume Streaming
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
              Zero-Disk
            </span>
          </div>
          <div className="text-xl font-mono font-black text-[#0f172a] mt-1">
            {data?.bytes_streamed_mb || 0} <span className="text-xs font-normal text-[#64748b]">MB</span>
          </div>
          <div className="text-xs text-[#64748b] mt-1">
            Berhasil dialirkan: <strong className="text-emerald-600">{data?.successful_streams || 0}</strong>
          </div>
        </div>

        {/* Metric 3: Cache Hit Ratio */}
        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#64748b] mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              Efisiensi Cache
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-teal-50 text-teal-700 border-teal-200">
              In-Memory
            </span>
          </div>
          <div className="text-xl font-mono font-black text-[#0f172a] mt-1">
            {data?.cache_hit_rate_pct || 0}%
          </div>
          <div className="text-xs text-[#64748b] mt-1">
            Menghindari panggilan jaringan ulang
          </div>
        </div>

        {/* Metric 4: Rejections & Throttling */}
        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#64748b] mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Penolakan Format
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-slate-100 text-[#475569] border-[#cbd5e1]">
              Filter Magic Bytes
            </span>
          </div>
          <div className="text-xl font-mono font-black text-[#0f172a] mt-1">
            {(data?.rejection_reasons?.html_response || 0) + (data?.rejection_reasons?.invalid_magic_bytes || 0)}
          </div>
          <div className="text-xs text-[#64748b] mt-1">
            HTML: {data?.rejection_reasons?.html_response || 0} | Non-Image: {data?.rejection_reasons?.invalid_magic_bytes || 0}
          </div>
        </div>
      </div>

      {/* Candidate Endpoint Breakdown */}
      <div className="p-4 rounded-xl border border-[#e2e8f0] bg-slate-50/50 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-[#0f172a]">
          <span>Distribusi Keberhasilan 3 Endpoint Kandidat URL Google Drive</span>
          <span className="text-xs font-mono font-normal text-[#64748b]">
            Total Endpoint Hit: {totalHits}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Endpoint 1 */}
          <div className="p-2.5 bg-white rounded-lg border border-[#e2e8f0] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-[#0f172a]">Endpoint 1 (UC Export)</span>
              <span className="font-mono font-bold text-cyan-700">
                {getPercentage(data?.candidate_hits?.endpoint_uc || 0)}%
              </span>
            </div>
            <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all"
                style={{ width: `${getPercentage(data?.candidate_hits?.endpoint_uc || 0)}%` }}
              />
            </div>
            <span className="text-xs text-[#64748b] font-mono mt-1 truncate">
              drive.google.com/uc?id=...
            </span>
          </div>

          {/* Endpoint 2 */}
          <div className="p-2.5 bg-white rounded-lg border border-[#e2e8f0] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-[#0f172a]">Endpoint 2 (UserContent)</span>
              <span className="font-mono font-bold text-indigo-700">
                {getPercentage(data?.candidate_hits?.endpoint_user_content || 0)}%
              </span>
            </div>
            <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all"
                style={{ width: `${getPercentage(data?.candidate_hits?.endpoint_user_content || 0)}%` }}
              />
            </div>
            <span className="text-xs text-[#64748b] font-mono mt-1 truncate">
              drive.usercontent.google.com/download
            </span>
          </div>

          {/* Endpoint 3 */}
          <div className="p-2.5 bg-white rounded-lg border border-[#e2e8f0] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-[#0f172a]">Endpoint 3 (LH3 CDN)</span>
              <span className="font-mono font-bold text-teal-700">
                {getPercentage(data?.candidate_hits?.endpoint_lh3 || 0)}%
              </span>
            </div>
            <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
              <div
                className="bg-teal-500 h-full rounded-full transition-all"
                style={{ width: `${getPercentage(data?.candidate_hits?.endpoint_lh3 || 0)}%` }}
              />
            </div>
            <span className="text-xs text-[#64748b] font-mono mt-1 truncate">
              lh3.googleusercontent.com/d/...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
