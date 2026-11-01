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
        className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2e8f0] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ecfdf5] text-[#15803d] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0f172a]">
                Panen Data Latih (Cold-Start)
              </h3>
              <p className="text-xs text-[#64748b]">
                Dari ulasan tercentang/disetujui pada spreadsheet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-slate-100 transition-colors cursor-pointer focus-utility-ring"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {result ? (
            <div className="p-4 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#15803d] text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-[#15803d]">
                <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
                Panen Data Selesai Diproses!
              </div>
              <div className="pt-2 border-t border-[#a7f3d0]/60 space-y-1.5 text-xs text-[#334155]">
                <div className="flex justify-between items-center">
                  <span>Berhasil diimpor ke data latih:</span>
                  <strong className="font-mono text-[#15803d]">{result.imported} sampel</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>Dilewati (Duplikat / Buram):</span>
                  <span className="font-mono text-[#64748b]">{result.skipped} sampel</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs text-[#334155]">
              <p className="leading-relaxed">
                Fitur ini memindai baris data ulasan historis (impor Google Form / Spreadsheet) yang telah berstatus <strong className="text-[#0f172a]">APPROVED</strong> dan memiliki eviden citra valid, lalu mendaftarkannya sebagai dataset awal untuk pelatihan model deep learning OCR.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                  Batas Jumlah Baris Pemindaian (Batch Size)
                </label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2.5 min-h-[44px] rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#0f172a] transition-all focus-utility-ring"
                >
                  <option value={100}>100 Baris Pertama</option>
                  <option value={250}>250 Baris</option>
                  <option value={500}>500 Baris (Direkomendasikan)</option>
                  <option value={1000}>1000 Baris (Maksimal)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-xl transition-all cursor-pointer focus-utility-ring"
          >
            {result ? "Selesai" : "Batal"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleStart}
              disabled={harvestMutation.isPending}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#00a2b9] hover:bg-[#008c9f] rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring"
            >
              {harvestMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Panen Data...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-white" />
                  <span>Mulai Panen Data</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
