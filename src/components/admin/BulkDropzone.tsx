"use client";

import React, { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
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
  Sparkles,
} from "lucide-react";

export function BulkDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [targetType, setTargetType] = useState<"FORM_RESPONSES_RAW" | "HISTORICAL_REPORTS">("FORM_RESPONSES_RAW");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const startMutation = trpc.migration.startMigration.useMutation();

  // Poll status of active batch
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
    } catch (err: any) {
      console.error("Migration error:", err);
      setUploadError(err.message || "Gagal memulai proses migrasi berkas");
    } finally {
      setIsUploading(false);
    }
  };

  const batchData = batchStatusQuery.data;
  const isFinished = batchData?.status === "COMPLETED";
  const isFailed = batchData?.status === "FAILED";
  const isProcessing = batchData?.status === "PROCESSING" || batchData?.status === "PENDING";

  return (
    <Card className="border-slate-800 bg-[#0d1424]/90 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-cyan-500" />

      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="warning" className="gap-1.5 py-1">
            <Database className="w-3.5 h-3.5" />
            <span>Memory-Safe Bulk Ingestion</span>
          </Badge>
          <span className="text-[11px] font-mono text-slate-400">
            Fase 2: Sub-track 2.3 & 2.4
          </span>
        </div>
        <CardTitle className="text-xl font-bold text-white mt-2">
          Migrasi Berkas Historis (CSV / XLSX)
        </CardTitle>
        <CardDescription>
          Unggah berkas rekam data ulasan lama (&gt;140.000 baris) untuk dimigrasikan secara asinkron tanpa membebani memori server.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {uploadError && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-sm text-red-300">Kesalahan Unggah Berkas</div>
              <div>{uploadError}</div>
            </div>
          </div>
        )}

        {/* 1. Target Schema Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400 mr-1" />
            Target Skema Data
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTargetType("FORM_RESPONSES_RAW")}
              disabled={isProcessing}
              className={`p-3.5 rounded-lg border text-left transition flex flex-col justify-between ${
                targetType === "FORM_RESPONSES_RAW"
                  ? "bg-cyan-950/40 border-cyan-500/60 text-white shadow-md shadow-cyan-950/40"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="font-bold text-sm text-slate-200 flex items-center justify-between">
                <span>Form Responses (13 Kolom)</span>
                {targetType === "FORM_RESPONSES_RAW" && (
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Data ulasan mentah Play Store dari Google Forms historis.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTargetType("HISTORICAL_REPORTS")}
              disabled={isProcessing}
              className={`p-3.5 rounded-lg border text-left transition flex flex-col justify-between ${
                targetType === "HISTORICAL_REPORTS"
                  ? "bg-amber-950/40 border-amber-500/60 text-white shadow-md shadow-amber-950/40"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="font-bold text-sm text-slate-200 flex items-center justify-between">
                <span>Laporan Harian / Bulanan</span>
                {targetType === "HISTORICAL_REPORTS" && (
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Rekap capaian historis unit dan perbandingan target operasional.
              </p>
            </button>
          </div>
        </div>

        {/* 2. Drag & Drop Area */}
        <div
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 bg-slate-950/40 hover:bg-slate-900/60 ${
            file
              ? "border-cyan-500/60 bg-cyan-950/10"
              : "border-slate-700/80 hover:border-cyan-500/60"
          } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400">
            {file ? (
              <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
            ) : (
              <UploadCloud className="w-7 h-7 text-slate-300" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              {file ? file.name : "Pilih atau Seret Berkas CSV / XLSX ke Sini"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Siap diproses`
                : "Mendukung format .csv, .xlsx, atau .xls (Ukuran hingga >100 MB didukung via streaming)"}
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

        {/* 3. Realtime Processing Monitor */}
        {activeBatchId && batchData && (
          <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Batch ID:</span>
                <span className="font-mono text-xs text-cyan-300 font-bold">{batchData.id}</span>
              </div>
              <Badge
                variant={
                  isFinished
                    ? "success"
                    : isFailed
                    ? "destructive"
                    : "warning"
                }
              >
                {batchData.status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Baris Diproses</div>
                <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                  {batchData.processedRows.toLocaleString("id-ID")}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Baris Gagal</div>
                <div className="text-xl font-bold font-mono text-red-400 mt-1">
                  {batchData.failedRows.toLocaleString("id-ID")}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Status Worker</div>
                <div className="text-sm font-semibold font-mono text-emerald-400 mt-2 flex items-center justify-center space-x-1">
                  {isProcessing && <Clock className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isProcessing ? "Streaming" : isFinished ? "Selesai" : "Gagal"}</span>
                </div>
              </div>
            </div>

            {/* Error logs table preview if any errors occurred */}
            {batchData.errors && batchData.errors.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-red-400 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Log Error Baris Terisolasi (Tidak Menghentikan Proses):</span>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-red-950/60 bg-red-950/20 p-2 text-[11px] font-mono text-slate-300 space-y-1">
                  {batchData.errors.map((err) => (
                    <div key={err.id} className="border-b border-red-900/30 pb-1">
                      <span className="text-red-400">Baris #{err.rowNumber}:</span> {err.errorReason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-950/50">
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
          className="w-full sm:w-auto text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Bersihkan
        </Button>

        <Button
          type="button"
          variant="tactical"
          onClick={handleStartImport}
          disabled={!file || isProcessing || isUploading}
          className="w-full sm:w-auto min-w-[220px]"
        >
          {isUploading ? (
            <span className="flex items-center space-x-2">
              <Clock className="w-4 h-4 animate-spin text-slate-950" />
              <span>Mengunggah Berkas...</span>
            </span>
          ) : isProcessing ? (
            <span className="flex items-center space-x-2">
              <Clock className="w-4 h-4 animate-spin text-slate-950" />
              <span>Worker Memproses...</span>
            </span>
          ) : (
            <span className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Mulai Migrasi Massal</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
