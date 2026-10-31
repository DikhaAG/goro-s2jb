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
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={() => !isLoading && onClose()}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 p-6 transition-all transform animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Tutup dialog"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors focus-utility-ring disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3
              id="abort-modal-title"
              className="text-lg font-bold text-slate-900 leading-tight"
            >
              Hentikan Proses Migrasi?
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tindakan ini akan menghentikan pembacaan berkas
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 mb-5 text-xs text-slate-600 space-y-2">
          <div className="flex justify-between items-center text-slate-700">
            <span className="font-medium">Berkas Target:</span>
            <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={batchFileName}>
              {batchFileName}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-700">
            <span className="font-medium">Baris Tersimpan:</span>
            <span className="font-bold text-[#006877]">
              {processedRows.toLocaleString("id-ID")} baris
            </span>
          </div>
          <p className="pt-2 border-t border-slate-200/60 text-slate-500 leading-relaxed">
            Data ulasan yang telah berhasil disimpan ke basis data akan tetap tersimpan secara aman. Worker akan menghentikan stream pembacaan dan menandai status batch sebagai <span className="font-semibold text-rose-700">CANCELLED</span>.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors focus-utility-ring min-h-[44px] cursor-pointer disabled:opacity-50"
          >
            Tetap Lanjutkan
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors focus-utility-ring flex items-center justify-center gap-2 min-h-[44px] shadow-xs cursor-pointer disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menghentikan...</span>
              </>
            ) : (
              <span>Hentikan Sekarang</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
