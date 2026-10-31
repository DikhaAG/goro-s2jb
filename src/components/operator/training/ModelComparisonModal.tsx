"use client";

import React from "react";
import { trpc } from "@/lib/trpc";
import {
  X,
  Scale,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Loader2,
} from "lucide-react";

interface ModelComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelAId: string;
  modelBId: string;
}

export function ModelComparisonModal({
  isOpen,
  onClose,
  modelAId,
  modelBId,
}: ModelComparisonModalProps) {
  const { data: comp, isLoading } = trpc.ocrTraining.compareModels.useQuery(
    { modelAId, modelBId },
    { enabled: isOpen && !!modelAId && !!modelBId }
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Komparasi Metrik Model OCR
              </h3>
              <p className="text-xs text-slate-500">
                Perbandingan objektif terhadap Golden Benchmark Set
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

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600 mb-2" />
            Memuat perbandingan model...
          </div>
        ) : !comp ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Data model tidak dapat ditemukan untuk dikomparasi.
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Verdict Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
                comp.verdict === "MODEL_B_BETTER"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : comp.verdict === "MODEL_A_BETTER"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <strong className="font-bold block text-sm">
                  {comp.verdict === "MODEL_B_BETTER"
                    ? `Model Kandidat (${comp.modelB.version}) Lebih Unggul`
                    : comp.verdict === "MODEL_A_BETTER"
                    ? `Model Acuan (${comp.modelA.version}) Lebih Unggul`
                    : "Kedua Model Memiliki Performa Serupa"}
                </strong>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {comp.verdict === "MODEL_B_BETTER"
                    ? `Model kandidat menunjukkan kenaikan akurasi sebesar +${comp.delta.accuracy.toFixed(1)}% dan penurunan CER ${comp.delta.cer.toFixed(2)}%. Sangat disarankan untuk dipromosikan ke produksi.`
                    : comp.verdict === "MODEL_A_BETTER"
                    ? "Model kandidat belum mengungguli model acuan saat ini. Evaluasi data latih atau tambah sampel kurasi sebelum aktivasi."
                    : "Perbedaan metrik berada di bawah ambang deviasi signifikan (< 0.5%)."}
                </p>
              </div>
            </div>

            {/* Side by side comparison cards */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              {/* Model A */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Model Acuan (A)
                </span>
                <h4 className="font-bold text-slate-900 text-sm mb-3">
                  {comp.modelA.name} ({comp.modelA.version})
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-semibold text-slate-800">{comp.modelA.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Akurasi:</span>
                    <span className="font-bold text-emerald-600">
                      {comp.modelA.accuracyScore ? `${comp.modelA.accuracyScore.toFixed(1)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CER:</span>
                    <span className="font-mono text-slate-800">
                      {comp.modelA.cerScore ? `${comp.modelA.cerScore.toFixed(2)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">WER:</span>
                    <span className="font-mono text-slate-800">
                      {comp.modelA.werScore ? `${comp.modelA.werScore.toFixed(2)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sampel Latih:</span>
                    <span className="font-medium text-slate-800">{comp.modelA.trainingSamplesCount}</span>
                  </div>
                </div>
              </div>

              {/* Model B */}
              <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200">
                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block mb-1">
                  Model Kandidat (B)
                </span>
                <h4 className="font-bold text-slate-900 text-sm mb-3">
                  {comp.modelB.name} ({comp.modelB.version})
                </h4>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-semibold text-slate-800">{comp.modelB.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Akurasi:</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      {comp.modelB.accuracyScore ? `${comp.modelB.accuracyScore.toFixed(1)}%` : "N/A"}
                      {comp.delta.accuracy > 0 ? (
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100 px-1 rounded">
                          +{comp.delta.accuracy}%
                        </span>
                      ) : comp.delta.accuracy < 0 ? (
                        <span className="text-[10px] text-rose-600 font-semibold bg-rose-100 px-1 rounded">
                          {comp.delta.accuracy}%
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CER:</span>
                    <span className="font-mono text-slate-800 flex items-center gap-1">
                      {comp.modelB.cerScore ? `${comp.modelB.cerScore.toFixed(2)}%` : "N/A"}
                      {comp.delta.cer < 0 ? (
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100 px-1 rounded">
                          {comp.delta.cer}%
                        </span>
                      ) : comp.delta.cer > 0 ? (
                        <span className="text-[10px] text-rose-600 font-semibold bg-rose-100 px-1 rounded">
                          +{comp.delta.cer}%
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">WER:</span>
                    <span className="font-mono text-slate-800">
                      {comp.modelB.werScore ? `${comp.modelB.werScore.toFixed(2)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sampel Latih:</span>
                    <span className="font-medium text-slate-800">
                      {comp.modelB.trainingSamplesCount} ({comp.delta.samples >= 0 ? `+${comp.delta.samples}` : comp.delta.samples})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Tutup Komparasi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

