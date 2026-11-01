"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  X,
  Cpu,
  Zap,
  Layers,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface TrainingTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (jobId: string) => void;
  totalApprovedSamples: number;
}

export function TrainingTriggerModal({
  isOpen,
  onClose,
  onSuccess,
  totalApprovedSamples,
}: TrainingTriggerModalProps) {
  const [mode, setMode] = useState<"FAST" | "STANDARD" | "FULL">("FAST");
  const [targetVersion, setTargetVersion] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const enqueueMutation = trpc.ocrTraining.enqueueManualTraining.useMutation({
    onSuccess: (data) => {
      onSuccess(data.jobId);
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err.message || "Gagal memasukkan pekerjaan pelatihan ke antrean.");
    },
  });

  if (!isOpen) return null;

  const presets = {
    FAST: {
      label: "Mode Cepat (Fast)",
      epochs: 5,
      batchSize: 8,
      lr: 0.001,
      desc: "5 epoch komputasi cepat. Ideal untuk iterasi kilat dan pengetesan model harian.",
    },
    STANDARD: {
      label: "Mode Standar (Balanced)",
      epochs: 10,
      batchSize: 8,
      lr: 0.0008,
      desc: "10 epoch komputasi seimbang antara konvergensi loss dan waktu pelatihan.",
    },
    FULL: {
      label: "Mode Penuh (Maximum Accuracy)",
      epochs: 20,
      batchSize: 16,
      lr: 0.0005,
      desc: "20 epoch komputasi mendalam. Disarankan saat dataset telah bertambah signifikan.",
    },
  };

  const handleStart = async () => {
    setErrorMsg(null);
    const selected = presets[mode];
    enqueueMutation.mutate({
      epochs: selected.epochs,
      batchSize: selected.batchSize,
      learningRate: selected.lr,
      targetVersion: targetVersion.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#e2e8f0] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#006877]/10 text-[#006877] flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0f172a]">
                Mulai Pelatihan Model OCR
              </h3>
              <p className="text-xs text-[#64748b]">
                Pekerjaan dijalankan secara asinkron di antrean BullMQ
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

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Dataset Availability Notice */}
          <div className="p-3.5 rounded-xl bg-[#006877]/5 border border-[#006877]/20 flex items-center justify-between text-xs">
            <span className="text-[#334155] font-semibold">Data latih yang disetujui:</span>
            <span className="font-mono font-bold text-[#006877] bg-white border border-[#cbd5e1] px-2.5 py-0.5 rounded-full">
              {totalApprovedSamples} sampel tersedia
            </span>
          </div>

          {/* Mode Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-[#0f172a] uppercase tracking-wider block">
              Pilih Profil Pelatihan
            </label>

            {(Object.keys(presets) as Array<keyof typeof presets>).map((key) => {
              const p = presets[key];
              const isSelected = mode === key;
              return (
                <div
                  key={key}
                  onClick={() => setMode(key)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "border-[#00a2b9] bg-[#00a2b9]/5 ring-2 ring-[#00a2b9]"
                      : "border-[#e2e8f0] hover:border-[#cbd5e1] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[#0f172a] flex items-center gap-1.5">
                      {p.label}
                    </span>
                    <span className="font-mono font-bold text-[#006877] bg-white border border-[#cbd5e1] px-2 py-0.5 rounded text-[11px]">
                      {p.epochs} Epochs
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748b] leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Custom Target Version (Optional) */}
          <div>
            <label className="block text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
              Nama / Tag Versi Target (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: v1.5.0-curated (Otomatis jika dikosongkan)"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 min-h-[44px] rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#0f172a] placeholder-[#94a3b8] transition-all focus-utility-ring"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={enqueueMutation.isPending}
            className="min-h-[44px] px-4 py-2 text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-xl transition-all cursor-pointer focus-utility-ring"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={enqueueMutation.isPending || totalApprovedSamples === 0}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00a2b9] hover:bg-[#008c9f] text-white font-bold text-xs transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-utility-ring"
          >
            {enqueueMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mendaftarkan ke Antrean...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-white" />
                <span>Jalankan Pelatihan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

