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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-16 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 leading-tight">
              Status Subsistem & Antrean Worker BullMQ
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Metrik performa mesin latar belakang secara langsung
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              metrics.redisStatus.healthy
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                metrics.redisStatus.healthy ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            Redis {metrics.redisStatus.healthy ? `Online (${metrics.redisStatus.latencyMs}ms)` : "Offline"}
          </Badge>
          {metrics.isSuperAdmin && (
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
              Super Admin View
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Import Queue */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#006877]" />
              Antrean Impor CSV
            </span>
            {metrics.importQueue.active > 0 ? (
              <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded-full">
                {metrics.importQueue.active} Aktif
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded-full">
                Idle
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-200/50">
            <div>
              <div className="text-[10px] text-slate-400">Menunggu</div>
              <div className="font-bold text-slate-700">{metrics.importQueue.waiting}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Selesai</div>
              <div className="font-bold text-emerald-600">{metrics.importQueue.completed}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Gagal</div>
              <div className="font-bold text-rose-600">{metrics.importQueue.failed}</div>
            </div>
          </div>
        </div>

        {/* OCR Queue */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Antrean OCR Eviden
            </span>
            {metrics.ocrQueue.active > 0 ? (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                {metrics.ocrQueue.active} Aktif
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded-full">
                Idle
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-200/50">
            <div>
              <div className="text-[10px] text-slate-400">Menunggu</div>
              <div className="font-bold text-slate-700">{metrics.ocrQueue.waiting}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Selesai</div>
              <div className="font-bold text-emerald-600">{metrics.ocrQueue.completed}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Gagal</div>
              <div className="font-bold text-rose-600">{metrics.ocrQueue.failed}</div>
            </div>
          </div>
        </div>

        {/* Database Total */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              Basis Data PostgreSQL
            </span>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
              Live DB
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-200/50">
            <div>
              <div className="text-[10px] text-slate-400">Total Ulasan</div>
              <div className="font-bold text-slate-900">
                {metrics.databaseMetrics.totalReviews.toLocaleString("id-ID")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Perlu Triase</div>
              <div className="font-bold text-amber-600">
                {metrics.databaseMetrics.pendingReviews.toLocaleString("id-ID")}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Disetujui</div>
              <div className="font-bold text-emerald-600">
                {metrics.databaseMetrics.approvedReviews.toLocaleString("id-ID")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
