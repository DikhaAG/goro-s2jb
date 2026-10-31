"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  X,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

interface ColdStartHarvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
}

export function ColdStartHarvestModal({
  isOpen,
  onClose,
  onSuccess,
}: ColdStartHarvestModalProps) {
  const [batchSize, setBatchSize] = useState<number>(500);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const harvestMutation = trpc.ocrTraining.triggerColdStartHarvest.useMutation({
    onSuccess: (data) => {
      setResult({
        imported: data.totalImported,
        skipped: data.skippedExisting,
      });
      onSuccess(data.totalImported);
    },
    onError: (err) => {
      setErrorMsg(err.message || "Gagal memproses ekstraksi data historis.");
    },
  });

  if (!isOpen) return null;

  const handleStart = () => {
    setErrorMsg(null);
    setResult(null);
    harvestMutation.mutate({ batchSize });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Panen Data Latih (Cold-Start)
              </h3>
              <p className="text-xs text-slate-500">
                Dari ulasan tercentang/disetujui pada spreadsheet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {result ? (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Panen Data Selesai Diproses!
            </div>
            <div className="pt-2 border-t border-emerald-200/60 space-y-1">
              <div className="flex justify-between">
                <span>Berhasil diimpor ke data latih:</span>
                <strong>{result.imported} sampel</strong>
              </div>
              <div className="flex justify-between">
                <span>Dilewati (Duplikat / Buram):</span>
                <span>{result.skipped} sampel</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-xs text-slate-600">
            <p className="leading-relaxed">
              Fitur ini akan memindai baris data ulasan historis (impor Google Form / Spreadsheet) yang telah berstatus <strong>APPROVED</strong> dan memiliki eviden citra valid, lalu mendaftarkannya sebagai dataset awal untuk pelatihan model deep learning OCR.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Batas Jumlah Baris Pemindaian (Batch Size)
              </label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value={100}>100 Baris Pertama</option>
                <option value={250}>250 Baris</option>
                <option value={500}>500 Baris (Direkomendasikan)</option>
                <option value={1000}>1000 Baris (Maksimal)</option>
              </select>
            </div>
          </div>
        )}

        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            {result ? "Selesai" : "Batal"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleStart}
              disabled={harvestMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {harvestMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses Panen Data...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Mulai Panen Data
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
