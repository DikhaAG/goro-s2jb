"use client";

import React from "react";
import {
  Cpu,
  Layers,
  Sparkles,
  PauseCircle,
  PlayCircle,
  ArrowRight,
  Database,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QueueInfo {
  name: string;
  displayName: string;
  isPaused: boolean;
  counts: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  activeJobs: Array<{
    id?: string;
    name: string;
    batchId?: string;
    filePath?: string;
    startRow?: number;
    reviewId?: string;
    expectedName?: string;
    timestamp: number;
    processedOn?: number;
  }>;
}

interface WorkerDetailInspectorProps {
  queues: {
    import: QueueInfo;
    ocr: QueueInfo;
  };
  isSuperAdmin: boolean;
  onPauseQueue: (queueName: "import" | "ocr") => Promise<void>;
  onResumeQueue: (queueName: "import" | "ocr") => Promise<void>;
  isActionLoading: boolean;
}

export function WorkerDetailInspector({
  queues,
  isSuperAdmin,
  onPauseQueue,
  onResumeQueue,
  isActionLoading,
}: WorkerDetailInspectorProps) {
  const renderQueueCard = (
    key: "import" | "ocr",
    queue: QueueInfo,
    icon: React.ReactNode,
    accentColor: string
  ) => {
    const isWorking = queue.counts.active > 0;
    const isPaused = queue.isPaused;

    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
        {/* Subtle top indicator bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isPaused
              ? "bg-amber-400"
              : isWorking
              ? "bg-teal-500 animate-pulse"
              : "bg-slate-200"
          }`}
        />

        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${accentColor}`}
              >
                {icon}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-tight">
                  {queue.displayName}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-mono text-slate-400">
                    {queue.name}
                  </span>
                  {isPaused ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                      <PauseCircle className="w-3 h-3 mr-1" /> Dijeda
                    </Badge>
                  ) : isWorking ? (
                    <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5" /> Bekerja
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                      Siap (Idle)
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Super Admin Control */}
            {isSuperAdmin && (
              <div>
                {isPaused ? (
                  <button
                    type="button"
                    onClick={() => onResumeQueue(key)}
                    disabled={isActionLoading}
                    title="Lanjutkan antrean worker ini"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition-colors focus-utility-ring disabled:opacity-50 cursor-pointer shadow-xs min-h-[36px]"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Lanjutkan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPauseQueue(key)}
                    disabled={isActionLoading}
                    title="Jeda antrean worker ini sementara"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors focus-utility-ring disabled:opacity-50 cursor-pointer min-h-[36px]"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>Jeda Antrean</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Metric Counter Grid */}
          <div className="grid grid-cols-4 gap-2.5 my-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                Aktif
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {queue.counts.active.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                Menunggu
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {queue.counts.waiting.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Selesai
              </div>
              <div className="text-base font-bold text-emerald-700 mt-0.5">
                {queue.counts.completed.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-500" />
                Gagal
              </div>
              <div className="text-base font-bold text-rose-600 mt-0.5">
                {queue.counts.failed.toLocaleString("id-ID")}
              </div>
            </div>
          </div>
        </div>

        {/* Live Running Job Snippet */}
        <div className="pt-3 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
            <span>Job Sedang Berjalan:</span>
            <span className="text-[11px] font-normal text-slate-400">
              {queue.activeJobs.length} terdeteksi
            </span>
          </div>

          {queue.activeJobs.length === 0 ? (
            <div className="text-xs text-slate-400 italic bg-slate-50/60 p-2.5 rounded-lg text-center">
              Tidak ada proses aktif yang sedang berjalan di worker ini saat ini.
            </div>
          ) : (
            <div className="space-y-1.5">
              {queue.activeJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-teal-50/50 border border-teal-100 rounded-lg p-2 text-xs flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <span className="font-mono font-bold text-teal-800 mr-2">
                      #{job.id}
                    </span>
                    <span className="text-slate-700">
                      {key === "import"
                        ? `File: ${job.filePath || "data.csv"}`
                        : `Reviewer: ${job.expectedName || "Eviden"}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-teal-700 shrink-0 font-medium">
                    {job.processedOn
                      ? `${Math.round((Date.now() - job.processedOn) / 1000)} dtk`
                      : "Sedang berjalan"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 2-Tier Pipeline Flow Diagram */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Arsitektur Alur Proses Latar Belakang (Dual-Tier Pipeline)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-center">
            <div className="text-[11px] font-medium text-slate-400">Tahap 1</div>
            <div className="font-bold text-sm text-teal-400 mt-0.5">Unggah Berkas</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Stream CSV / Excel</div>
          </div>

          <div className="hidden md:flex justify-center text-slate-500">
            <ArrowRight className="w-5 h-5 text-teal-400" />
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-center">
            <div className="text-[11px] font-medium text-slate-400">Tahap 2 (Worker 1)</div>
            <div className="font-bold text-sm text-sky-400 mt-0.5">Fast Ingesti DB</div>
            <div className="text-[10px] text-slate-400 mt-0.5">1.000+ baris/detik PostgreSQL</div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-center">
            <div className="text-[11px] font-medium text-slate-400">Tahap 3 (Worker 2)</div>
            <div className="font-bold text-sm text-amber-400 mt-0.5">OCR & Smart Proxy</div>
            <div className="text-[10px] text-slate-400 mt-0.5">On-demand CDN Stream</div>
          </div>
        </div>
      </div>

      {/* Two Queue Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {renderQueueCard(
          "import",
          queues.import,
          <Layers className="w-5 h-5 text-[#006877]" />,
          "bg-teal-50 border-teal-100"
        )}

        {renderQueueCard(
          "ocr",
          queues.ocr,
          <Sparkles className="w-5 h-5 text-amber-600" />,
          "bg-amber-50 border-amber-100"
        )}
      </div>
    </div>
  );
}
