"use client";

import React, { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Layers,
  ArrowRight,
  Database,
  Activity,
  Zap,
} from "lucide-react";
import { useMigrationGuard } from "@/context/MigrationGuardContext";
import { InterruptedBatchRecoveryCard } from "./InterruptedBatchRecoveryCard";

export function BulkDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [targetType, setTargetType] = useState<"FORM_RESPONSES_RAW" | "HISTORICAL_REPORTS">("FORM_RESPONSES_RAW");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    activeBatch,
    hasInterruptedBatch,
    isMigrationActive,
    progressPercentage,
    throughput,
    refetchStatus,
  } = useMigrationGuard();

  const startMutation = trpc.migration.startMigration.useMutation();

  // If there's already an active or interrupted batch from context, sync activeBatchId
  useEffect(() => {
    if (activeBatch && (activeBatch.status === "PROCESSING" || activeBatch.status === "PENDING")) {
      setActiveBatchId(activeBatch.id);
    }
  }, [activeBatch]);

  // Query specific batch status if activeBatchId is set
  const batchStatusQuery = trpc.migration.getBatchStatus.useQuery(
    { batchId: activeBatchId || "" },
    {
      enabled: Boolean(activeBatchId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "PROCESSING" || status === "PENDING") {
          return 1500;
        }
        return false;
      },
    }
  );

  const batchData = batchStatusQuery.data || (activeBatch?.id === activeBatchId ? activeBatch : null);
  const isFinished = batchData?.status === "COMPLETED";
  const isFailed = batchData?.status === "FAILED";
  const isProcessing = batchData?.status === "PROCESSING" || batchData?.status === "PENDING";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setUploadError(null);
    }
  };

  const handleStartImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // 1. Upload physical file to server storage
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "migration");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json();
        throw new Error(errJson.error || "Gagal mengunggah berkas ke server");
      }

      const uploadData = await uploadRes.json();

      // 2. Start background BullMQ migration
      const result = await startMutation.mutateAsync({
        filePath: uploadData.filePath,
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        targetType,
      });

      setActiveBatchId(result.batchId);
      await refetchStatus();
    } catch (err: any) {
      console.error("Migration error:", err);
      setUploadError(err.message || "Gagal memulai proses migrasi berkas");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Recovery Card if Interrupted Batch Exists */}
      {hasInterruptedBatch && activeBatch && (
        <InterruptedBatchRecoveryCard
          batch={activeBatch}
          onResumed={() => {
            setActiveBatchId(activeBatch.id);
            refetchStatus();
          }}
          onCancelled={() => {
            setActiveBatchId(null);
            refetchStatus();
          }}
        />
      )}

      {/* 2. Main Dropzone Card (Modern Utility Minimalism) */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden">
        {/* Header Ribbon */}
        <div className="p-5 sm:p-6 border-b border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00a2b9]" />
              <h2 className="text-lg font-bold text-[#0f172a] tracking-tight">
                Migrasi Massal Berkas Historis
              </h2>
            </div>
            <p className="text-xs text-[#64748b] mt-1">
              Streaming parser memproses berkas skala besar (&gt;140.000 baris) dengan penggunaan memori stabil.
            </p>
          </div>
          <Badge variant="outline" className="border-[#00a2b9] text-[#006877] bg-[#f0fdfa] self-start sm:self-auto gap-1 text-xs">
            <Database className="w-3.5 h-3.5 text-[#00a2b9]" />
            <span>Resumable Stream Parser</span>
          </Badge>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Error Banner */}
          {uploadError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] flex items-start space-x-3 text-xs"
            >
              <AlertTriangle className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-[#b91c1c]">Kesalahan Unggah Berkas</div>
                <div>{uploadError}</div>
              </div>
            </div>
          )}

          {/* Target Schema Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#0f172a] flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-[#006877]" />
              <span>Target Skema Data</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetType("FORM_RESPONSES_RAW")}
                disabled={isProcessing}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer min-h-[44px] ${
                  targetType === "FORM_RESPONSES_RAW"
                    ? "bg-[#f0fdfa] border-[#00a2b9] text-[#006877] shadow-xs ring-1 ring-[#00a2b9]"
                    : "bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]"
                }`}
              >
                <div className="font-bold text-sm text-[#0f172a] flex items-center justify-between">
                  <span>Form Responses (13 Kolom)</span>
                  {targetType === "FORM_RESPONSES_RAW" && (
                    <CheckCircle2 className="w-4 h-4 text-[#00a2b9]" />
                  )}
                </div>
                <p className="text-[11px] text-[#64748b] mt-1">
                  Data ulasan mentah Play Store dari Google Forms historis.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetType("HISTORICAL_REPORTS")}
                disabled={isProcessing}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer min-h-[44px] ${
                  targetType === "HISTORICAL_REPORTS"
                    ? "bg-[#f0fdfa] border-[#00a2b9] text-[#006877] shadow-xs ring-1 ring-[#00a2b9]"
                    : "bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]"
                }`}
              >
                <div className="font-bold text-sm text-[#0f172a] flex items-center justify-between">
                  <span>Laporan Harian / Bulanan</span>
                  {targetType === "HISTORICAL_REPORTS" && (
                    <CheckCircle2 className="w-4 h-4 text-[#00a2b9]" />
                  )}
                </div>
                <p className="text-[11px] text-[#64748b] mt-1">
                  Rekap capaian historis unit dan perbandingan target operasional.
                </p>
              </button>
            </div>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
              file
                ? "border-[#00a2b9] bg-[#f0fdfa]"
                : "border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] hover:border-[#006877]"
            } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#e2e8f0] flex items-center justify-center text-[#006877] shadow-xs">
              {file ? (
                <FileSpreadsheet className="w-7 h-7 text-[#15803d]" />
              ) : (
                <UploadCloud className="w-7 h-7 text-[#006877]" />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-[#0f172a]">
                {file ? file.name : "Pilih atau Seret Berkas CSV / XLSX ke Sini"}
              </div>
              <p className="text-xs text-[#64748b] mt-1">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Berkas siap dimigrasikan`
                  : "Mendukung format .csv, .xlsx, atau .xls (Ukuran >100 MB didukung melalui streaming)"}
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            disabled={isProcessing}
            className="hidden"
          />

          {/* Realtime Live Progress Bar and Metrics Panel */}
          {activeBatchId && batchData && (
            <div
              className="p-5 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] space-y-4"
              aria-live="polite"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-[#006877] animate-pulse" />
                  <span className="text-xs font-semibold text-[#0f172a]">
                    Progres Migrasi Aktif
                  </span>
                  <span className="text-[11px] font-mono text-[#64748b]">
                    ({batchData.id})
                  </span>
                </div>
                <Badge
                  variant={
                    isFinished
                      ? "success"
                      : isFailed
                      ? "destructive"
                      : "warning"
                  }
                  className="self-start sm:self-auto"
                >
                  {batchData.status}
                </Badge>
              </div>

              {/* Progress Bar Container with ARIA */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-[#0f172a]">
                    {isProcessing
                      ? "Sedang memproses streaming data..."
                      : isFinished
                      ? "Migrasi selesai sepenuhnya"
                      : "Migrasi dihentikan"}
                  </span>
                  <span className="font-mono text-[#006877]">
                    {batchData.totalRows && batchData.totalRows > 0
                      ? `${progressPercentage}%`
                      : `${batchData.processedRows.toLocaleString("id-ID")} baris`}
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={progressPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progres Migrasi Data"
                  className="w-full h-3 rounded-full bg-[#e2e8f0] overflow-hidden relative"
                >
                  {batchData.totalRows && batchData.totalRows > 0 ? (
                    <div
                      className="h-full bg-[#006877] transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  ) : isProcessing ? (
                    <div className="h-full bg-gradient-to-r from-[#006877] via-[#00a2b9] to-[#006877] animate-pulse w-full rounded-full" />
                  ) : (
                    <div
                      className="h-full bg-[#006877] rounded-full"
                      style={{ width: "100%" }}
                    />
                  )}
                </div>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-[#64748b]">
                    Baris Sukses
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#15803d] mt-0.5">
                    {batchData.processedRows.toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-[#64748b]">
                    Baris Gagal (Terisolasi)
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#b91c1c] mt-0.5">
                    {batchData.failedRows.toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-[#64748b]">
                    Kecepatan Streaming
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#006877] mt-0.5 flex items-baseline gap-1">
                    <span>{throughput > 0 ? throughput.toLocaleString("id-ID") : "-"}</span>
                    <span className="text-xs font-normal text-[#64748b]">baris/dtk</span>
                  </div>
                </div>
              </div>

              {/* Error list preview if any */}
              {batchData.errors && batchData.errors.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold text-[#b91c1c] flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Log Galat Baris Terisolasi (Proses Tidak Dihentikan):</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-[11px] font-mono text-[#7f1d1d] space-y-1.5">
                    {batchData.errors.map((err) => (
                      <div key={err.id} className="border-b border-[#fee2e2] pb-1 last:border-0 last:pb-0">
                        <span className="font-bold text-[#991b1b]">Baris #{err.rowNumber}:</span> {err.errorReason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#f1f5f9] bg-[#f8fafc] flex flex-col sm:flex-row gap-3 justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFile(null);
              setActiveBatchId(null);
              setUploadError(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            disabled={isProcessing}
            className="w-full sm:w-auto text-xs text-[#64748b] hover:text-[#0f172a] min-h-[44px]"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Bersihkan Pilihan</span>
          </Button>

          <Button
            type="button"
            onClick={handleStartImport}
            disabled={!file || isProcessing || isUploading}
            className="w-full sm:w-auto min-w-[220px] bg-[#006877] hover:bg-[#00515d] text-white min-h-[44px] text-xs font-bold shadow-xs flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Clock className="w-4 h-4 animate-spin text-white" />
                <span>Mengunggah Berkas ke Server...</span>
              </>
            ) : isProcessing ? (
              <>
                <Clock className="w-4 h-4 animate-spin text-white" />
                <span>Worker Memproses Data...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-white fill-white" />
                <span>Mulai Migrasi Massal</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
