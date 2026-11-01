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
        className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#e2e8f0] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#006877]/10 text-[#006877] flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0f172a]">
                Komparasi Metrik Model OCR
              </h3>
              <p className="text-xs text-[#64748b]">
                Perbandingan objektif terhadap Golden Benchmark Set
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

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-[#64748b] text-xs">
            <Loader2 className="w-8 h-8 animate-spin text-[#00a2b9] mb-2" />
            Memuat perbandingan model...
          </div>
        ) : !comp ? (
          <div className="py-8 text-center text-xs text-[#64748b]">
            Data model tidak dapat ditemukan untuk dikomparasi.
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Verdict Banner */}
            <div
              className={`p-4 rounded-xl border flex items-center gap-3.5 text-xs ${
                comp.verdict === "MODEL_B_BETTER"
                  ? "bg-[#ecfdf5] border-[#a7f3d0] text-[#15803d]"
                  : comp.verdict === "MODEL_A_BETTER"
                  ? "bg-[#fff7ed] border-[#fed7aa] text-[#b45309]"
                  : "bg-[#f8fafc] border-[#e2e8f0] text-[#334155]"
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
                <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
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
              <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-1">
                  Model Acuan (A)
                </span>
                <h4 className="font-bold text-[#0f172a] text-sm mb-3 font-mono">
                  {comp.modelA.name} ({comp.modelA.version})
                </h4>

                <div className="space-y-2 text-[#334155]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">Status:</span>
                    <span className="font-semibold text-[#0f172a]">{comp.modelA.status}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">Akurasi:</span>
                    <span className="font-mono font-bold text-[#15803d]">
                      {comp.modelA.accuracyScore ? `${comp.modelA.accuracyScore.toFixed(1)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">CER:</span>
                    <span className="font-mono text-[#0369a1] font-bold">
                      {comp.modelA.cerScore ? `${comp.modelA.cerScore.toFixed(2)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">WER:</span>
                    <span className="font-mono text-[#b45309] font-bold">
                      {comp.modelA.werScore ? `${comp.modelA.werScore.toFixed(2)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">Sampel Latih:</span>
                    <span className="font-mono font-bold text-[#0f172a]">{comp.modelA.trainingSamplesCount}</span>
                  </div>
                </div>
              </div>

              {/* Model B */}
              <div className="p-4 rounded-xl bg-[#00a2b9]/5 border border-[#00a2b9]/30">
                <span className="text-[10px] font-bold text-[#006877] uppercase tracking-wider block mb-1">
                  Model Kandidat (B)
                </span>
                <h4 className="font-bold text-[#0f172a] text-sm mb-3 font-mono">
                  {comp.modelB.name} ({comp.modelB.version})
                </h4>

                <div className="space-y-2 text-[#334155]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">Status:</span>
                    <span className="font-semibold text-[#0f172a]">{comp.modelB.status}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">Akurasi:</span>
                    <span className="font-mono font-bold text-[#15803d] flex items-center gap-1">
                      {comp.modelB.accuracyScore ? `${comp.modelB.accuracyScore.toFixed(1)}%` : "N/A"}
                      {comp.delta.accuracy > 0 ? (
                        <span className="text-[10px] text-[#15803d] font-bold bg-[#ecfdf5] border border-[#a7f3d0] px-1.5 py-0.5 rounded">
                          +{comp.delta.accuracy}%
                        </span>
                      ) : comp.delta.accuracy < 0 ? (
                        <span className="text-[10px] text-[#b91c1c] font-bold bg-[#fef2f2] border border-[#fecaca] px-1.5 py-0.5 rounded">
                          {comp.delta.accuracy}%
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">CER:</span>
                    <span className="font-mono text-[#0369a1] font-bold flex items-center gap-1">
                      {comp.modelB.cerScore ? `${comp.modelB.cerScore.toFixed(2)}%` : "N/A"}
                      {comp.delta.cer < 0 ? (
                        <span className="text-[10px] text-[#15803d] font-bold bg-[#ecfdf5] border border-[#a7f3d0] px-1.5 py-0.5 rounded">
                          {comp.delta.cer}%
                        </span>
                      ) : comp.delta.cer > 0 ? (
                        <span className="text-[10px] text-[#b91c1c] font-bold bg-[#fef2f2] border border-[#fecaca] px-1.5 py-0.5 rounded">
                          +{comp.delta.cer}%
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">WER:</span>
                    <span className="font-mono text-[#b45309] font-bold">
                      {comp.modelB.werScore ? `${comp.modelB.werScore.toFixed(2)}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748b]">Sampel Latih:</span>
                    <span className="font-mono font-bold text-[#0f172a]">
                      {comp.modelB.trainingSamplesCount} ({comp.delta.samples >= 0 ? `+${comp.delta.samples}` : comp.delta.samples})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#e2e8f0] flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2 text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-xl transition-all cursor-pointer focus-utility-ring"
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

