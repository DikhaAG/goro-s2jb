"use client";

import React, { useState } from "react";
import {
  Activity,
  FileSpreadsheet,
  AlertOctagon,
  Clock,
  Zap,
  CheckCircle2,
  Play,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AbortMigrationModal } from "./AbortMigrationModal";

export interface ActiveBatchProps {
  id: string;
  fileName: string;
  fileSize: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PAUSED" | "CANCELLED";
  totalRows: number;
  processedRows: number;
  failedRows: number;
  startedAt?: Date | string | null;
  uploadedBy?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

interface BatchProgressCardProps {
  batch: ActiveBatchProps;
  throughput: number; // rows/sec
  onCancel: (batchId: string) => Promise<void>;
  onResume?: (batchId: string) => Promise<void>;
  isActionLoading?: boolean;
}

export function BatchProgressCard({
  batch,
  throughput,
  onCancel,
  onResume,
  isActionLoading = false,
}: BatchProgressCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const percentage =
    batch.totalRows > 0
      ? Math.min(100, Math.round((batch.processedRows / batch.totalRows) * 100))
      : 0;

  // Calculate ETA
  let etaText = "Menghitung...";
  if (batch.totalRows > 0 && throughput > 0) {
    const remainingRows = Math.max(0, batch.totalRows - batch.processedRows);
    const secondsRemaining = Math.ceil(remainingRows / throughput);
    if (secondsRemaining < 60) {
      etaText = `~${secondsRemaining} dtk`;
    } else {
      const minutes = Math.floor(secondsRemaining / 60);
      const seconds = secondsRemaining % 60;
      etaText = `~${minutes} mnt ${seconds} dtk`;
    }
  } else if (batch.status === "PAUSED") {
    etaText = "Dijeda";
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleConfirmAbort = async () => {
    await onCancel(batch.id);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs relative overflow-hidden">
        {/* Top ambient brand line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#006877] via-[#00a2b9] to-[#0ea5e9]" />

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 border border-[#bae6fd]">
              <FileSpreadsheet className="w-5 h-5 text-[#006877]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[#0f172a] truncate max-w-[280px] sm:max-w-[400px]">
                  {batch.fileName}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    batch.status === "PROCESSING"
                      ? "bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd] animate-pulse"
                      : batch.status === "PAUSED"
                      ? "bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]"
                      : "bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      batch.status === "PROCESSING"
                        ? "bg-[#0284c7]"
                        : batch.status === "PAUSED"
                        ? "bg-[#f59e0b]"
                        : "bg-[#94a3b8]"
                    }`}
                  />
                  {batch.status === "PROCESSING" && "Sedang Berjalan"}
                  {batch.status === "PENDING" && "Menunggu Antrean"}
                  {batch.status === "PAUSED" && "Dijeda Sementara"}
                </span>
              </div>
              <p className="text-xs text-[#64748b] mt-0.5 font-mono">
                Ukuran: {formatFileSize(batch.fileSize)}
                {batch.uploadedBy?.name ? ` • Pengunggah: ${batch.uploadedBy.name}` : ""}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {batch.status === "PAUSED" && onResume && (
              <button
                type="button"
                onClick={() => onResume(batch.id)}
                disabled={isActionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#00a2b9] hover:bg-[#008c9f] transition-all focus-utility-ring min-h-[38px] cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Lanjutkan</span>
              </button>
            )}

            {(batch.status === "PROCESSING" || batch.status === "PENDING" || batch.status === "PAUSED") && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                disabled={isActionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#b91c1c] bg-[#fef2f2] hover:bg-[#fee2e2] border border-[#fecaca] transition-all focus-utility-ring min-h-[38px] cursor-pointer disabled:opacity-50"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Hentikan Migrasi</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="my-5 space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-[#0f172a]">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#006877]" />
              Progres Penyimpanan Metadata
            </span>
            <span className="font-mono text-sm text-[#006877]">{percentage}%</span>
          </div>
          <div className="w-full bg-[#f1f5f9] h-3 rounded-full overflow-hidden border border-[#e2e8f0]">
            <div
              className="bg-[#00a2b9] h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Multi-stage Metric Grid (Enterprise Monospace Numbers) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-4 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803d]" />
              Tersimpan di DB
            </div>
            <div className="text-2xl font-bold font-mono text-[#0f172a] mt-1">
              {batch.processedRows.toLocaleString("id-ID")}
              {batch.totalRows > 0 && (
                <span className="text-xs font-normal text-[#64748b]">
                  {" "}/ {batch.totalRows.toLocaleString("id-ID")}
                </span>
              )}
            </div>
          </div>

          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-4 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />
              Kecepatan Ingesti
            </div>
            <div className="text-2xl font-bold font-mono text-[#006877] mt-1">
              {throughput > 0 ? (
                <>
                  {throughput.toLocaleString("id-ID")}
                  <span className="text-xs font-normal text-[#64748b]"> baris/dtk</span>
                </>
              ) : (
                <span className="text-sm font-semibold text-[#94a3b8]">Menstabilkan</span>
              )}
            </div>
          </div>

          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-4 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#0284c7]" />
              Estimasi Selesai (ETA)
            </div>
            <div className="text-2xl font-bold font-mono text-[#0f172a] mt-1">
              {etaText}
            </div>
          </div>

          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-4 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-[#dc2626]" />
              Baris Galat
            </div>
            <div className="text-2xl font-bold font-mono text-[#b91c1c] mt-1">
              {batch.failedRows > 0 ? (
                batch.failedRows.toLocaleString("id-ID")
              ) : (
                <span className="text-[#15803d]">0</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <AbortMigrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmAbort}
        batchFileName={batch.fileName}
        processedRows={batch.processedRows}
        isLoading={isActionLoading}
      />
    </>
  );
}
