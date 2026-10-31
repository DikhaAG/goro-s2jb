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
      <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 rounded-2xl p-6 text-white border border-slate-700/60 shadow-xl relative overflow-hidden flex flex-col justify-between">
        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div>
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-sky-300/80 font-semibold">
                  Status Engine Produksi
                </span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {isCustomModelActive ? activeModel.name : "Tesseract OCR Baseline (Standar)"}
                </h3>
              </div>
            </div>

            {isCustomModelActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Aktif di Produksi ({activeModel.version})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Baseline Engine (Belum Ada Model Custom)
              </span>
            )}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl mb-6">
            {isCustomModelActive
              ? activeModel.description || "Model deep learning CRNN hasil continuous active learning operator."
              : "Sistem saat ini menggunakan konfigurasi Tesseract OCR baseline. Jalankan training atau aktifkan model dari katalog model di bawah untuk meningkatkan akurasi pengenalan teks."}
          </p>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
              <div className="text-[11px] text-slate-400 font-medium">Akurasi Benchmark</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{accuracy}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Golden Test Set</div>
            </div>

            <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
              <div className="text-[11px] text-slate-400 font-medium">Character Error (CER)</div>
              <div className="text-xl font-bold text-sky-300 mt-1">{cer}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Semakin rendah semakin baik</div>
            </div>

            <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
              <div className="text-[11px] text-slate-400 font-medium">Word Error (WER)</div>
              <div className="text-xl font-bold text-amber-300 mt-1">{wer}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tingkat kesalahan kata</div>
            </div>

            <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
              <div className="text-[11px] text-slate-400 font-medium">Total Sampel Latih</div>
              <div className="text-xl font-bold text-white mt-1">
                {activeModel?.trainingSamplesCount ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{device}</div>
            </div>
          </div>
        </div>

        {/* Footer info & quick rollback action */}
        <div className="pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Arsitektur: <strong className="text-slate-200">{activeModel?.architecture || "Tesseract + Hybrid"}</strong>
            </span>
            {activeModel?.activatedAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Diaktifkan: <span className="text-slate-200">{new Date(activeModel.activatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </span>
            )}
          </div>

          {canRollback && onOpenRollbackModal && (
            <button
              type="button"
              onClick={onOpenRollbackModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-colors focus:ring-2 focus:ring-amber-400"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rollback ke Versi Sebelumnya
            </button>
          )}
        </div>
      </div>

      {/* 2. Dual-Trigger & Continuous Learning Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Pemicu Otomatis</h4>
                <p className="text-xs text-slate-500">Continuous Active Learning</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              Dual-Trigger
            </span>
          </div>

          {/* Threshold Progress */}
          <div className="mb-5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700">Akumulasi Data Baru</span>
              <span className="font-bold text-sky-600">
                {newSamples} / {threshold} sampel
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-sky-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${sampleProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Pekerjaan pelatihan otomatis terpicu begitu mencapai {threshold} sampel ulasan baru yang disetujui.
            </p>
          </div>

          {/* Cooldown Status */}
          <div className="mb-6 space-y-2.5">
            <div className="flex items-start gap-2 text-xs">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">Jeda Waktu (Cooldown): </span>
                {isCooldown ? (
                  <span className="text-amber-700 font-medium">
                    Aktif (tersisa {cooldownHours}j {cooldownMins}m)
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">
                    Siap (Proteksi jeda tidak aktif)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs">
              <Activity className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">Jadwal Nightly Cron: </span>
                <span className="text-slate-600">Pukul 02:00 WIB (minimal 25 sampel baru)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Trigger Button */}
        <button
          type="button"
          onClick={onOpenTriggerModal}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-xs transition-colors shadow-sm focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
        >
          <Cpu className="w-4 h-4" />
          Mulai Pelatihan Model (Manual)
        </button>
      </div>
    </div>
  );
}

