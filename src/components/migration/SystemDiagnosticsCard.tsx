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
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#fef2f2] text-[#dc2626] flex items-center justify-center border border-[#fee2e2]">
                <HardDrive className="w-4 h-4 text-[#dc2626]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#0f172a] leading-tight">
                  Redis In-Memory Engine
                </h4>
                <span className="text-[10px] text-[#64748b] font-mono">
                  v{telemetry.redis.version}
                </span>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                telemetry.redis.healthy
                  ? "bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]"
                  : "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  telemetry.redis.healthy ? "bg-[#16a34a]" : "bg-[#ef4444]"
                }`}
              />
              {telemetry.redis.latencyMs}ms
            </span>
          </div>

          <div className="space-y-2.5 mt-3 text-xs text-[#475569]">
            <div className="flex justify-between items-center">
              <span>Penggunaan Memori:</span>
              <span className="font-mono font-bold text-[#0f172a]">
                {telemetry.redis.usedMemory}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Puncak Memori:</span>
              <span className="font-mono font-semibold text-[#0f172a]">
                {telemetry.redis.peakMemory}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Fragmentasi Memori:</span>
              <span className="font-mono font-semibold text-[#0f172a]">
                {telemetry.redis.fragmentationRatio}x
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Koneksi Klien Aktif:</span>
              <span className="font-mono font-semibold text-[#0f172a]">
                {telemetry.redis.connectedClients} klien
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#f1f5f9] text-[11px] text-[#64748b]">
              <span>Uptime Engine:</span>
              <span className="font-mono">{formatUptime(telemetry.redis.uptimeSeconds)}</span>
            </div>
          </div>
        </div>

        {/* 2. Node.js Worker Runtime */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center border border-[#bae6fd]">
                <Cpu className="w-4 h-4 text-[#006877]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#0f172a] leading-tight">
                  Node.js Server Runtime
                </h4>
                <span className="text-[10px] text-[#64748b] font-mono">
                  v20.x TSX Process
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
              Sehat
            </span>
          </div>

          <div className="space-y-2.5 mt-3 text-xs text-[#475569]">
            <div className="flex justify-between items-center">
              <span>Heap Terpakai:</span>
              <span className="font-mono font-bold text-[#0f172a]">
                {telemetry.node.heapUsedMb} MB
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Alokasi Heap:</span>
              <span className="font-mono font-semibold text-[#0f172a]">
                {telemetry.node.heapTotalMb} MB
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Resident Set (RSS):</span>
              <span className="font-mono font-semibold text-[#0f172a]">
                {telemetry.node.rssMb} MB
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#f1f5f9] text-[11px] text-[#64748b]">
              <span>Uptime Proses:</span>
              <span className="font-mono">{formatUptime(telemetry.node.uptimeSeconds)}</span>
            </div>
          </div>
        </div>

        {/* 3. PostgreSQL Database Summary */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#f0f9ff] text-[#0369a1] flex items-center justify-center border border-[#bae6fd]">
                <Database className="w-4 h-4 text-[#0369a1]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#0f172a] leading-tight">
                  PostgreSQL Data State
                </h4>
                <span className="text-[10px] text-[#64748b]">
                  Prisma Model RatingReview
                </span>
              </div>
            </div>
            <span className="text-xs font-bold font-mono text-[#006877]">
              {telemetry.database.totalReviews.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Breakdown progress line */}
          <div className="mt-3">
            <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden flex border border-[#e2e8f0]">
              <div
                style={{ width: `${approvedPct}%` }}
                className="bg-[#16a34a] h-full"
                title={`Disetujui: ${approvedPct}%`}
              />
              <div
                style={{ width: `${needsReviewPct}%` }}
                className="bg-[#f59e0b] h-full"
                title={`Perlu Triase: ${needsReviewPct}%`}
              />
              <div
                style={{ width: `${pendingPct}%` }}
                className="bg-[#0284c7] h-full"
                title={`Pending OCR: ${pendingPct}%`}
              />
              <div
                style={{ width: `${rejectedPct}%` }}
                className="bg-[#dc2626] h-full"
                title={`Ditolak: ${rejectedPct}%`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#16a34a] shrink-0" />
              <span className="text-[#64748b] truncate">Disetujui:</span>
              <span className="font-mono font-bold text-[#0f172a]">
                {telemetry.database.approvedReviews.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" />
              <span className="text-[#64748b] truncate">Triase:</span>
              <span className="font-mono font-bold text-[#0f172a]">
                {telemetry.database.needsReviewReviews.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0284c7] shrink-0" />
              <span className="text-[#64748b] truncate">Pending:</span>
              <span className="font-mono font-bold text-[#0f172a]">
                {telemetry.database.pendingReviews.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#dc2626] shrink-0" />
              <span className="text-[#64748b] truncate">Ditolak:</span>
              <span className="font-mono font-bold text-[#0f172a]">
                {telemetry.database.rejectedReviews.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
