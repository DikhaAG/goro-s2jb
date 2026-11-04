"use client";

import React from "react";
import { trpc } from "@/lib/trpc";
import {
  Sparkles,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Activity,
} from "lucide-react";

export function OperatorPipelineStatusBar() {
  const healthQuery = trpc.systemProcesses.getServiceHealthSummary.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const workerQuery = trpc.migration.getDetailedWorkerStatus.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const ocrQueue = workerQuery.data?.queues?.ocr;
  const isHealthy = healthQuery.data?.isHealthy ?? true;
  const healthStatus = healthQuery.data?.status ?? "OPERATIONAL";

  const waitingJobs = ocrQueue?.counts?.waiting || 0;
  const activeJobs = ocrQueue?.counts?.active || 0;
  const totalInQueue = waitingJobs + activeJobs;
  const throughput = ocrQueue?.throughput?.jobsPerMinute || 0;
  const isStalled = ocrQueue?.stallDetection?.isStalled || false;

  const handleRefresh = () => {
    healthQuery.refetch();
    workerQuery.refetch();
  };

  const isFetching = healthQuery.isFetching || workerQuery.isFetching;

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Left: Overall Health & Status Pill */}
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
            healthStatus === "DOWN" || isStalled
              ? "bg-rose-50 border-rose-200 text-rose-600"
              : healthStatus === "DEGRADED"
              ? "bg-amber-50 border-amber-200 text-amber-600"
              : "bg-emerald-50 border-emerald-200 text-emerald-600"
          }`}
        >
          {healthStatus === "DOWN" || isStalled ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wide">
              Status Pemrosesan Otomatis &amp; AI Vision
            </h4>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                healthStatus === "DOWN" || isStalled
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : healthStatus === "DEGRADED"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  healthStatus === "DOWN" || isStalled
                    ? "bg-rose-600"
                    : healthStatus === "DEGRADED"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-emerald-600 animate-pulse"
                }`}
              />
              {healthStatus === "DOWN" || isStalled
                ? "Perhatian Diperlukan"
                : healthStatus === "DEGRADED"
                ? "Latensi Meningkat"
                : "Sistem Normal"}
            </span>
          </div>

          <p className="text-xs text-[#64748b] mt-0.5">
            {healthQuery.data?.message || "Layanan AI Vision &amp; validasi latar belakang beroperasi penuh."}
          </p>
        </div>
      </div>

      {/* Right: Operational Metrics and Refresh Action */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start md:self-auto shrink-0 text-xs">
        {/* Active OCR Processing Metric */}
        <div className="px-3 py-1.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-[#006877]" />
          <span className="text-[#64748b]">Antrean OCR:</span>
          <span className="font-mono font-bold text-[#0f172a]">
            {totalInQueue > 0 ? `${totalInQueue} ulasan` : "Kosong (Siap)"}
          </span>
        </div>

        {/* Speed / Throughput Metric */}
        <div className="px-3 py-1.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-[#64748b]">Kecepatan:</span>
          <span className="font-mono font-bold text-[#0f172a]">
            {throughput > 0 ? `${throughput} baris/mnt` : "Idle"}
          </span>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching}
          className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#334155] font-bold transition-all focus-utility-ring flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Segarkan status layanan"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#006877]" : "text-[#64748b]"}`} />
          <span>Segarkan</span>
        </button>
      </div>
    </div>
  );
}

