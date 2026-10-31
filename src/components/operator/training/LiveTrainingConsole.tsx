"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Terminal,
  Activity,
  AlertOctagon,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";

interface LiveTrainingConsoleProps {
  onJobFinished: () => void;
}

export function LiveTrainingConsole({ onJobFinished }: LiveTrainingConsoleProps) {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Poll active training status every 2.5 seconds
  const { data: activeJob, refetch } = trpc.ocrTraining.getActiveJobStatus.useQuery(undefined, {
    refetchInterval: 2500,
  });

  const cancelMutation = trpc.ocrTraining.cancelJob.useMutation({
    onSuccess: () => {
      setIsCancelModalOpen(false);
      setCancelReason("");
      refetch();
      onJobFinished();
    },
    onError: (err) => {
      setCancelError(err.message || "Gagal membatalkan pekerjaan training.");
    },
  });

  if (!activeJob) return null;

  const currentEpoch = activeJob.currentEpoch ?? 0;
  const totalEpochs = activeJob.totalEpochs ?? 1;
  const progressPercent = activeJob.progressPercent ?? Math.round((currentEpoch / totalEpochs) * 100);
  const currentLoss = activeJob.currentLoss !== null && activeJob.currentLoss !== undefined
    ? Number(activeJob.currentLoss).toFixed(4)
    : "Menghitung...";

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      setCancelError("Mohon masukkan alasan pembatalan pekerjaan.");
      return;
    }
    cancelMutation.mutate({
      jobId: activeJob.jobId,
      reason: cancelReason.trim(),
    });
  };

  return (
    <>
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl mb-6 relative overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-400/30">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">
                  Pelatihan Model OCR Sedang Berjalan
                </h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {activeJob.triggerType || "MANUAL"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Target Versi: <span className="text-sky-300 font-semibold">{activeJob.targetVersion}</span> (Job ID: {activeJob.jobId})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors focus:ring-2 focus:ring-rose-400"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            Batalkan Pekerjaan
          </button>
        </div>

        {/* Real-time Progress Bar & Epoch Info */}
        <div className="py-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              Progres Epoch: <strong className="text-white">{currentEpoch} dari {totalEpochs}</strong>
            </span>
            <span className="text-xs font-bold text-sky-400">{progressPercent}% Selesai</span>
          </div>

          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/60">
            <div
              className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/40">
              <span className="text-slate-400 text-[11px] block">Current Loss (CTC)</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{currentLoss}</span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/40">
              <span className="text-slate-400 text-[11px] block">Dataset Latih</span>
              <span className="font-bold text-white text-sm">{activeJob.datasetSize || "-"} Sampel</span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/40 col-span-2 sm:col-span-1">
              <span className="text-slate-400 text-[11px] block">Status Worker</span>
              <span className="font-semibold text-sky-300 text-sm flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                Aktif (Komputasi)
              </span>
            </div>
          </div>
        </div>

        {/* Live Terminal Mini Stream */}
        {activeJob.logs && Array.isArray(activeJob.logs) && activeJob.logs.length > 0 && (
          <div className="mt-3 bg-black/50 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-32 overflow-y-auto space-y-1">
            <div className="text-slate-500 font-sans text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
              <Terminal className="w-3 h-3 text-slate-400" />
              Terminal Output Stream:
            </div>
            {activeJob.logs.slice(-6).map((log: string, idx: number) => (
              <div key={idx} className="truncate">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsCancelModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 text-rose-600">
                <AlertOctagon className="w-4 h-4" />
                Konfirmasi Batalkan Pelatihan
              </h3>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cancelError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {cancelError}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghentikan pekerjaan training ini? Proses komputasi Python akan dihentikan dan status pekerjaan akan dicatat sebagai FAILED.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Pembatalan (Wajib dicatat di Audit Log)
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Kesalahan parameter epoch / beban server tinggi"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-slate-900"
              />
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {cancelMutation.isPending ? "Membatalkan..." : "Ya, Hentikan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

