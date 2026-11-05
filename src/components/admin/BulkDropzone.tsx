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
  Info,
  X,
  HelpCircle,
  ExternalLink,
  Check,
} from "lucide-react";
import { useMigrationGuard } from "@/context/MigrationGuardContext";
import { InterruptedBatchRecoveryCard } from "./InterruptedBatchRecoveryCard";

export function BulkDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const targetType = "FORM_RESPONSES_RAW";
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [showColumnInfoModal, setShowColumnInfoModal] = useState(false);

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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#00a2b9] text-[#006877] bg-[#f0fdfa] text-xs font-bold self-start sm:self-auto">
            <Database className="w-3.5 h-3.5 text-[#00a2b9]" />
            <span>Resumable Stream Parser</span>
          </span>
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

          {/* Target Schema & Column Guidelines Banner */}
          <div className="p-4 rounded-2xl bg-[#f0fdfa] border border-[#bae6fd] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#bae6fd] flex items-center justify-center text-[#006877] shrink-0 shadow-xs">
                <FileSpreadsheet className="w-5 h-5 text-[#006877]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-[#0f172a]">
                    Format Data: Form Responses Google Form
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#006877]/10 text-[#006877] border border-[#006877]/20">
                    13 Kolom Acuan
                  </span>
                </div>
                <p className="text-xs text-[#475569] mt-0.5">
                  Streaming parser memproses rekam data Google Forms historis ulasan bintang 5 aplikasi PLN Mobile.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowColumnInfoModal(true)}
              className="min-h-[38px] px-3.5 py-1.5 bg-white hover:bg-slate-50 text-[#006877] border border-[#00a2b9] text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 self-start sm:self-auto shrink-0 cursor-pointer focus-utility-ring"
            >
              <Info className="w-4 h-4 text-[#00a2b9]" />
              <span>Panduan Format Kolom</span>
            </button>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 focus-utility-ring ${
              file
                ? "border-[#00a2b9] bg-[#f0fdfa]"
                : "border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] hover:border-[#00a2b9]"
            } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
            tabIndex={0}
            role="button"
            aria-label="Unggah berkas migrasi spreadsheet"
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isProcessing) {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#e2e8f0] flex items-center justify-center text-[#006877] shadow-xs">
              {file ? (
                <FileSpreadsheet className="w-7 h-7 text-[#15803d]" />
              ) : (
                <UploadCloud className="w-7 h-7 text-[#006877]" />
              )}
            </div>
            <div>
              <div className="text-sm font-bold text-[#0f172a]">
                {file ? file.name : "Pilih atau Seret Berkas CSV / XLSX ke Sini"}
              </div>
              <p className="text-xs text-[#64748b] mt-1">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB (Berkas siap dimigrasikan)`
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
              className="p-5 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] space-y-4 shadow-xs"
              aria-live="polite"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-[#006877] animate-pulse" />
                  <span className="text-xs font-bold text-[#0f172a]">
                    Progres Migrasi Aktif
                  </span>
                  <span className="text-xs font-mono text-[#64748b]">
                    ({batchData.id})
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isFinished
                      ? "bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]"
                      : isFailed
                      ? "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]"
                      : "bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isFinished
                        ? "bg-[#16a34a]"
                        : isFailed
                        ? "bg-[#ef4444]"
                        : "bg-[#f59e0b]"
                    }`}
                  />
                  {batchData.status}
                </span>
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
                  <span className="font-mono font-bold text-[#006877]">
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
                      className="h-full bg-[#00a2b9] transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  ) : isProcessing ? (
                    <div className="h-full bg-linear-to-r from-[#006877] via-[#00a2b9] to-[#006877] animate-pulse w-full rounded-full" />
                  ) : (
                    <div
                      className="h-full bg-[#00a2b9] rounded-full"
                      style={{ width: "100%" }}
                    />
                  )}
                </div>
              </div>

              {/* 3 Metric Cards (Enterprise Monospace Numbers) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs">
                  <span className="text-xs uppercase font-bold text-[#64748b] tracking-wider block">
                    Baris Sukses
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#15803d] mt-1">
                    {batchData.processedRows.toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs">
                  <span className="text-xs uppercase font-bold text-[#64748b] tracking-wider block">
                    Baris Gagal (Terisolasi)
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#b91c1c] mt-1">
                    {batchData.failedRows.toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs">
                  <span className="text-xs uppercase font-bold text-[#64748b] tracking-wider block">
                    Kecepatan Streaming
                  </span>
                  <div className="text-2xl font-bold font-mono text-[#006877] mt-1 flex items-baseline gap-1">
                    <span>{throughput > 0 ? throughput.toLocaleString("id-ID") : "-"}</span>
                    <span className="text-xs font-normal text-[#64748b]">baris/dtk</span>
                  </div>
                </div>
              </div>

              {/* Error list preview if any */}
              {batchData.errors && batchData.errors.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-bold text-[#b91c1c] flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Log Galat Baris Terisolasi (Proses Tidak Dihentikan):</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-xs font-mono text-[#7f1d1d] space-y-1.5">
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
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setActiveBatchId(null);
              setUploadError(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            disabled={isProcessing}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-bold text-[#334155] transition-all min-h-[44px] flex items-center justify-center gap-2 focus-utility-ring cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Bersihkan Pilihan</span>
          </button>

          <button
            type="button"
            onClick={handleStartImport}
            disabled={!file || isProcessing || isUploading}
            className="w-full sm:w-auto min-w-[220px] px-5 py-2.5 rounded-xl bg-[#00a2b9] hover:bg-[#008c9f] text-white min-h-[44px] text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all focus-utility-ring cursor-pointer disabled:opacity-50"
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
          </button>
        </div>
      </div>

      {/* 3. Modal Panduan Format Kolom Google Form */}
      {showColumnInfoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#e7eeff] border border-[#bae6fd] flex items-center justify-center text-[#006877] shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-[#006877]" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[#0f172a]">
                    Panduan Format Kolom Berkas Google Form Responses
                  </h3>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    Berkas CSV atau XLSX wajib memiliki 13 urutan kolom berikut agar parser dapat memproses rekam data dengan presisi.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowColumnInfoModal(false)}
                className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200 transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Highlight Alert */}
              <div className="p-3.5 bg-[#f0fdfa] border border-[#bae6fd] rounded-xl text-[#006877] flex items-start gap-2.5">
                <Zap className="w-4 h-4 shrink-0 mt-0.5 text-[#00a2b9] fill-[#00a2b9]" />
                <div className="space-y-1">
                  <p className="font-bold text-xs text-[#0f172a]">
                    Fitur Otomatisasi AI Zona Hijau (Skor OCR &ge; 90%):
                  </p>
                  <p className="text-xs text-[#475569]">
                    Setiap baris data dengan skor kecocokan fuzzy OCR dalam zona hijau (&ge; 90%) otomatis disetujui (Status Validasi = TRUE / APPROVED) saat ekstraksi OCR selesai.
                  </p>
                </div>
              </div>

              {/* Table of Columns */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-[#475569] font-bold">
                    <tr>
                      <th className="py-2.5 px-3 w-16 text-center">No</th>
                      <th className="py-2.5 px-3 w-48">Nama Kolom Acuan</th>
                      <th className="py-2.5 px-3 w-40">Tipe / Format</th>
                      <th className="py-2.5 px-3">Contoh Nilai & Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white text-[#0f172a]">
                    <tr>
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">1 (A)</td>
                      <td className="py-2 px-3 font-bold">Timestamp</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Tanggal & Waktu</td>
                      <td className="py-2 px-3 text-[#475569]">
                        <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">7/2/2026 11:02:22</code> Waktu submit form
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">2 (B)</td>
                      <td className="py-2 px-3 font-bold">UP3</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Teks (Wajib)</td>
                      <td className="py-2 px-3 text-[#475569]">
                        Contoh: <span className="font-semibold text-[#0f172a]">UP3 Palembang</span>, UP3 Jambi, UP3 Ogan Ilir
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">3 (C)</td>
                      <td className="py-2 px-3 font-bold">ULP</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Teks (Wajib)</td>
                      <td className="py-2 px-3 text-[#475569]">
                        Contoh: <span className="font-semibold text-[#0f172a]">ULP Rivai</span>, ULP Kenten, ULP Ampera
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">4 (D)</td>
                      <td className="py-2 px-3 font-bold">Nama Pengulas Play Store</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Teks (Wajib)</td>
                      <td className="py-2 px-3 text-[#475569]">
                        Nama akun Google yang menulis ulasan di Google Play Store
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">5 (E)</td>
                      <td className="py-2 px-3 font-bold">Tanggal Masuk (Entry Date)</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Tanggal (DD/MM/YYYY)</td>
                      <td className="py-2 px-3 text-[#475569]">
                        Contoh: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">25/07/2026</code>
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">6 (F)</td>
                      <td className="py-2 px-3 font-bold">Tautan Bukti Gambar</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">URL Google Drive</td>
                      <td className="py-2 px-3 text-[#475569]">
                        <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-xs break-all">https://drive.google.com/file/d/ID_FILE/view</code>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">7 (G)</td>
                      <td className="py-2 px-3 font-bold">Versi Aplikasi PLN Mobile</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Teks</td>
                      <td className="py-2 px-3 text-[#475569]">
                        Contoh: <span className="font-semibold text-[#0f172a]">V5.2.79</span> (default: V5.2.79)
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">8 (H)</td>
                      <td className="py-2 px-3 font-bold">Nama Pengulas Asli</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Teks (Opsional)</td>
                      <td className="py-2 px-3 text-[#475569]">Nama asli pengulas jika berbeda dengan akun Play Store</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">9 (I)</td>
                      <td className="py-2 px-3 font-bold">Kategori Pengulas</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Teks</td>
                      <td className="py-2 px-3 text-[#475569]">Contoh: Pelanggan, Pegawai, atau Mitra</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">10 (J)</td>
                      <td className="py-2 px-3 font-bold">Catatan Lapangan</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Teks (Opsional)</td>
                      <td className="py-2 px-3 text-[#475569]">Catatan khusus oleh petugas survei / lapangan</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">11 (K)</td>
                      <td className="py-2 px-3 font-bold">Indikator Duplikasi</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Boolean / Teks</td>
                      <td className="py-2 px-3 text-[#475569]">
                        <span className="font-mono font-semibold text-rose-600">YA</span> (Duplikat) atau <span className="font-mono font-semibold text-emerald-600">TIDAK</span>
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">12 (L)</td>
                      <td className="py-2 px-3 font-bold">Status Validasi Awal</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Boolean / Status</td>
                      <td className="py-2 px-3 text-[#475569]">
                        Nilai <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">1 / TRUE</code> (Approved) atau <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">0 / FALSE</code>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-center font-mono font-bold text-[#006877]">13 (M)</td>
                      <td className="py-2 px-3 font-bold">Catatan Review (Remarks)</td>
                      <td className="py-2 px-3 font-mono text-[#64748b]">Teks (Opsional)</td>
                      <td className="py-2 px-3 text-[#475569]">Keterangan hasil verifikasi atau ulasan manual</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Format Tips */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs text-[#64748b]">
                <p className="font-bold text-[#0f172a]">Catatan Teknis:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Format berkas yang didukung adalah <strong>.CSV (UTF-8)</strong> dan <strong>.XLSX</strong>.</li>
                  <li>Baris header pertama akan dilewati secara otomatis oleh streaming parser jika mengandung kata "Timestamp" atau "Column".</li>
                  <li>Streaming parser menggunakan alokasi memori dinamis hemat sumber daya (&lt;200MB) bahkan untuk berkas berukuran &gt;140.000 baris.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowColumnInfoModal(false)}
                className="px-4 py-2 bg-[#006877] hover:bg-[#00525e] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Mengerti & Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
