"use client";

import React, { useState } from "react";
import { X, Trash2, AlertTriangle, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: {
    id: string;
    playstoreReviewerName: string;
  } | null;
  userRole?: string;
  onConfirmDelete: (data: {
    id: string;
    mode: "SOFT_REJECT" | "PERMANENT";
    reason: string;
  }) => void;
  isDeleting?: boolean;
}

const PRESET_REJECT_REASONS = [
  "Eviden buram atau tangkapan layar terpotong",
  "Nama akun pengulas tidak cocok dengan data",
  "Terindikasi duplikasi eviden (pHash identik)",
  "Bukan tangkapan layar ulasan PLN Mobile",
  "Data sampah / hasil uji coba lapangan",
];

export function DeleteReviewModal({
  isOpen,
  onClose,
  review,
  userRole = "PEGAWAI",
  onConfirmDelete,
  isDeleting = false,
}: DeleteReviewModalProps) {
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const [mode, setMode] = useState<"SOFT_REJECT" | "PERMANENT">("SOFT_REJECT");
  const [reason, setReason] = useState(PRESET_REJECT_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !review) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = customReason.trim().length > 0 ? customReason.trim() : reason;

    if (!finalReason || finalReason.length < 3) {
      setError("Alasan tindakan wajib diisi minimal 3 karakter.");
      return;
    }

    if (mode === "PERMANENT") {
      if (confirmText.trim() !== "HAPUS") {
        setError('Ketik "HAPUS" untuk konfirmasi penghapusan permanen.');
        return;
      }
    }

    setError(null);
    onConfirmDelete({
      id: review.id,
      mode,
      reason: finalReason,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#e2e8f0] overflow-hidden z-10 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#fef2f2] text-[#dc2626] flex items-center justify-center border border-[#fee2e2]">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">
                Tindakan Kuratif / Penghapusan
              </h3>
              <p className="text-xs text-[#64748b] truncate max-w-[240px]">
                Ulasan: <span className="font-semibold text-[#0f172a]">{review.playstoreReviewerName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#64748b] flex items-center justify-center transition-colors cursor-pointer focus-utility-ring shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] font-medium">
              {error}
            </div>
          )}

          {/* Super Admin Mode Selector */}
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#0f172a]">
                Pilih Jenis Tindakan
              </label>
              <div className="grid grid-cols-2 gap-2">
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
                  <span className="block text-xs font-bold">Tolak & Arsip</span>
                  <span className="text-[10px] font-normal text-[#64748b] mt-0.5 block">
                    Status REJECTED, rekam audit
                  </span>
                </button>

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
                  <span className="block text-xs font-bold">Hapus Permanen</span>
                  <span className="text-[10px] font-normal text-[#64748b] mt-0.5 block">
                    Hapus total dari PostgreSQL
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Mode Warning Notice */}
          {mode === "PERMANENT" ? (
            <div className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#991b1b] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#dc2626]" />
              <span className="leading-relaxed">
                <strong>Peringatan Super Admin:</strong> Tindakan ini menghapus baris data secara permanen dari basis data dan tidak dapat dipulihkan kembali.
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#fff7ed] border border-[#fed7aa] text-xs text-[#9a3412] flex items-start gap-2.5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#f97316]" />
              <span className="leading-relaxed">
                Baris ulasan akan ditandai berstatus <strong>Ditolak (REJECTED)</strong> dan tidak dimasukkan ke dalam agregasi realisasi sah.
              </span>
            </div>
          )}

          {/* Preset Reasons Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
              Alasan Penolakan Kuratif *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
            >
              {PRESET_REJECT_REASONS.map((r) => (
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

          {/* Confirmation Text if Permanent Delete */}
          {mode === "PERMANENT" && (
            <div>
              <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                Ketik <span className="font-mono font-bold text-[#dc2626]">HAPUS</span> untuk konfirmasi *
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="HAPUS"
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] font-mono focus:bg-white focus-utility-ring font-bold"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="min-h-[44px] h-11 px-4 rounded-xl border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] text-xs font-semibold transition-colors cursor-pointer focus-utility-ring shadow-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isDeleting || (mode === "PERMANENT" && confirmText.trim() !== "HAPUS")}
              className={cn(
                "min-h-[44px] h-11 px-5 rounded-xl text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring",
                mode === "PERMANENT"
                  ? "bg-[#dc2626] hover:bg-[#b91c1c]"
                  : "bg-[#f97316] hover:bg-[#ea580c]"
              )}
            >
              {isDeleting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>
                {mode === "PERMANENT" ? "Hapus Permanen" : "Tolak & Simpan Catatan"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
