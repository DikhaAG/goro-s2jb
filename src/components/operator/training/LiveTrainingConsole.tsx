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
      <div className="bg-[#0f172a] rounded-2xl p-6 sm:p-7 text-white border border-[#334155] shadow-xl mb-6 relative overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#334155]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00a2b9]/20 text-[#00A3E0] flex items-center justify-center border border-[#00a2b9]/30">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">
                  Pelatihan Model OCR Sedang Berjalan
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#00a2b9]/20 text-[#38bdf8] border border-[#00a2b9]/30 uppercase tracking-wider">
                  {activeJob.triggerType || "MANUAL"}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Target Versi: <span className="text-[#38bdf8] font-mono font-bold">{activeJob.targetVersion}</span> (Job ID: <span className="font-mono">{activeJob.jobId}</span>)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#fef2f2]/10 hover:bg-[#fef2f2]/20 text-[#fca5a5] border border-[#fecaca]/30 text-xs font-bold transition-all cursor-pointer focus-utility-ring"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Batalkan Pekerjaan</span>
          </button>
        </div>

        {/* Real-time Progress Bar & Epoch Info */}
        <div className="py-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#cbd5e1] font-semibold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#00A3E0]" />
              Progres Epoch: <strong className="text-white font-mono">{currentEpoch} dari {totalEpochs}</strong>
            </span>
            <span className="text-xs font-mono font-bold text-[#38bdf8]">{progressPercent}% Selesai</span>
          </div>

          <div className="w-full bg-[#1e293b] h-3 rounded-full overflow-hidden border border-[#334155]">
            <div
              className="bg-gradient-to-r from-[#00a2b9] to-[#10b981] h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="bg-[#1e293b]/70 p-3 rounded-xl border border-[#334155]/80">
              <span className="text-[#94a3b8] text-[11px] font-bold uppercase tracking-wider block">Current Loss (CTC)</span>
              <span className="font-mono font-bold text-[#34d399] text-base mt-0.5 block">{currentLoss}</span>
            </div>
            <div className="bg-[#1e293b]/70 p-3 rounded-xl border border-[#334155]/80">
              <span className="text-[#94a3b8] text-[11px] font-bold uppercase tracking-wider block">Dataset Latih</span>
              <span className="font-mono font-bold text-white text-base mt-0.5 block">{activeJob.datasetSize || "-"} Sampel</span>
            </div>
            <div className="bg-[#1e293b]/70 p-3 rounded-xl border border-[#334155]/80 col-span-2 sm:col-span-1">
              <span className="text-[#94a3b8] text-[11px] font-bold uppercase tracking-wider block">Status Worker</span>
              <span className="font-semibold text-[#38bdf8] text-sm flex items-center gap-1.5 mt-0.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00A3E0]" />
                Aktif (Komputasi)
              </span>
            </div>
          </div>
        </div>

        {/* Live Terminal Mini Stream */}
        {activeJob.logs && Array.isArray(activeJob.logs) && activeJob.logs.length > 0 && (
          <div className="mt-3 bg-black/60 p-3.5 rounded-xl border border-[#334155] text-[11px] font-mono text-[#cbd5e1] max-h-36 overflow-y-auto space-y-1">
            <div className="text-[#94a3b8] font-sans text-[10px] uppercase font-bold tracking-wider mb-1.5 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#00A3E0]" />
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
            className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs"
            onClick={() => setIsCancelModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2e8f0] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#fef2f2] text-[#b91c1c] flex items-center justify-center">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">
                    Konfirmasi Batalkan Pelatihan
                  </h3>
                  <p className="text-xs text-[#64748b]">Penghentian pekerjaan background worker</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-slate-100 transition-colors cursor-pointer focus-utility-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cancelError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-[#fef2f2] text-[#b91c1c] text-xs border border-[#fecaca]">
                {cancelError}
              </div>
            )}

            <div className="p-6 space-y-4 text-xs">
              <p className="text-[#334155] leading-relaxed">
                Apakah Anda yakin ingin menghentikan pekerjaan training ini? Proses komputasi Python akan dihentikan dan status pekerjaan akan dicatat sebagai <strong className="text-[#b91c1c]">CANCELLED</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                  Alasan Pembatalan (Wajib dicatat di Audit Log)
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Contoh: Kesalahan parameter epoch / beban server tinggi"
                  className="w-full text-xs p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#0f172a] placeholder-[#94a3b8] transition-all focus-utility-ring"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-xl transition-all cursor-pointer focus-utility-ring"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="min-h-[44px] px-5 py-2 text-xs font-bold text-white bg-[#b91c1c] hover:bg-rose-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring"
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

