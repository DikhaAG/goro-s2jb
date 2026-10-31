"use client";

import React from "react";
import {
  Cpu,
  Layers,
  Database,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WorkerMetricsData {
  isSuperAdmin: boolean;
  redisStatus: {
    healthy: boolean;
    latencyMs: number;
  };
  importQueue: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  ocrQueue: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  databaseMetrics: {
    totalReviews: number;
    pendingReviews: number;
    approvedReviews: number;
  };
}

interface WorkerMetricsCardProps {
  metrics: WorkerMetricsData | null | undefined;
  isLoading?: boolean;
}

export function WorkerMetricsCard({ metrics, isLoading = false }: WorkerMetricsCardProps) {
  if (isLoading && !metrics) {
    return (
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 animate-pulse">
        <div className="h-4 bg-[#f1f5f9] rounded w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-16 bg-[#f1f5f9] rounded-xl" />
          <div className="h-16 bg-[#f1f5f9] rounded-xl" />
          <div className="h-16 bg-[#f1f5f9] rounded-xl" />
          <div className="h-16 bg-[#f1f5f9] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#f1f5f9] gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 border border-[#bae6fd]">
            <Cpu className="w-4 h-4 text-[#006877]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#0f172a] leading-tight">
              Status Subsistem & Antrean Worker BullMQ
            </h4>
            <p className="text-xs text-[#64748b] mt-0.5">
              Metrik performa mesin latar belakang secara langsung
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
              metrics.redisStatus.healthy
                ? "bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]"
                : "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                metrics.redisStatus.healthy ? "bg-[#16a34a]" : "bg-[#ef4444]"
              }`}
            />
            Redis {metrics.redisStatus.healthy ? `Online (${metrics.redisStatus.latencyMs}ms)` : "Offline"}
          </span>
          {metrics.isSuperAdmin && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0] text-[10px] font-bold uppercase tracking-wider">
              Super Admin View
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Import Queue */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#006877]" />
              Antrean Impor CSV
            </span>
            {metrics.importQueue.active > 0 ? (
              <span className="text-[10px] font-bold font-mono text-[#0369a1] bg-[#f0f9ff] border border-[#bae6fd] px-2 py-0.5 rounded-full animate-pulse">
                {metrics.importQueue.active} Aktif
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] px-2 py-0.5 rounded-full">
                Idle
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-[#e2e8f0]">
            <div>
              <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Menunggu</div>
              <div className="font-mono font-bold text-[#0f172a] mt-0.5">{metrics.importQueue.waiting}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Selesai</div>
              <div className="font-mono font-bold text-[#15803d] mt-0.5">{metrics.importQueue.completed}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Gagal</div>
              <div className="font-mono font-bold text-[#b91c1c] mt-0.5">{metrics.importQueue.failed}</div>
            </div>
          </div>
        </div>

        {/* OCR Queue */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#f59e0b]" />
              Antrean OCR Eviden
            </span>
            {metrics.ocrQueue.active > 0 ? (
              <span className="text-[10px] font-bold font-mono text-[#b45309] bg-[#fff7ed] border border-[#fed7aa] px-2 py-0.5 rounded-full animate-pulse">
                {metrics.ocrQueue.active} Aktif
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] px-2 py-0.5 rounded-full">
                Idle
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-[#e2e8f0]">
            <div>
              <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Menunggu</div>
              <div className="font-mono font-bold text-[#0f172a] mt-0.5">{metrics.ocrQueue.waiting}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Selesai</div>
              <div className="font-mono font-bold text-[#15803d] mt-0.5">{metrics.ocrQueue.completed}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Gagal</div>
              <div className="font-mono font-bold text-[#b91c1c] mt-0.5">{metrics.ocrQueue.failed}</div>
            </div>
          </div>
        </div>

        {/* Database Total */}
        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#006877]" />
              Basis Data PostgreSQL
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#006877] bg-[#f0fdfa] border border-[#99f6e4] px-2 py-0.5 rounded-full">
              Live DB
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-[#e2e8f0]">
            <div>
              <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Total Ulasan</div>
              <div className="font-mono font-bold text-[#0f172a] mt-0.5">
                {metrics.databaseMetrics.totalReviews.toLocaleString("id-ID")}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Perlu Triase</div>
              <div className="font-mono font-bold text-[#b45309] mt-0.5">
                {metrics.databaseMetrics.pendingReviews.toLocaleString("id-ID")}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">Disetujui</div>
              <div className="font-mono font-bold text-[#15803d] mt-0.5">
                {metrics.databaseMetrics.approvedReviews.toLocaleString("id-ID")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
