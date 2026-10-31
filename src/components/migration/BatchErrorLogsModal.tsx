"use client";

import React, { useEffect, useState } from "react";
import { X, AlertTriangle, ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface BatchErrorLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  fileName: string;
}

export function BatchErrorLogsModal({
  isOpen,
  onClose,
  batchId,
  fileName,
}: BatchErrorLogsModalProps) {
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const errorQuery = trpc.migration.getBatchErrorLogs.useQuery(
    {
      batchId,
      page,
      pageSize: 15,
    },
    {
      enabled: isOpen && Boolean(batchId),
    }
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = errorQuery.data?.totalPages || 1;
  const totalErrors = errorQuery.data?.total || 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="error-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Log Rincian Galat Baris
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Berkas: <span className="font-semibold text-slate-700">{fileName}</span> ({totalErrors} baris gagal)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors focus-utility-ring"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-slate-100 text-xs">
          {errorQuery.isLoading ? (
            <div className="py-12 text-center text-slate-400">
              Memuat catatan galat...
            </div>
          ) : totalErrors === 0 ? (
            <div className="py-12 text-center text-slate-500">
              Tidak ada catatan galat untuk batch ini.
            </div>
          ) : (
            errorQuery.data?.errors.map((err) => (
              <div key={err.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 font-mono">
                      Baris #{err.rowNumber}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {err.errorReason}
                    </span>
                  </div>

                  {err.rawRowData && (
                    <button
                      type="button"
                      onClick={() => handleCopy(err.id, err.rawRowData || "")}
                      title="Salin teks baris asli"
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      {copiedId === err.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-medium">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {err.rawRowData && (
                  <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                    {err.rawRowData}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <div>
              Halaman <span className="font-bold">{page}</span> dari{" "}
              <span className="font-bold">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                Berikutnya
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
