"use client";

import React from "react";
import {
  CloudDownload,
  Wifi,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Activity,
  ShieldCheck,
  Layers,
  Database,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface GoogleDriveTrafficData {
  totalRequests: number;
  successfulStreams: number;
  failedStreams: number;
  totalBytesStreamed: number;
  averageLatencyMs: number;
  candidateHits: {
    endpointUc: number;
    endpointUserContent: number;
    endpointLh3: number;
    directUrl: number;
  };
  rejectionReasons: {
    htmlResponse: number;
    invalidMagicBytes: number;
    timeoutAbort: number;
    httpError: number;
  };
  cacheStats: {
    hits: number;
    misses: number;
    cachedEntriesCount: number;
  };
  lastIncident?: {
    timestamp: string;
    url: string;
    error: string;
  };
}

interface GoogleDriveTrafficCardProps {
  gdrive?: GoogleDriveTrafficData;
  className?: string;
}

export function GoogleDriveTrafficCard({ gdrive, className }: GoogleDriveTrafficCardProps) {
  const data = gdrive || {
    totalRequests: 0,
    successfulStreams: 0,
    failedStreams: 0,
    totalBytesStreamed: 0,
    averageLatencyMs: 0,
    candidateHits: {
      endpointUc: 0,
      endpointUserContent: 0,
      endpointLh3: 0,
      directUrl: 0,
    },
    rejectionReasons: {
      htmlResponse: 0,
      invalidMagicBytes: 0,
      timeoutAbort: 0,
      httpError: 0,
    },
    cacheStats: {
      hits: 0,
      misses: 0,
      cachedEntriesCount: 0,
    },
  };

  const totalReq = Math.max(1, data.totalRequests);
  const successRate = Math.min(100, Math.round((data.successfulStreams / totalReq) * 100));

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const totalHits =
    data.candidateHits.endpointUc +
    data.candidateHits.endpointUserContent +
    data.candidateHits.endpointLh3 +
    data.candidateHits.directUrl || 1;

  const hitUcPct = Math.round((data.candidateHits.endpointUc / totalHits) * 100);
  const hitUserContentPct = Math.round((data.candidateHits.endpointUserContent / totalHits) * 100);
  const hitLh3Pct = Math.round((data.candidateHits.endpointLh3 / totalHits) * 100);
  const hitDirectPct = Math.round((data.candidateHits.directUrl / totalHits) * 100);

  const isStreamingActive = data.totalRequests > 0;

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs relative overflow-hidden space-y-5",
        className
      )}
    >
      {/* Decorative top accent border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#006877] via-[#00a2b9] to-emerald-500" />

      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 border border-[#bae6fd]">
            <CloudDownload className="w-5 h-5 text-[#006877]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#0f172a]">
                Lalu Lintas Unduhan Google Drive (Zero-Disk In-Memory)
              </h3>
              {isStreamingActive && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Live Streaming
                </span>
              )}
            </div>
            <p className="text-xs text-[#475569] mt-0.5">
              Telemetri aliran citra Google Drive langsung ke RAM Node.js tanpa membebani disk penyimpanan fisik server.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-[#334155] border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-[#006877]" />
            Zero-Storage Protocol
          </span>
        </div>
      </div>

      {/* 2. Key Telemetry Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Citra Berhasil */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 text-center shadow-2xs">
          <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Citra Berhasil</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[#0f172a] mt-1">
            {data.successfulStreams.toLocaleString("id-ID")}
          </div>
          <div className="text-xs text-emerald-700 font-semibold mt-0.5">
            Tingkat Sukses: {successRate}%
          </div>
        </div>

        {/* Metric 2: Volume Bandwidth */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 text-center shadow-2xs">
          <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-[#00a2b9]" />
            <span>Volume Bandwidth</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[#006877] mt-1">
            {formatBytes(data.totalBytesStreamed)}
          </div>
          <div className="text-xs text-[#64748b] mt-0.5">
            Total Aliran RAM
          </div>
        </div>

        {/* Metric 3: Rata-rata Latensi */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 text-center shadow-2xs">
          <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#0284c7]" />
            <span>Latensi Jaringan</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[#0f172a] mt-1">
            {data.averageLatencyMs} ms
          </div>
          <div className="text-xs text-[#64748b] mt-0.5">
            Rata-rata per Citra
          </div>
        </div>

        {/* Metric 4: Citra Gagal / Timeout */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 text-center shadow-2xs">
          <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Terkendala / Gagal</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-[#b91c1c] mt-1">
            {data.failedStreams.toLocaleString("id-ID")}
          </div>
          <div className="text-xs text-[#64748b] mt-0.5">
            {data.rejectionReasons.invalidMagicBytes > 0
              ? `${data.rejectionReasons.invalidMagicBytes} Non-Citra`
              : "Akses / Format Valid"}
          </div>
        </div>
      </div>

      {/* 3. Endpoint Multi-Candidate CDN Routing Breakdown */}
      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-[#0f172a]">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#006877]" />
            Distribusi Titik Akhir Google CDN (Multi-Candidate Failover):
          </span>
          <span className="font-mono text-[#64748b]">
            Total {totalHits.toLocaleString("id-ID")} Percobaan Routing
          </span>
        </div>

        {/* Visual Multi-Segment Bar */}
        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex border border-slate-300/60">
          <div
            style={{ width: `${hitUcPct}%` }}
            className="bg-[#006877] h-full transition-all"
            title={`drive.google.com/uc: ${hitUcPct}%`}
          />
          <div
            style={{ width: `${hitUserContentPct}%` }}
            className="bg-[#00a2b9] h-full transition-all"
            title={`drive.usercontent.google.com: ${hitUserContentPct}%`}
          />
          <div
            style={{ width: `${hitLh3Pct}%` }}
            className="bg-emerald-500 h-full transition-all"
            title={`lh3.googleusercontent.com: ${hitLh3Pct}%`}
          />
          <div
            style={{ width: `${hitDirectPct}%` }}
            className="bg-slate-400 h-full transition-all"
            title={`Direct URLs: ${hitDirectPct}%`}
          />
        </div>

        {/* Legend Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#006877] shrink-0" />
            <span className="text-[#475569] truncate">drive.google.com/uc:</span>
            <span className="font-mono font-bold text-[#0f172a]">
              {data.candidateHits.endpointUc}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00a2b9] shrink-0" />
            <span className="text-[#475569] truncate">usercontent CDN:</span>
            <span className="font-mono font-bold text-[#0f172a]">
              {data.candidateHits.endpointUserContent}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[#475569] truncate">lh3 Google CDN:</span>
            <span className="font-mono font-bold text-[#0f172a]">
              {data.candidateHits.endpointLh3}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
            <span className="text-[#475569] truncate">Direct URLs:</span>
            <span className="font-mono font-bold text-[#0f172a]">
              {data.candidateHits.directUrl}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Architecture Explainer Footnote */}
      <div className="p-3.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl flex items-start gap-3 text-xs text-[#0369a1]">
        <ShieldCheck className="w-4 h-4 text-[#0284c7] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold text-[#0369a1]">Arsitektur Zero-Disk Storage: </strong>
          Sistem sengaja tidak menyimpan berkas citra bukti ke hard disk fisik server untuk mencegah
          lonjakan beban penyimpanan hingga sekitar 85 GB (untuk 42.867 ulasan). Setiap citra dialirkan secara
          langsung ke memori RAM Node.js, diproses ekstraksi OCR dan pHash anti-fraud oleh Python bridge, lalu
          memori segera dibebaskan kembali.
        </div>
      </div>
    </div>
  );
}

