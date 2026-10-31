"use client";

import React, { useState } from "react";
import { X, Trash2, AlertOctagon, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PurgeAllReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  totalCount?: number;
  onConfirmPurge: (data: {
    mode: "SOFT_REJECT" | "PERMANENT";
    reason: string;
    confirmText: string;
  }) => void;
  isPurging?: boolean;
}

const PRESET_PURGE_REASONS = [
  "Reset total data ulasan pengujian sandbox",
  "Pembersihan menyeluruh migrasi data awal",
  "Penolakan kuratif massal seluruh ulasan belum tervalidasi",
  "Penyelarasan ulang sistem dari awal periode pengujian",
];

export function PurgeAllReviewsModal({
  isOpen,
  onClose,
  userRole = "PEGAWAI",
  totalCount = 0,
  onConfirmPurge,
  isPurging = false,
}: PurgeAllReviewsModalProps) {
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const [mode, setMode] = useState<"SOFT_REJECT" | "PERMANENT">(
    isSuperAdmin ? "PERMANENT" : "SOFT_REJECT"
  );
  const [reason, setReason] = useState(PRESET_PURGE_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = customReason.trim().length > 0 ? customReason.trim() : reason;

    if (!finalReason || finalReason.length < 3) {
      setError("Alasan tindakan wajib diisi minimal 3 karakter.");
      return;
    }

    if (confirmText.trim() !== "HAPUS SEMUA") {
      setError('Ketik "HAPUS SEMUA" tepat huruf kapital untuk melanjutkan.');
      return;
    }

    setError(null);
    onConfirmPurge({
      mode,
      reason: finalReason,
      confirmText: confirmText.trim(),
    });
  };

  const isConfirmed = confirmText.trim() === "HAPUS SEMUA";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden z-10 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header with High-Alert Styling */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-100 bg-[#fef2f2]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#991b1b]">
                Hapus / Reset Seluruh Data Ulasan
              </h3>
              <p className="text-xs text-[#b91c1c] font-medium">
                Tindakan berisiko tinggi terhadap basis data sistem
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-red-200 bg-white hover:bg-[#fef2f2] text-[#991b1b] flex items-center justify-center transition-colors cursor-pointer focus-utility-ring shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] font-semibold">
              {error}
            </div>
          )}

          {/* Super Admin Mode Selector */}
          {isSuperAdmin ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#0f172a]">
                Pilih Lingkup Tindakan Seluruh Data
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("PERMANENT")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer focus-utility-ring",
                    mode === "PERMANENT"
                      ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b] ring-2 ring-[#ef4444]/30 shadow-xs"
                      : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569] hover:bg-white"
                  )}
                >
                  <span className="block text-xs font-bold text-[#dc2626]">Hapus Total Permanen</span>
                  <span className="text-[10px] font-normal text-[#64748b] mt-0.5 block">
                    Kosongkan seluruh tabel PostgreSQL
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("SOFT_REJECT")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer focus-utility-ring",
                    mode === "SOFT_REJECT"
                      ? "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412] ring-2 ring-[#f97316]/30 shadow-xs"
                      : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569] hover:bg-white"
                  )}
                >
                  <span className="block text-xs font-bold text-[#ea580c]">Tolak Seluruh Data</span>
                  <span className="text-[10px] font-normal text-[#64748b] mt-0.5 block">
                    Ubah status jadi REJECTED
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#fff7ed] border border-[#fed7aa] text-xs text-[#9a3412] flex items-start gap-2.5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#f97316]" />
              <span className="leading-relaxed">
                Sebagai role <strong>Pegawai</strong>, seluruh data ulasan yang belum berstatus REJECTED akan ditandai dengan status <strong>Ditolak (REJECTED)</strong> dan dicatat ke log audit.
              </span>
            </div>
          )}

          {/* Mode Warning Notice */}
          {mode === "PERMANENT" ? (
            <div className="p-4 rounded-xl bg-[#fff1f2] border border-[#fecdd3] text-xs text-[#9f1239] space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-[#e11d48]">
                <AlertOctagon className="w-4 h-4" />
                <span>Peringatan Permanen: Operasi ini tidak dapat dibatalkan!</span>
              </div>
              <p className="leading-relaxed text-[#881337]">
                Tindakan ini akan menghapus <strong>seluruh baris data ulasan ({totalCount > 0 ? `${totalCount} data` : "semua data"})</strong> secara permanen dari basis data PostgreSQL PLN UID S2JB.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#fff7ed] border border-[#fed7aa] text-xs text-[#9a3412] space-y-1">
              <div className="font-bold text-[#c2410c]">Penolakan Menyeluruh:</div>
              <p className="leading-relaxed text-[#7c2d12]">
                Seluruh data ulasan akan ditandai berstatus REJECTED dan dinonaktifkan dari agregasi capaian realisasi rating unit.
              </p>
            </div>
          )}

          {/* Preset Reasons Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
              Alasan Tindakan Seluruh Data *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
            >
              {PRESET_PURGE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
              Alasan Kustom Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Tulis alasan spesifik jika berbeda dari opsi di atas..."
              className="w-full p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
            />
          </div>

          {/* Mandatory Confirmation Input */}
          <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
            <label className="block text-xs font-semibold text-[#0f172a]">
              Ketik <span className="font-mono font-bold text-[#dc2626]">HAPUS SEMUA</span> untuk mengonfirmasi *
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="HAPUS SEMUA"
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#cbd5e1] bg-white text-xs text-[#0f172a] font-mono focus:bg-white focus-utility-ring font-bold tracking-wider"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPurging}
              className="min-h-[44px] h-11 px-4 rounded-xl border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] text-xs font-semibold transition-colors cursor-pointer focus-utility-ring shadow-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPurging || !isConfirmed}
              className={cn(
                "min-h-[44px] h-11 px-5 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-xs cursor-pointer focus-utility-ring",
                !isConfirmed
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                  : mode === "PERMANENT"
                  ? "bg-[#dc2626] hover:bg-[#b91c1c]"
                  : "bg-[#ea580c] hover:bg-[#c2410c]"
              )}
            >
              {isPurging ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>
                {mode === "PERMANENT" ? "Hapus Permanen Seluruh Data" : "Tolak Seluruh Data"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

