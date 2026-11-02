"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Trash2,
  AlertOctagon,
  RefreshCw,
  XCircle,
  Database,
  Lock,
  Unlock,
} from "lucide-react";
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
  "Purge permanen seluruh data ulasan duplikasi & korup",
  "Penolakan kuratif massal seluruh ulasan belum tervalidasi",
  "Penyelarasan ulang sistem dari awal periode pengujian",
  "Alasan Lainnya (Kustom)...",
];

export function PurgeAllReviewsModal({
  isOpen,
  onClose,
  userRole = "PEGAWAI",
  totalCount = 0,
  onConfirmPurge,
  isPurging = false,
}: PurgeAllReviewsModalProps) {
  // Hard Delete diizinkan untuk peran SUPER_ADMIN maupun PEGAWAI operator
  const canHardDelete = userRole === "SUPER_ADMIN" || userRole === "PEGAWAI";
  const [mode, setMode] = useState<"SOFT_REJECT" | "PERMANENT">("SOFT_REJECT");
  const [selectedPreset, setSelectedPreset] = useState(PRESET_PURGE_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Keyboard navigation: Escape key closes the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPurging) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isPurging, onClose]);

  // Reset states on opening
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConfirmText("");
      setCustomReason("");
      setSelectedPreset(PRESET_PURGE_REASONS[0]);
      setMode("SOFT_REJECT");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalReason = selectedPreset;
    if (selectedPreset === "Alasan Lainnya (Kustom)...") {
      finalReason = customReason.trim();
    } else if (customReason.trim().length > 0) {
      finalReason = `${selectedPreset}: ${customReason.trim()}`;
    }

    if (mode === "PERMANENT" && !canHardDelete) {
      setError("Peran pengguna Anda tidak memiliki hak otorisasi untuk melakukan Hard Delete.");
      return;
    }

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purge-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={() => {
          if (!isPurging) onClose();
        }}
      />

      {/* Modal Dialog Card (Optimized Height, Clean Borders) */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#e2e8f0] overflow-hidden z-10 animate-in zoom-in-95 duration-150 my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#fef2f2] text-[#dc2626] flex items-center justify-center border border-[#fee2e2] shrink-0">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="purge-modal-title" className="text-sm font-bold text-[#0f172a]">
                  Hapus / Reset Seluruh Data Ulasan
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
                  Zona Bahaya
                </span>
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                Target: <span className="font-semibold text-[#0f172a]">{totalCount > 0 ? `${totalCount.toLocaleString("id-ID")} ulasan` : "Seluruh basis data"}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPurging}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#64748b] flex items-center justify-center transition-colors cursor-pointer focus-utility-ring shadow-xs"
            title="Tutup dialog (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] font-semibold">
              {error}
            </div>
          )}

          {/* Mode Selector: Soft Delete vs Hard Delete */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#0f172a]">
              Pilih Jenis Penghapusan Data:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: Soft Delete (Tolak Kuratif) */}
              <button
                type="button"
                onClick={() => setMode("SOFT_REJECT")}
                className={cn(
                  "p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer focus-utility-ring relative",
                  mode === "SOFT_REJECT"
                    ? "border-[#f97316] bg-[#fff7ed] text-[#9a3412] ring-2 ring-[#f97316]/20 shadow-xs"
                    : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569] hover:bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="block text-xs font-bold text-[#ea580c]">Soft Delete</span>
                  <span className="w-3.5 h-3.5 rounded-full border border-[#cbd5e1] flex items-center justify-center bg-white">
                    {mode === "SOFT_REJECT" && (
                      <span className="w-2 h-2 rounded-full bg-[#ea580c]" />
                    )}
                  </span>
                </div>
                <span className="block text-xs font-bold text-[#0f172a]">Tolak & Arsip</span>
                <span className="text-xs font-normal text-[#64748b] mt-0.5 block leading-tight">
                  Status diubah ke REJECTED, data tetap tersimpan untuk audit.
                </span>
              </button>

              {/* Option 2: Hard Delete (Permanen Fisik) */}
              <button
                type="button"
                onClick={() => setMode("PERMANENT")}
                className={cn(
                  "p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer focus-utility-ring relative",
                  mode === "PERMANENT"
                    ? "border-[#ef4444] bg-[#fef2f2] text-[#991b1b] ring-2 ring-[#ef4444]/20 shadow-xs"
                    : "border-[#e2e8f0] bg-[#f8fafc] text-[#475569] hover:bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="block text-xs font-bold text-[#dc2626]">Hard Delete</span>
                  <span className="w-3.5 h-3.5 rounded-full border border-[#cbd5e1] flex items-center justify-center bg-white">
                    {mode === "PERMANENT" && (
                      <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
                    )}
                  </span>
                </div>
                <span className="block text-xs font-bold text-[#0f172a]">Hapus Permanen</span>
                <span className="text-xs font-normal text-[#64748b] mt-0.5 block leading-tight">
                  Musnahkan baris data secara fisik dari basis data PostgreSQL.
                </span>
              </button>
            </div>
          </div>

          {/* Contextual Warning Card */}
          {mode === "PERMANENT" ? (
            <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#991b1b] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-[#dc2626]">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>Peringatan Keras: Hapus Total Permanen (Hard Delete)</span>
              </div>
              <p className="text-xs text-[#7f1d1d] leading-relaxed">
                Tindakan ini menghapus fisik seluruh data ulasan ({totalCount > 0 ? `${totalCount.toLocaleString("id-ID")} baris` : "semua data"}) dari tabel <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#fecaca]">RatingReview</code>. Data yang terhapus tidak dapat dikembalikan.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-[#fff7ed] border border-[#fed7aa] text-xs text-[#9a3412] space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-[#ea580c]">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Tindakan Kuratif: Soft Delete (Tolak Seluruh Data)</span>
              </div>
              <p className="text-xs text-[#7c2d12] leading-relaxed">
                Seluruh data ulasan akan ditandai dengan status <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#fed7aa]">REJECTED</code> dan dinonaktifkan dari agregasi capaian unit. Rekam jejak audit tetap dipertahankan.
              </p>
            </div>
          )}

          {/* Preset Reasons Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-[#0f172a] mb-1">
              Alasan Tindakan *
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="w-full min-h-[40px] px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
            >
              {PRESET_PURGE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional Custom Reason Textarea */}
          {(selectedPreset === "Alasan Lainnya (Kustom)..." || customReason.length > 0) && (
            <div>
              <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                Catatan Alasan Spesifik *
              </label>
              <textarea
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Tuliskan alasan spesifik pembersihan untuk rekam jejak audit..."
                className="w-full p-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium leading-relaxed"
              />
            </div>
          )}

          {/* Mandatory Confirmation Input */}
          <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#0f172a]">
                Ketik <span className="font-mono font-bold text-[#dc2626]">HAPUS SEMUA</span> untuk konfirmasi *
              </label>
              <span className="flex items-center gap-1 text-xs font-semibold text-[#64748b]">
                {isConfirmed ? (
                  <span className="text-[#16a34a] flex items-center gap-1 font-bold">
                    <Unlock className="w-3.5 h-3.5" /> Terbuka
                  </span>
                ) : (
                  <span className="text-[#64748b] flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Terkunci
                  </span>
                )}
              </span>
            </div>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="HAPUS SEMUA"
              autoComplete="off"
              spellCheck="false"
              className={cn(
                "w-full min-h-[40px] px-3 rounded-xl border bg-white text-xs font-mono font-bold tracking-wider focus-utility-ring transition-colors uppercase",
                isConfirmed
                  ? "border-[#16a34a] text-[#16a34a]"
                  : "border-[#cbd5e1] text-[#0f172a]"
              )}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPurging}
              className="min-h-[40px] h-10 px-4 rounded-xl border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] text-xs font-semibold transition-colors cursor-pointer focus-utility-ring shadow-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPurging || !isConfirmed}
              className={cn(
                "min-h-[40px] h-10 px-5 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-xs cursor-pointer focus-utility-ring",
                !isConfirmed
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                  : mode === "PERMANENT"
                  ? "bg-[#dc2626] hover:bg-[#b91c1c]"
                  : "bg-[#ea580c] hover:bg-[#c2410c]"
              )}
            >
              {isPurging ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : mode === "PERMANENT" ? (
                <Trash2 className="w-3.5 h-3.5" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              <span>
                {mode === "PERMANENT" ? "Hapus Permanen (Hard Delete)" : "Tolak Seluruh Data (Soft Delete)"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
