"use client";

import React, { useState } from "react";
import {
  Layers,
  Sparkles,
  RotateCw,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface QueueJobItem {
  id?: string;
  name: string;
  data: any;
  progress: any;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
  failedReason?: string | null;
  stacktrace?: string[];
}

interface QueueJobsManagerProps {
  queueName: "import" | "ocr";
  onQueueNameChange: (q: "import" | "ocr") => void;
  status: "active" | "waiting" | "failed" | "completed" | "delayed";
  onStatusChange: (s: "active" | "waiting" | "failed" | "completed" | "delayed") => void;
  jobs: QueueJobItem[];
  totalJobs: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onRetryJob: (jobId: string) => Promise<void>;
  onRemoveJob: (jobId: string) => Promise<void>;
  onRetryAllFailed: () => Promise<void>;
  onCleanQueue: (type: "failed" | "completed") => Promise<void>;
  isSuperAdmin: boolean;
  isLoading?: boolean;
}

export function QueueJobsManager({
  queueName,
  onQueueNameChange,
  status,
  onStatusChange,
  jobs,
  totalJobs,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onRetryJob,
  onRemoveJob,
  onRetryAllFailed,
  onCleanQueue,
  isSuperAdmin,
  isLoading = false,
}: QueueJobsManagerProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [actionLoadingJobId, setActionLoadingJobId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const statusTabs = [
    { label: "Aktif", value: "active" },
    { label: "Menunggu", value: "waiting" },
    { label: "Gagal", value: "failed" },
    { label: "Selesai", value: "completed" },
  ];

  const handleRetry = async (jobId: string) => {
    setActionLoadingJobId(jobId);
    try {
      await onRetryJob(jobId);
    } finally {
      setActionLoadingJobId(null);
    }
  };

  const handleRemove = async (jobId: string) => {
    setActionLoadingJobId(jobId);
    try {
      await onRemoveJob(jobId);
    } finally {
      setActionLoadingJobId(null);
    }
  };

  const handleBulkRetry = async () => {
    if (!confirm("Apakah Anda yakin ingin mencoba ulang seluruh job gagal pada antrean ini?")) {
      return;
    }
    setBulkLoading(true);
    try {
      await onRetryAllFailed();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkClean = async (type: "failed" | "completed") => {
    if (
      !confirm(
        `Apakah Anda yakin ingin membersihkan riwayat seluruh job ${type} pada antrean ini?`
      )
    ) {
      return;
    }
    setBulkLoading(true);
    try {
      await onCleanQueue(type);
    } finally {
      setBulkLoading(false);
    }
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "N/A";
    return new Date(ts).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (start?: number, end?: number) => {
    if (!start) return "N/A";
    const finish = end || Date.now();
    const durationSec = Math.round((finish - start) / 1000);
    if (durationSec < 60) return `${durationSec} dtk`;
    const min = Math.floor(durationSec / 60);
    const sec = durationSec % 60;
    return `${min} mnt ${sec} dtk`;
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden">
      {/* Header with Queue Selector and Bulk Actions */}
      <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#0f172a] leading-tight flex items-center gap-2">
            <span>Manajemen Antrean & Inspeksi Job BullMQ</span>
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Kelola, periksa muatan data (payload), dan coba ulang job secara mendalam.
          </p>
        </div>

        {/* Queue Selector Tabs */}
        <div className="flex items-center gap-2">
          <div className="bg-[#f1f5f9] p-1 rounded-xl flex items-center gap-1 border border-[#e2e8f0]">
            <button
              type="button"
              onClick={() => onQueueNameChange("import")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus-utility-ring cursor-pointer min-h-[36px] ${
                queueName === "import"
                  ? "bg-white text-[#0f172a] shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#006877]" />
              <span>Worker Impor</span>
            </button>

            <button
              type="button"
              onClick={() => onQueueNameChange("ocr")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus-utility-ring cursor-pointer min-h-[36px] ${
                queueName === "ocr"
                  ? "bg-white text-[#0f172a] shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span>Worker OCR</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-bar: Status Tabs & Bulk Action Controls */}
      <div className="px-4 py-3 bg-white border-b border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onStatusChange(tab.value as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all focus-utility-ring shrink-0 cursor-pointer min-h-[36px] ${
                status === tab.value
                  ? "bg-[#00a2b9] text-white shadow-xs"
                  : "bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] border border-[#cbd5e1]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bulk Action Buttons (Super Admin Only) */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            {status === "failed" && jobs.length > 0 && (
              <button
                type="button"
                onClick={handleBulkRetry}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#006877] bg-[#f0fdfa] hover:bg-[#ccfbf1] border border-[#99f6e4] transition-all focus-utility-ring disabled:opacity-50 min-h-[36px] cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${bulkLoading ? "animate-spin" : ""}`} />
                <span>Coba Ulang Semua</span>
              </button>
            )}

            {status === "failed" && jobs.length > 0 && (
              <button
                type="button"
                onClick={() => handleBulkClean("failed")}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#b91c1c] bg-[#fef2f2] hover:bg-[#fee2e2] border border-[#fecaca] transition-all focus-utility-ring disabled:opacity-50 min-h-[36px] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan Gagal</span>
              </button>
            )}

            {status === "completed" && jobs.length > 0 && (
              <button
                type="button"
                onClick={() => handleBulkClean("completed")}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] transition-all focus-utility-ring disabled:opacity-50 min-h-[36px] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan Selesai</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Jobs Content List */}
      <div className="divide-y divide-[#f1f5f9]">
        {isLoading ? (
          <div className="py-12 text-center text-[#64748b] text-xs animate-pulse">
            Memuat daftar job dari antrean {queueName}...
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center text-[#64748b] text-xs">
            Tidak ada job pada status <span className="font-bold text-[#0f172a]">{status}</span> saat ini.
          </div>
        ) : (
          jobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            const isProcessingThisJob = actionLoadingJobId === job.id;

            return (
              <div key={job.id} className="p-4 hover:bg-[#f8fafc] transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {status === "active" && (
                        <div className="w-3 h-3 rounded-full bg-[#0284c7] animate-ping" />
                      )}
                      {status === "waiting" && (
                        <Clock className="w-4 h-4 text-[#0284c7]" />
                      )}
                      {status === "failed" && (
                        <AlertTriangle className="w-4 h-4 text-[#dc2626]" />
                      )}
                      {status === "completed" && (
                        <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#0f172a]">
                          Job #{job.id}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0] px-2 py-0.5 rounded-md">
                          {job.name}
                        </span>
                        {job.attemptsMade > 0 && (
                          <span className="text-[10px] text-[#64748b]">
                            Percobaan: {job.attemptsMade}x
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#64748b] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>Waktu: {formatTimestamp(job.timestamp)}</span>
                        {job.processedOn && (
                          <span>Durasi: {formatDuration(job.processedOn, job.finishedOn)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions per Job */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id || null)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] transition-all focus-utility-ring cursor-pointer min-h-[36px]"
                    >
                      <Code className="w-3.5 h-3.5 text-[#006877]" />
                      <span>{isExpanded ? "Tutup Data" : "Lihat Data"}</span>
                    </button>

                    {isSuperAdmin && status === "failed" && (
                      <button
                        type="button"
                        onClick={() => job.id && handleRetry(job.id)}
                        disabled={isProcessingThisJob || !job.id}
                        title="Coba ulang job ini"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#006877] bg-[#f0fdfa] hover:bg-[#ccfbf1] border border-[#99f6e4] transition-all focus-utility-ring disabled:opacity-50 min-h-[36px] cursor-pointer"
                      >
                        <RotateCw
                          className={`w-3.5 h-3.5 ${isProcessingThisJob ? "animate-spin" : ""}`}
                        />
                        <span>Coba Ulang</span>
                      </button>
                    )}

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => job.id && handleRemove(job.id)}
                        disabled={isProcessingThisJob || !job.id}
                        title="Hapus job dari antrean"
                        className="inline-flex items-center gap-1 p-2 rounded-xl text-xs font-semibold text-[#94a3b8] hover:text-[#b91c1c] hover:bg-[#fef2f2] border border-transparent hover:border-[#fecaca] transition-all focus-utility-ring disabled:opacity-50 min-h-[36px] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Failure Reason Pill */}
                {job.failedReason && (
                  <div className="mt-2.5 bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3 text-xs text-[#991b1b]">
                    <div className="font-bold flex items-center gap-1 mb-0.5 text-[#b91c1c]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Penyebab Kegagalan:
                    </div>
                    <div className="font-mono text-[11px] break-all">
                      {job.failedReason}
                    </div>
                  </div>
                )}

                {/* Expanded Details / Payload JSON */}
                {isExpanded && (
                  <div className="mt-3 bg-[#0f172a] text-slate-200 rounded-xl p-4 text-xs font-mono overflow-x-auto space-y-2 border border-[#334155] shadow-xs">
                    <div>
                      <span className="text-[#94a3b8] text-[10px] uppercase font-bold tracking-wider">Payload Data (JSON):</span>
                      <pre className="text-[11px] mt-1 text-[#5eead4]">
                        {JSON.stringify(job.data, null, 2)}
                      </pre>
                    </div>

                    {job.stacktrace && job.stacktrace.length > 0 && (
                      <div className="pt-2 border-t border-[#334155]">
                        <span className="text-[#fca5a5] text-[10px] uppercase font-bold tracking-wider">Stack Trace:</span>
                        <pre className="text-[10px] mt-1 text-[#fca5a5] overflow-x-auto">
                          {job.stacktrace.join("\n")}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#64748b]">
          <div>
            Halaman <span className="font-bold text-[#0f172a]">{currentPage}</span> dari{" "}
            <span className="font-bold text-[#0f172a]">{totalPages}</span> ({totalJobs} total job)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-utility-ring font-bold text-xs text-[#334155] min-h-[36px]"
            >
              <ChevronLeft className="w-4 h-4" />
              Sebelumnya
            </button>

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-utility-ring font-bold text-xs text-[#334155] min-h-[36px]"
            >
              Berikutnya
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
