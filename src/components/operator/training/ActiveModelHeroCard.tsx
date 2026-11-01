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
  TrendingUp,
  BarChart3,
  CheckSquare,
} from "lucide-react";

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
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 sm:p-7 border border-[#e2e8f0] shadow-xs relative flex flex-col justify-between">
        <div>
          {/* Header row with Brand Badges and Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#006877]/10 border border-[#006877]/20 flex items-center justify-center text-[#006877]">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#006877] font-bold">
                    Status Engine Produksi
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#006877]/10 text-[#006877] text-[10px] font-bold">
                    <Zap className="w-3 h-3 text-[#006877]" />
                    <span>PLN S2JB</span>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#0f172a] flex items-center gap-2 mt-0.5">
                  {isCustomModelActive ? activeModel.name : "Tesseract OCR Baseline (Standar)"}
                </h3>
              </div>
            </div>

            {isCustomModelActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
                <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                Aktif di Produksi ({activeModel.version})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                Baseline Engine (Belum Ada Model Custom)
              </span>
            )}
          </div>

          <p className="text-xs text-[#475569] leading-relaxed max-w-2xl mb-6">
            {isCustomModelActive
              ? activeModel.description || "Model deep learning CRNN PyTorch terkalibrasi hasil continuous active learning operator."
              : "Sistem saat ini menggunakan konfigurasi Tesseract OCR baseline. Jalankan training atau aktifkan model dari katalog model di bawah untuk meningkatkan akurasi pengenalan teks."}
          </p>

          {/* Key Metrics Grid (Compliant with docs/ui_ux_guidelines.md Section 2.B) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {/* Metric 1: Accuracy */}
            <div className="bg-[#f8fafc] rounded-xl p-3.5 border border-[#e2e8f0] hover:border-[#cbd5e1] transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[11px] text-[#64748b] font-bold uppercase tracking-wider">Akurasi</span>
                <div className="w-6 h-6 rounded-md bg-white border border-[#e2e8f0] flex items-center justify-center text-[#15803d]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-mono text-2xl font-bold text-[#15803d]">{accuracy}</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Golden Test Set</div>
            </div>

            {/* Metric 2: CER */}
            <div className="bg-[#f8fafc] rounded-xl p-3.5 border border-[#e2e8f0] hover:border-[#cbd5e1] transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[11px] text-[#64748b] font-bold uppercase tracking-wider">CER Rate</span>
                <div className="w-6 h-6 rounded-md bg-white border border-[#e2e8f0] flex items-center justify-center text-[#006877]">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-mono text-2xl font-bold text-[#006877]">{cer}</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Karakter Error Rate</div>
            </div>

            {/* Metric 3: WER */}
            <div className="bg-[#f8fafc] rounded-xl p-3.5 border border-[#e2e8f0] hover:border-[#cbd5e1] transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[11px] text-[#64748b] font-bold uppercase tracking-wider">WER Rate</span>
                <div className="w-6 h-6 rounded-md bg-white border border-[#e2e8f0] flex items-center justify-center text-[#b45309]">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-mono text-2xl font-bold text-[#b45309]">{wer}</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">Word Error Rate</div>
            </div>

            {/* Metric 4: Total Training Samples */}
            <div className="bg-[#f8fafc] rounded-xl p-3.5 border border-[#e2e8f0] hover:border-[#cbd5e1] transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[11px] text-[#64748b] font-bold uppercase tracking-wider">Sampel Latih</span>
                <div className="w-6 h-6 rounded-md bg-white border border-[#e2e8f0] flex items-center justify-center text-[#0f172a]">
                  <CheckSquare className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-mono text-2xl font-bold text-[#0f172a]">
                {(activeModel?.trainingSamplesCount ?? 0).toLocaleString("id-ID")}
              </div>
              <div className="text-[10px] text-[#64748b] mt-0.5 font-mono">{device}</div>
            </div>
          </div>
        </div>

        {/* Footer info & quick rollback action */}
        <div className="pt-4 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748b]">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#006877]" />
              <span>Arsitektur:</span> <strong className="text-[#0f172a] font-mono">{activeModel?.architecture || "CRNN PyTorch + CTC"}</strong>
            </span>
            {activeModel?.activatedAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#64748b]" />
                <span>Diaktifkan:</span> <span className="text-[#334155] font-medium">{new Date(activeModel.activatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </span>
            )}
          </div>

          {canRollback && onOpenRollbackModal && (
            <button
              type="button"
              onClick={onOpenRollbackModal}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#fff7ed] text-[#b45309] border border-[#fed7aa] text-xs font-bold transition-all cursor-pointer focus-utility-ring shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rollback ke Versi Sebelumnya</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Dual-Trigger & Continuous Learning Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#e2e8f0] shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#006877]/10 text-[#006877] border border-[#006877]/20 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0f172a]">Pemicu Otomatis</h4>
                <p className="text-xs text-[#64748b]">Continuous Active Learning</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] uppercase tracking-wider">
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
                  <span className="text-[#b45309] font-medium font-mono">
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
                <span className="text-[#334155] font-mono">02:00 WIB</span> <span className="text-[#64748b]">(minimal 25 sampel baru)</span>
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
