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
        className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] overflow-hidden z-10 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fef2f2] text-[#dc2626] flex items-center justify-center border border-[#fecaca] shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#dc2626]" />
            </div>
            <div>
              <h3 id="error-modal-title" className="text-base font-bold text-[#0f172a] leading-tight">
                Log Rincian Galat Baris
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Berkas: <span className="font-semibold text-[#0f172a]">{fileName}</span> ({totalErrors} baris gagal terisolasi)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="text-[#94a3b8] hover:text-[#0f172a] rounded-xl p-1.5 hover:bg-[#f1f5f9] transition-colors focus-utility-ring"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-[#f1f5f9] text-xs">
          {errorQuery.isLoading ? (
            <div className="py-12 text-center text-[#64748b] animate-pulse">
              Memuat catatan galat...
            </div>
          ) : totalErrors === 0 ? (
            <div className="py-12 text-center text-[#64748b]">
              Tidak ada catatan galat untuk batch ini.
            </div>
          ) : (
            errorQuery.data?.errors.map((err) => (
              <div key={err.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#b91c1c] bg-[#fef2f2] px-2.5 py-0.5 rounded-lg border border-[#fecaca] font-mono text-xs">
                      Baris #{err.rowNumber}
                    </span>
                    <span className="font-semibold text-[#0f172a]">
                      {err.errorReason}
                    </span>
                  </div>

                  {err.rawRowData && (
                    <button
                      type="button"
                      onClick={() => handleCopy(err.id, err.rawRowData || "")}
                      title="Salin teks baris asli"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#334155] hover:text-[#0f172a] px-2.5 py-1.5 rounded-lg bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] transition-all focus-utility-ring min-h-[32px] cursor-pointer"
                    >
                      {copiedId === err.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#16a34a]" />
                          <span className="text-[#16a34a]">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#64748b]" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {err.rawRowData && (
                  <div className="bg-[#0f172a] text-[#5eead4] p-3 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all border border-[#334155]">
                    {err.rawRowData}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs text-[#64748b]">
            <div>
              Halaman <span className="font-bold text-[#0f172a]">{page}</span> dari{" "}
              <span className="font-bold text-[#0f172a]">{totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs text-[#334155] min-h-[36px] focus-utility-ring"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] transition-all disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs text-[#334155] min-h-[36px] focus-utility-ring"
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
