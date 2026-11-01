"use client";

import React from "react";
import {
  BrainCircuit,
  Zap,
  CheckCircle2,
  Clock,
  RotateCcw,
  Activity,
  Layers,
  Cpu,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ActiveModelHeroCardProps {
  activeModel: any | null;
  triggerStatus?: any | null;
  onOpenTriggerModal: () => void;
  onOpenRollbackModal?: () => void;
  canRollback?: boolean;
}

export function ActiveModelHeroCard({
  activeModel,
  triggerStatus,
  onOpenTriggerModal,
  onOpenRollbackModal,
  canRollback = false,
}: ActiveModelHeroCardProps) {
  const isCustomModelActive = !!activeModel;
  const newSamples = triggerStatus?.newSamplesCount ?? 0;
  const threshold = triggerStatus?.threshold ?? 100;
  const sampleProgress = Math.min(Math.round((newSamples / Math.max(threshold, 1)) * 100), 100);

  const isCooldown = triggerStatus?.isCooldownActive ?? false;
  const cooldownSecs = triggerStatus?.cooldownRemainingSeconds ?? 0;
  const cooldownHours = Math.floor(cooldownSecs / 3600);
  const cooldownMins = Math.floor((cooldownSecs % 3600) / 60);

  const accuracy = activeModel?.accuracyScore !== null && activeModel?.accuracyScore !== undefined
    ? `${activeModel.accuracyScore.toFixed(1)}%`
    : "N/A";
  const cer = activeModel?.cerScore !== null && activeModel?.cerScore !== undefined
    ? `${activeModel.cerScore.toFixed(2)}%`
    : "N/A";
  const wer = activeModel?.werScore !== null && activeModel?.werScore !== undefined
    ? `${activeModel.werScore.toFixed(2)}%`
    : "N/A";

  const device = (activeModel?.metadata as Record<string, any>)?.device || "CPU / Auto";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Hero Card: Active Production Model (Takes 2 columns on desktop) */}
      <div className="lg:col-span-2 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#003840] rounded-2xl p-6 sm:p-7 text-white border border-[#334155] shadow-xl relative overflow-hidden flex flex-col justify-between">
        {/* Subtle decorative background accent */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#00a2b9]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#10b981]/10 rounded-full blur-3xl pointer-events-none" />

        <div>
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00a2b9]/20 border border-[#00a2b9]/30 flex items-center justify-center text-[#00A3E0]">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#00A3E0] font-bold">
                  Status Engine Produksi
                </span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {isCustomModelActive ? activeModel.name : "Tesseract OCR Baseline (Standar)"}
                </h3>
              </div>
            </div>

            {isCustomModelActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/30">
                <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
                Aktif di Produksi ({activeModel.version})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b]/30">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                Baseline Engine (Belum Ada Model Custom)
              </span>
            )}
          </div>

          <p className="text-xs text-[#cbd5e1] leading-relaxed max-w-2xl mb-6">
            {isCustomModelActive
              ? activeModel.description || "Model deep learning CRNN hasil continuous active learning operator."
              : "Sistem saat ini menggunakan konfigurasi Tesseract OCR baseline. Jalankan training atau aktifkan model dari katalog model di bawah untuk meningkatkan akurasi pengenalan teks."}
          </p>

          {/* Key Metrics Grid (Monospace figures per guidelines) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#0f172a]/70 rounded-xl p-3.5 border border-[#334155]/80">
              <div className="text-[11px] text-[#94a3b8] font-bold uppercase tracking-wider">Akurasi Benchmark</div>
              <div className="font-mono text-2xl font-bold text-[#34d399] mt-1">{accuracy}</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Golden Test Set</div>
            </div>

            <div className="bg-[#0f172a]/70 rounded-xl p-3.5 border border-[#334155]/80">
              <div className="text-[11px] text-[#94a3b8] font-bold uppercase tracking-wider">Character Error (CER)</div>
              <div className="font-mono text-2xl font-bold text-[#38bdf8] mt-1">{cer}</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Semakin rendah semakin baik</div>
            </div>

            <div className="bg-[#0f172a]/70 rounded-xl p-3.5 border border-[#334155]/80">
              <div className="text-[11px] text-[#94a3b8] font-bold uppercase tracking-wider">Word Error (WER)</div>
              <div className="font-mono text-2xl font-bold text-[#fbbf24] mt-1">{wer}</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Tingkat kesalahan kata</div>
            </div>

            <div className="bg-[#0f172a]/70 rounded-xl p-3.5 border border-[#334155]/80">
              <div className="text-[11px] text-[#94a3b8] font-bold uppercase tracking-wider">Total Sampel Latih</div>
              <div className="font-mono text-2xl font-bold text-white mt-1">
                {activeModel?.trainingSamplesCount ?? 0}
              </div>
              <div className="text-[10px] text-[#64748b] mt-0.5">{device}</div>
            </div>
          </div>
        </div>

        {/* Footer info & quick rollback action */}
        <div className="pt-4 border-t border-[#334155] flex flex-wrap items-center justify-between gap-3 text-xs text-[#94a3b8]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00A3E0]" />
              Arsitektur: <strong className="text-white font-mono">{activeModel?.architecture || "Tesseract + Hybrid"}</strong>
            </span>
            {activeModel?.activatedAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#94a3b8]" />
                Diaktifkan: <span className="text-white">{new Date(activeModel.activatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </span>
            )}
          </div>

          {canRollback && onOpenRollbackModal && (
            <button
              type="button"
              onClick={onOpenRollbackModal}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 text-[#fef3c7] border border-[#f59e0b]/40 text-xs font-bold transition-colors cursor-pointer focus-utility-ring"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rollback ke Versi Sebelumnya
            </button>
          )}
        </div>
      </div>

      {/* 2. Dual-Trigger & Continuous Learning Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#e2e8f0] shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#006877]/10 text-[#006877] flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0f172a]">Pemicu Otomatis</h4>
                <p className="text-xs text-[#64748b]">Continuous Active Learning</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-[#475569] uppercase tracking-wider">
              Dual-Trigger
            </span>
          </div>

          {/* Threshold Progress */}
          <div className="mb-5 bg-[#f8fafc] p-4 rounded-xl border border-[#e2e8f0]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[#334155]">Akumulasi Data Baru</span>
              <span className="font-mono font-bold text-[#006877]">
                {newSamples} / {threshold} sampel
              </span>
            </div>
            <div className="w-full bg-[#e2e8f0] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#00a2b9] h-full rounded-full transition-all duration-300"
                style={{ width: `${sampleProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-[#64748b] mt-2">
              Pekerjaan pelatihan otomatis terpicu begitu mencapai {threshold} sampel ulasan baru yang disetujui.
            </p>
          </div>

          {/* Cooldown Status */}
          <div className="mb-6 space-y-2.5">
            <div className="flex items-start gap-2 text-xs">
              <Clock className="w-4 h-4 text-[#64748b] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#0f172a]">Jeda Waktu (Cooldown): </span>
                {isCooldown ? (
                  <span className="text-[#b45309] font-medium">
                    Aktif (tersisa {cooldownHours}j {cooldownMins}m)
                  </span>
                ) : (
                  <span className="text-[#15803d] font-semibold">
                    Siap (Proteksi jeda tidak aktif)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs">
              <Activity className="w-4 h-4 text-[#64748b] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#0f172a]">Jadwal Nightly Cron: </span>
                <span className="text-[#334155]">Pukul 02:00 WIB (minimal 25 sampel baru)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Trigger Button */}
        <button
          type="button"
          onClick={onOpenTriggerModal}
          className="min-h-[44px] h-11 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#00a2b9] hover:bg-[#008c9f] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer focus-utility-ring"
        >
          <Cpu className="w-4 h-4" />
          <span>Mulai Pelatihan Model (Manual)</span>
        </button>
      </div>
    </div>
  );
}

