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
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header with Queue Selector and Bulk Actions */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
            <span>Manajemen Antrean & Inspeksi Job BullMQ</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola, periksa muatan data (payload), dan coba ulang job secara mendalam
          </p>
        </div>

        {/* Queue Selector Tabs */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => onQueueNameChange("import")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-utility-ring ${
                queueName === "import"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#006877]" />
              <span>Worker Impor</span>
            </button>

            <button
              type="button"
              onClick={() => onQueueNameChange("ocr")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-utility-ring ${
                queueName === "ocr"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Worker OCR</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-bar: Status Tabs & Bulk Action Controls */}
      <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onStatusChange(tab.value as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-utility-ring shrink-0 ${
                status === tab.value
                  ? "bg-[#006877] text-white shadow-xs font-semibold"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
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
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors focus-utility-ring disabled:opacity-50 min-h-[32px] cursor-pointer"
              >
                <RotateCw className={`w-3 h-3 ${bulkLoading ? "animate-spin" : ""}`} />
                <span>Coba Ulang Semua</span>
              </button>
            )}

            {status === "failed" && jobs.length > 0 && (
              <button
                type="button"
                onClick={() => handleBulkClean("failed")}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors focus-utility-ring disabled:opacity-50 min-h-[32px] cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Bersihkan Gagal</span>
              </button>
            )}

            {status === "completed" && jobs.length > 0 && (
              <button
                type="button"
                onClick={() => handleBulkClean("completed")}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors focus-utility-ring disabled:opacity-50 min-h-[32px] cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Bersihkan Selesai</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Jobs Content List */}
      <div className="divide-y divide-slate-100">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Memuat daftar job dari antrean {queueName}...
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Tidak ada job pada status <span className="font-semibold">{status}</span> saat ini.
          </div>
        ) : (
          jobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            const isProcessingThisJob = actionLoadingJobId === job.id;

            return (
              <div key={job.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {status === "active" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping" />
                      )}
                      {status === "waiting" && (
                        <Clock className="w-4 h-4 text-blue-500" />
                      )}
                      {status === "failed" && (
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      )}
                      {status === "completed" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          Job #{job.id}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-slate-50 font-normal">
                          {job.name}
                        </Badge>
                        {job.attemptsMade > 0 && (
                          <span className="text-[10px] text-slate-400">
                            Percobaan: {job.attemptsMade}x
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-1">
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors focus-utility-ring"
                    >
                      <Code className="w-3 h-3" />
                      <span>{isExpanded ? "Tutup Data" : "Lihat Data"}</span>
                    </button>

                    {isSuperAdmin && status === "failed" && (
                      <button
                        type="button"
                        onClick={() => job.id && handleRetry(job.id)}
                        disabled={isProcessingThisJob || !job.id}
                        title="Coba ulang job ini"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors focus-utility-ring disabled:opacity-50"
                      >
                        <RotateCw
                          className={`w-3 h-3 ${isProcessingThisJob ? "animate-spin" : ""}`}
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
                        className="inline-flex items-center gap-1 p-1 rounded-md text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-utility-ring disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Failure Reason Pill */}
                {job.failedReason && (
                  <div className="mt-2.5 bg-rose-50/80 border border-rose-200/70 rounded-xl p-2.5 text-xs text-rose-800">
                    <div className="font-semibold flex items-center gap-1 mb-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      Penyebab Kegagalan:
                    </div>
                    <div className="font-mono text-[11px] break-all">
                      {job.failedReason}
                    </div>
                  </div>
                )}

                {/* Expanded Details / Payload JSON */}
                {isExpanded && (
                  <div className="mt-3 bg-slate-900 text-slate-200 rounded-xl p-3 text-xs font-mono overflow-x-auto space-y-2">
                    <div>
                      <span className="text-slate-400 text-[10px]">Payload Data (JSON):</span>
                      <pre className="text-[11px] mt-1 text-teal-300">
                        {JSON.stringify(job.data, null, 2)}
                      </pre>
                    </div>

                    {job.stacktrace && job.stacktrace.length > 0 && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-rose-400 text-[10px]">Stack Trace:</span>
                        <pre className="text-[10px] mt-1 text-rose-300 overflow-x-auto">
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
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div>
            Halaman <span className="font-bold">{currentPage}</span> dari{" "}
            <span className="font-bold">{totalPages}</span> ({totalJobs} total job)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-utility-ring font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Sebelumnya
            </button>

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-utility-ring font-medium"
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
