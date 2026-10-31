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
      etaText = `~${secondsRemaining} detik`;
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
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        {/* Top ambient glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#006877] via-[#0ea5e9] to-[#f97316]" />

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#006877] flex items-center justify-center shrink-0 border border-teal-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-[280px] sm:max-w-[400px]">
                  {batch.fileName}
                </h3>
                <Badge
                  variant="outline"
                  className={
                    batch.status === "PROCESSING"
                      ? "bg-teal-50 text-teal-700 border-teal-200 animate-pulse"
                      : batch.status === "PAUSED"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }
                >
                  {batch.status === "PROCESSING" && "Sedang Berjalan"}
                  {batch.status === "PENDING" && "Menunggu Antrean"}
                  {batch.status === "PAUSED" && "Dijeda Sementara"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#006877] hover:bg-[#00525e] transition-colors focus-utility-ring min-h-[36px] cursor-pointer disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors focus-utility-ring min-h-[36px] cursor-pointer disabled:opacity-50"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Hentikan Migrasi</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="my-5">
          <div className="flex justify-between items-center text-xs font-medium text-slate-600 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#006877]" />
              Progres Penyimpanan Metadata
            </span>
            <span className="font-bold text-slate-900">{percentage}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
            <div
              className="bg-linear-to-r from-[#006877] to-[#0ea5e9] h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Multi-stage Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Tersimpan di DB
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {batch.processedRows.toLocaleString("id-ID")}
              {batch.totalRows > 0 && (
                <span className="text-xs font-normal text-slate-400">
                  {" "}/ {batch.totalRows.toLocaleString("id-ID")}
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              Kecepatan Ingesti
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {throughput > 0 ? (
                <>
                  {throughput.toLocaleString("id-ID")}
                  <span className="text-xs font-normal text-slate-500"> baris/dtk</span>
                </>
              ) : (
                <span className="text-xs font-medium text-slate-400">Menstabilkan</span>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-500" />
              Estimasi Selesai (ETA)
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {etaText}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <AlertOctagon className="w-3 h-3 text-rose-500" />
              Baris Galat
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {batch.failedRows > 0 ? (
                <span className="text-rose-600">{batch.failedRows.toLocaleString("id-ID")}</span>
              ) : (
                <span className="text-emerald-600 font-semibold">0</span>
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
