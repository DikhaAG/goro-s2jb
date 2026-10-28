"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Play,
  XCircle,
  FileSpreadsheet,
  Clock,
  RotateCw,
} from "lucide-react";
import { MigrationBatchData, useMigrationGuard } from "@/context/MigrationGuardContext";

interface InterruptedBatchRecoveryCardProps {
  batch: MigrationBatchData;
  onResumed?: () => void;
  onCancelled?: () => void;
}

export function InterruptedBatchRecoveryCard({
  batch,
  onResumed,
  onCancelled,
}: InterruptedBatchRecoveryCardProps) {
  const { resumeBatch, cancelBatch, isActionLoading } = useMigrationGuard();

  const handleResume = async () => {
    try {
      await resumeBatch(batch.id);
      onResumed?.();
    } catch (err: any) {
      alert(err.message || "Gagal melanjutkan migrasi");
    }
  };

  const handleCancel = async () => {
    if (!confirm("Apakah Anda yakin ingin membatalkan migrasi batch ini? Data yang telah diimpor tetap tersimpan.")) {
      return;
    }
    try {
      await cancelBatch(batch.id);
      onCancelled?.();
    } catch (err: any) {
      alert(err.message || "Gagal membatalkan migrasi");
    }
  };

  const formattedDate = new Date(batch.updatedAt).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div
      role="region"
      aria-label="Pemberitahuan Pemulihan Migrasi Terhenti"
      className="p-5 sm:p-6 rounded-2xl bg-[#fffbeb] border-2 border-[#f59e0b] shadow-xs space-y-4 text-[#0f172a]"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#fde68a] pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#d97706] text-white flex items-center justify-center shrink-0 shadow-xs">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#92400e] leading-snug">
              Migrasi Terputus Terdeteksi
            </h3>
            <p className="text-xs text-[#b45309]">
              Sistem mencatat posisi terakhir sebelum sesi terhenti. Anda dapat melanjutkan proses tanpa mengulang dari awal.
            </p>
          </div>
        </div>
        <Badge variant="warning" className="self-start sm:self-auto bg-[#fef3c7] text-[#92400e] border-[#fde68a]">
          Status: {batch.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-white border border-[#fde68a] space-y-1">
          <span className="text-[#78350f] font-medium flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#d97706]" />
            Nama Berkas
          </span>
          <div className="font-semibold text-[#0f172a] truncate" title={batch.fileName}>
            {batch.fileName}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#fde68a] space-y-1">
          <span className="text-[#78350f] font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#d97706]" />
            Waktu Terhenti
          </span>
          <div className="font-semibold text-[#0f172a]">{formattedDate}</div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#fde68a] space-y-1">
          <span className="text-[#78350f] font-medium flex items-center gap-1">
            <RotateCw className="w-3.5 h-3.5 text-[#d97706]" />
            Posisi Checkpoint Baris
          </span>
          <div className="font-bold text-[#b45309] font-mono text-sm">
            Baris ke-{batch.lastProcessedRow.toLocaleString("id-ID")}
            <span className="text-xs font-normal text-[#64748b] ml-1">
              ({batch.processedRows.toLocaleString("id-ID")} berhasil)
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isActionLoading}
          className="w-full sm:w-auto border-[#d97706] text-[#92400e] hover:bg-[#fef3c7] min-h-[44px] text-xs font-semibold"
        >
          <XCircle className="w-4 h-4 mr-1.5" />
          <span>Batalkan Batch</span>
        </Button>

        <Button
          type="button"
          onClick={handleResume}
          disabled={isActionLoading}
          className="w-full sm:w-auto bg-[#006877] hover:bg-[#00515d] text-white min-h-[44px] text-xs font-bold shadow-xs flex items-center justify-center gap-2"
        >
          {isActionLoading ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin text-white" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-white fill-white" />
              <span>Lanjutkan Migrasi dari Checkpoint</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
