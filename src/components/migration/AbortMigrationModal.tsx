"use client";

import React, { useEffect } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";

interface AbortMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  batchFileName: string;
  processedRows: number;
  isLoading: boolean;
}

export function AbortMigrationModal({
  isOpen,
  onClose,
  onConfirm,
  batchFileName,
  processedRows,
  isLoading,
}: AbortMigrationModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="abort-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs transition-opacity"
        onClick={() => !isLoading && onClose()}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] overflow-hidden z-10 p-6 transition-all transform animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Tutup dialog"
          className="absolute top-4 right-4 text-[#94a3b8] hover:text-[#0f172a] rounded-xl p-1.5 hover:bg-[#f1f5f9] transition-colors focus-utility-ring disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#fef2f2] text-[#dc2626] flex items-center justify-center shrink-0 border border-[#fecaca]">
            <AlertTriangle className="w-6 h-6 text-[#dc2626]" />
          </div>
          <div>
            <h3
              id="abort-modal-title"
              className="text-lg font-bold text-[#0f172a] leading-tight"
            >
              Hentikan Proses Migrasi?
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Tindakan ini akan menghentikan pembacaan berkas
            </p>
          </div>
        </div>

        <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5 mb-5 text-xs text-[#475569] space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-[#64748b]">Berkas Target:</span>
            <span className="font-bold text-[#0f172a] truncate max-w-[200px]" title={batchFileName}>
              {batchFileName}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-[#64748b]">Baris Tersimpan:</span>
            <span className="font-mono font-bold text-[#006877]">
              {processedRows.toLocaleString("id-ID")} baris
            </span>
          </div>
          <p className="pt-2 border-t border-[#e2e8f0] text-[#64748b] leading-relaxed">
            Data ulasan yang telah berhasil disimpan ke basis data akan tetap tersimpan secara aman. Worker akan menghentikan stream pembacaan dan menandai status batch sebagai <span className="font-bold text-[#b91c1c]">CANCELLED</span>.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9] transition-all focus-utility-ring disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#dc2626] hover:bg-[#b91c1c] transition-all shadow-xs focus-utility-ring disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Menghentikan...</span>
              </>
            ) : (
              <span>Ya, Hentikan Migrasi</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
