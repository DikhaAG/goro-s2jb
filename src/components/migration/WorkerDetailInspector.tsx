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
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
        {/* Subtle top indicator bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isPaused
              ? "bg-[#f59e0b]"
              : isWorking
              ? "bg-[#00a2b9] animate-pulse"
              : "bg-[#e2e8f0]"
          }`}
        />

        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#f1f5f9] gap-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${accentColor}`}
              >
                {icon}
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0f172a] leading-tight">
                  {queue.displayName}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-mono text-[#64748b]">
                    {queue.name}
                  </span>
                  {isPaused ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
                      <PauseCircle className="w-3 h-3 text-[#f59e0b]" /> Dijeda
                    </span>
                  ) : isWorking ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7]" /> Bekerja
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0]">
                      Siap (Idle)
                    </span>
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#00a2b9] hover:bg-[#008c9f] transition-all focus-utility-ring disabled:opacity-50 cursor-pointer shadow-xs min-h-[36px]"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#b45309] bg-[#fff7ed] hover:bg-[#ffedd5] border border-[#fed7aa] transition-all focus-utility-ring disabled:opacity-50 cursor-pointer min-h-[36px]"
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
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-center shadow-2xs">
              <div className="text-[10px] uppercase font-bold text-[#64748b] flex items-center justify-center gap-1 tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7]" />
                Aktif
              </div>
              <div className="text-base font-bold font-mono text-[#0f172a] mt-0.5">
                {queue.counts.active.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-center shadow-2xs">
              <div className="text-[10px] uppercase font-bold text-[#64748b] flex items-center justify-center gap-1 tracking-wider">
                <Clock className="w-3 h-3 text-[#0284c7]" />
                Menunggu
              </div>
              <div className="text-base font-bold font-mono text-[#0f172a] mt-0.5">
                {queue.counts.waiting.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-center shadow-2xs">
              <div className="text-[10px] uppercase font-bold text-[#64748b] flex items-center justify-center gap-1 tracking-wider">
                <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
                Selesai
              </div>
              <div className="text-base font-bold font-mono text-[#15803d] mt-0.5">
                {queue.counts.completed.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-center shadow-2xs">
              <div className="text-[10px] uppercase font-bold text-[#64748b] flex items-center justify-center gap-1 tracking-wider">
                <AlertTriangle className="w-3 h-3 text-[#dc2626]" />
                Gagal
              </div>
              <div className="text-base font-bold font-mono text-[#b91c1c] mt-0.5">
                {queue.counts.failed.toLocaleString("id-ID")}
              </div>
            </div>
          </div>
        </div>

        {/* Live Running Job Snippet */}
        <div className="pt-3 border-t border-[#f1f5f9]">
          <div className="text-xs font-bold text-[#0f172a] mb-2 flex items-center justify-between">
            <span>Job Sedang Berjalan:</span>
            <span className="text-[11px] font-mono text-[#64748b]">
              {queue.activeJobs.length} terdeteksi
            </span>
          </div>

          {queue.activeJobs.length === 0 ? (
            <div className="text-xs text-[#94a3b8] italic bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0] text-center">
              Tidak ada proses aktif yang sedang berjalan di worker ini saat ini.
            </div>
          ) : (
            <div className="space-y-1.5">
              {queue.activeJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-[#f0f9ff] border border-[#bae6fd] rounded-xl p-2.5 text-xs flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <span className="font-mono font-bold text-[#0369a1] mr-2">
                      #{job.id}
                    </span>
                    <span className="text-[#0f172a] font-medium">
                      {key === "import"
                        ? `File: ${job.filePath || "data.csv"}`
                        : `Reviewer: ${job.expectedName || "Eviden"}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#0369a1] shrink-0 font-mono font-bold">
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
      <div className="bg-[#0f172a] text-white rounded-2xl p-5 shadow-xs border border-[#334155]">
        <div className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-3">
          Arsitektur Alur Proses Latar Belakang (Dual-Tier Pipeline)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#94a3b8]">Tahap 1</div>
            <div className="font-bold text-sm text-[#5eead4] mt-0.5">Unggah Berkas</div>
            <div className="text-[11px] text-[#94a3b8] mt-0.5">Stream CSV / Excel</div>
          </div>

          <div className="hidden md:flex justify-center text-[#64748b]">
            <ArrowRight className="w-5 h-5 text-[#00a2b9]" />
          </div>

          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#94a3b8]">Tahap 2 (Worker 1)</div>
            <div className="font-bold text-sm text-[#38bdf8] mt-0.5">Fast Ingesti DB</div>
            <div className="text-[11px] text-[#94a3b8] mt-0.5">1.000+ baris/detik PostgreSQL</div>
          </div>

          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-3 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#94a3b8]">Tahap 3 (Worker 2)</div>
            <div className="font-bold text-sm text-[#fcd34d] mt-0.5">OCR & Smart Proxy</div>
            <div className="text-[11px] text-[#94a3b8] mt-0.5">On-demand CDN Stream</div>
          </div>
        </div>
      </div>

      {/* Two Queue Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {renderQueueCard(
          "import",
          queues.import,
          <Layers className="w-5 h-5 text-[#006877]" />,
          "bg-[#e7eeff] border-[#bae6fd]"
        )}

        {renderQueueCard(
          "ocr",
          queues.ocr,
          <Sparkles className="w-5 h-5 text-[#f59e0b]" />,
          "bg-[#fffbeb] border-[#fde68a]"
        )}
      </div>
    </div>
  );
}
