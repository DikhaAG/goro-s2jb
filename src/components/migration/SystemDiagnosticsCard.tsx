"use client";

import React from "react";
import {
  Server,
  Activity,
  HardDrive,
  Database,
  Cpu,
  Clock,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SystemDiagnosticsProps {
  telemetry: {
    redis: {
      healthy: boolean;
      latencyMs: number;
      version: string;
      usedMemory: string;
      peakMemory: string;
      fragmentationRatio: string;
      connectedClients: number;
      uptimeSeconds: number;
    };
    node: {
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
      uptimeSeconds: number;
    };
    database: {
      totalReviews: number;
      pendingReviews: number;
      needsReviewReviews: number;
      approvedReviews: number;
      rejectedReviews: number;
    };
  };
}

export function SystemDiagnosticsCard({ telemetry }: SystemDiagnosticsProps) {
  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds} dtk`;
    const min = Math.floor(seconds / 60);
    const hours = Math.floor(min / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} hari ${hours % 24} jam`;
    if (hours > 0) return `${hours} jam ${min % 60} mnt`;
    return `${min} menit`;
  };

  const totalReviews = telemetry.database.totalReviews || 1;
  const approvedPct = Math.round(
    (telemetry.database.approvedReviews / totalReviews) * 100
  );
  const needsReviewPct = Math.round(
    (telemetry.database.needsReviewReviews / totalReviews) * 100
  );
  const pendingPct = Math.round(
    (telemetry.database.pendingReviews / totalReviews) * 100
  );
  const rejectedPct = Math.round(
    (telemetry.database.rejectedReviews / totalReviews) * 100
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Redis Memory & Server Engine */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                  Redis In-Memory Engine
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  v{telemetry.redis.version}
                </span>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                telemetry.redis.healthy
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                  : "bg-rose-50 text-rose-700 border-rose-200 text-[10px]"
              }
            >
              {telemetry.redis.latencyMs}ms
            </Badge>
          </div>

          <div className="space-y-2 mt-3 text-xs text-slate-600">
            <div className="flex justify-between items-center">
              <span>Penggunaan Memori:</span>
              <span className="font-bold text-slate-900">
                {telemetry.redis.usedMemory}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Puncak Memori:</span>
              <span className="font-semibold text-slate-700">
                {telemetry.redis.peakMemory}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Fragmentasi Memori:</span>
              <span className="font-semibold text-slate-700">
                {telemetry.redis.fragmentationRatio}x
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Koneksi Klien Aktif:</span>
              <span className="font-semibold text-slate-700">
                {telemetry.redis.connectedClients} clients
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px] text-slate-400">
              <span>Uptime Engine:</span>
              <span>{formatUptime(telemetry.redis.uptimeSeconds)}</span>
            </div>
          </div>
        </div>

        {/* 2. Node.js Worker Runtime */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#006877] flex items-center justify-center border border-teal-100">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                  Node.js Server Runtime
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  v20.x TSX Process
                </span>
              </div>
            </div>
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]">
              Sehat
            </Badge>
          </div>

          <div className="space-y-2 mt-3 text-xs text-slate-600">
            <div className="flex justify-between items-center">
              <span>Heap Terpakai:</span>
              <span className="font-bold text-slate-900">
                {telemetry.node.heapUsedMb} MB
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Alokasi Heap:</span>
              <span className="font-semibold text-slate-700">
                {telemetry.node.heapTotalMb} MB
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Resident Set (RSS):</span>
              <span className="font-semibold text-slate-700">
                {telemetry.node.rssMb} MB
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              <span>Uptime Proses:</span>
              <span>{formatUptime(telemetry.node.uptimeSeconds)}</span>
            </div>
          </div>
        </div>

        {/* 3. PostgreSQL Database Summary */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                  PostgreSQL Data State
                </h4>
                <span className="text-[10px] text-slate-400">
                  Prisma Model RatingReview
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-900">
              {telemetry.database.totalReviews.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Breakdown progress line */}
          <div className="mt-3">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${approvedPct}%` }}
                className="bg-emerald-500 h-full"
                title={`Disetujui: ${approvedPct}%`}
              />
              <div
                style={{ width: `${needsReviewPct}%` }}
                className="bg-amber-400 h-full"
                title={`Perlu Triase: ${needsReviewPct}%`}
              />
              <div
                style={{ width: `${pendingPct}%` }}
                className="bg-blue-400 h-full"
                title={`Pending OCR: ${pendingPct}%`}
              />
              <div
                style={{ width: `${rejectedPct}%` }}
                className="bg-rose-500 h-full"
                title={`Ditolak: ${rejectedPct}%`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600 truncate">Disetujui:</span>
              <span className="font-semibold text-slate-900">
                {telemetry.database.approvedReviews.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-slate-600 truncate">Triase:</span>
              <span className="font-semibold text-slate-900">
                {telemetry.database.needsReviewReviews.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <span className="text-slate-600 truncate">Pending:</span>
              <span className="font-semibold text-slate-900">
                {telemetry.database.pendingReviews.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="text-slate-600 truncate">Ditolak:</span>
              <span className="font-semibold text-slate-900">
                {telemetry.database.rejectedReviews.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
