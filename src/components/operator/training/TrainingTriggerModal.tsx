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
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Mulai Pelatihan Model OCR
              </h3>
              <p className="text-xs text-slate-500">
                Pekerjaan dijalankan secara asinkron di antrean BullMQ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Dataset Availability Notice */}
        <div className="mt-4 p-3 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-between text-xs">
          <span className="text-slate-700">Data latih yang disetujui:</span>
          <span className="font-bold text-sky-700 bg-sky-100/70 px-2.5 py-0.5 rounded-full">
            {totalApprovedSamples} sampel tersedia
          </span>
        </div>

        {/* Mode Selector */}
        <div className="mt-5 space-y-3">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
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
                    ? "border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    {p.label}
                  </span>
                  <span className="font-semibold text-sky-600 bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                    {p.epochs} Epochs
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Custom Target Version (Optional) */}
        <div className="mt-5">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Nama / Tag Versi Target (Opsional)
          </label>
          <input
            type="text"
            placeholder="Contoh: v1.5.0-curated (Otomatis jika dikosongkan)"
            value={targetVersion}
            onChange={(e) => setTargetVersion(e.target.value)}
            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={enqueueMutation.isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={enqueueMutation.isPending || totalApprovedSamples === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-sky-500"
          >
            {enqueueMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mendaftarkan ke Antrean...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Jalankan Pelatihan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

