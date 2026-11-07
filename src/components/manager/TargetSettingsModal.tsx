"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Sliders,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  X,
  Loader2,
  TrendingUp,
} from "lucide-react";

interface TargetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function TargetSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: TargetSettingsModalProps) {
  const utils = trpc.useUtils();
  const targetSettingsQuery = trpc.report.getTargetSettings.useQuery(undefined, {
    enabled: isOpen,
  });

  const [weekdayTarget, setWeekdayTarget] = useState<number>(50);
  const [weekendTarget, setWeekendTarget] = useState<number>(20);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (targetSettingsQuery.data) {
      setWeekdayTarget(targetSettingsQuery.data.weekdayTarget);
      setWeekendTarget(targetSettingsQuery.data.weekendTarget);
    }
  }, [targetSettingsQuery.data]);

  const updateMutation = trpc.report.updateTargetSettings.useMutation({
    onSuccess: () => {
      setIsSuccess(true);
      setErrorMessage(null);
      utils.report.getDaily.invalidate();
      utils.report.getMonthly.invalidate();
      utils.report.getKpis.invalidate();
      utils.report.getPacing.invalidate();
      utils.report.getTargetSettings.invalidate();
      onSaved?.();
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1200);
    },
    onError: (err) => {
      setErrorMessage(err.message || "Gagal memperbarui pengaturan target.");
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (weekdayTarget < 0 || weekendTarget < 0) {
      setErrorMessage("Nilai target tidak boleh negatif.");
      return;
    }
    updateMutation.mutate({
      weekdayTarget: Number(weekdayTarget),
      weekendTarget: Number(weekendTarget),
    });
  };

  const handleResetDefault = () => {
    setWeekdayTarget(50);
    setWeekendTarget(20);
    setErrorMessage(null);
  };

  // 22 weekdays + 8 weekends estimate in typical 30-day month
  const monthlyEstimatePerUlp = 22 * weekdayTarget + 8 * weekendTarget;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pengaturan Target Harian Eksekutif
              </h3>
              <p className="text-xs text-slate-500">
                PLN Unit Induk Distribusi S2JB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-xs text-slate-600 leading-relaxed">
            Atur target kuota harian untuk setiap ULP. Ketentuan baseline awal
            sistem adalah <strong>50 target</strong> untuk hari kerja (Senin s/d
            Jumat) dan <strong>20 target</strong> untuk akhir pekan (Sabtu dan
            Minggu).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Weekday Input */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Calendar className="w-4 h-4 text-teal-600" />
                <span>Hari Kerja (Sen - Jum)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={weekdayTarget}
                  onChange={(e) => setWeekdayTarget(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full h-10 px-3 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus-utility-ring"
                  required
                />
                <span className="text-xs text-slate-500 font-medium shrink-0">
                  / hari
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block">
                Default: 50 target
              </span>
            </div>

            {/* Weekend Input */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Akhir Pekan (Sab - Min)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={weekendTarget}
                  onChange={(e) => setWeekendTarget(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full h-10 px-3 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus-utility-ring"
                  required
                />
                <span className="text-xs text-slate-500 font-medium shrink-0">
                  / hari
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block">
                Default: 20 target
              </span>
            </div>
          </div>

          {/* Simulation Box */}
          <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-teal-900 font-medium">
              <TrendingUp className="w-4 h-4 text-teal-700" />
              <span>Estimasi Target Bulanan per ULP:</span>
            </div>
            <span className="font-mono font-bold text-teal-800 text-sm">
              {monthlyEstimatePerUlp.toLocaleString("id-ID")} target
            </span>
          </div>

          {/* Success Banner */}
          {isSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Target berhasil diperbarui dan diterapkan ke seluruh metrik!</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefault}
              className="text-xs text-slate-500 hover:text-slate-800 gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default (50/20)</span>
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs h-9 min-h-[36px] flex-1 sm:flex-none cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateMutation.isPending || isSuccess}
                className="text-xs h-9 min-h-[36px] bg-teal-700 hover:bg-teal-800 text-white font-semibold flex-1 sm:flex-none cursor-pointer"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Pengaturan</span>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
