"use client";

import React, { useState } from "react";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  XCircle,
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileSpreadsheet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AbortMigrationModal } from "./AbortMigrationModal";
import { BatchErrorLogsModal } from "./BatchErrorLogsModal";

export interface BatchItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PAUSED" | "CANCELLED";
  totalRows: number;
  processedRows: number;
  failedRows: number;
  lastProcessedRow: number;
  createdAt: Date | string;
  completedAt?: Date | string | null;
  errorMessage?: string | null;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  _count?: {
    errors: number;
  };
}

interface BatchMonitorTableProps {
  batches: BatchItem[];
  totalBatches: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  selectedStatus: string;
  onPageChange: (newPage: number) => void;
  onStatusChange: (status: string) => void;
  onCancelBatch: (batchId: string) => Promise<void>;
  onResumeBatch: (batchId: string) => Promise<void>;
  isSuperAdmin: boolean;
  isLoading?: boolean;
}

export function BatchMonitorTable({
  batches,
  totalBatches,
  currentPage,
  pageSize,
  totalPages,
  selectedStatus,
  onPageChange,
  onStatusChange,
  onCancelBatch,
  onResumeBatch,
  isSuperAdmin,
  isLoading = false,
}: BatchMonitorTableProps) {
  const [abortTarget, setAbortTarget] = useState<BatchItem | null>(null);
  const [errorLogTarget, setErrorLogTarget] = useState<BatchItem | null>(null);
  const [isAborting, setIsAborting] = useState(false);

  const statusOptions = [
    { label: "Semua", value: "ALL" },
    { label: "Sedang Berjalan", value: "PROCESSING" },
    { label: "Selesai", value: "COMPLETED" },
    { label: "Dijeda", value: "PAUSED" },
    { label: "Dibatalkan", value: "CANCELLED" },
    { label: "Gagal", value: "FAILED" },
  ];

  const handleConfirmAbort = async () => {
    if (!abortTarget) return;
    setIsAborting(true);
    try {
      await onCancelBatch(abortTarget.id);
      setAbortTarget(null);
    } finally {
      setIsAborting(false);
    }
  };

  const getStatusBadge = (status: BatchItem["status"]) => {
    switch (status) {
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd] animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7]" />
            Sedang Berjalan
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0]">
            <Clock className="w-3 h-3 text-[#64748b]" />
            Menunggu
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
            <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
            Selesai
          </span>
        );
      case "PAUSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
            <PauseCircle className="w-3 h-3 text-[#f59e0b]" />
            Dijeda
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#f8fafc] text-[#475569] border border-[#cbd5e1]">
            <XCircle className="w-3 h-3 text-[#64748b]" />
            Dibatalkan
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
            <AlertTriangle className="w-3 h-3 text-[#ef4444]" />
            Gagal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden">
        {/* Table Header & Status Filter Controls */}
        <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#0f172a] leading-tight">
              Riwayat & Daftar Batch Migrasi
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              {isSuperAdmin
                ? "Menampilkan seluruh batch dari semua pengguna (Super Admin View)"
                : "Menampilkan riwayat migrasi yang diunggah oleh Anda"}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-[#64748b] mr-1 flex items-center gap-1 shrink-0 uppercase tracking-wider">
              <Filter className="w-3 h-3 text-[#006877]" /> Filter:
            </span>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusChange(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 focus-utility-ring cursor-pointer ${
                  selectedStatus === opt.value
                    ? "bg-[#00a2b9] text-white shadow-xs"
                    : "bg-white text-[#475569] border border-[#cbd5e1] hover:bg-[#f1f5f9]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                <th className="py-3 px-4">Berkas & Waktu</th>
                {isSuperAdmin && <th className="py-3 px-4">Pengunggah</th>}
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Tersimpan</th>
                <th className="py-3 px-4 text-right">Galat</th>
                <th className="py-3 px-4 text-center">Aksi Operasional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] text-xs">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 6 : 5}
                    className="py-12 text-center text-[#64748b] animate-pulse"
                  >
                    Memuat data antrean migrasi...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 6 : 5}
                    className="py-12 text-center text-[#64748b]"
                  >
                    Tidak ada catatan batch migrasi untuk filter ini.
                  </td>
                </tr>
              ) : (
                batches.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#f8fafc] transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#0f172a] truncate max-w-[240px] flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-[#15803d] shrink-0" />
                        <span title={item.fileName}>{item.fileName}</span>
                      </div>
                      <div className="text-[11px] font-mono text-[#64748b] mt-0.5">
                        {formatDate(item.createdAt)}
                      </div>
                    </td>

                    {isSuperAdmin && (
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#0f172a]">
                          {item.uploadedBy?.name || "Sistem"}
                        </div>
                        <div className="text-[11px] font-mono text-[#64748b]">
                          {item.uploadedBy?.email || "internal"}
                        </div>
                      </td>
                    )}

                    <td className="py-3.5 px-4">
                      {getStatusBadge(item.status)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0f172a]">
                      {item.processedRows.toLocaleString("id-ID")}
                      {item.totalRows > 0 && (
                        <span className="text-[11px] text-[#64748b] font-normal">
                          {" "}/ {item.totalRows.toLocaleString("id-ID")}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      {item.failedRows > 0 ? (
                        <span className="text-[#b91c1c]">
                          {item.failedRows.toLocaleString("id-ID")}
                        </span>
                      ) : (
                        <span className="text-[#94a3b8]">0</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.status === "PAUSED" && (
                          <button
                            type="button"
                            onClick={() => onResumeBatch(item.id)}
                            title="Lanjutkan migrasi dari baris terakhir"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#006877] bg-[#f0fdfa] hover:bg-[#ccfbf1] border border-[#99f6e4] transition-all focus-utility-ring cursor-pointer min-h-[36px]"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Lanjut</span>
                          </button>
                        )}

                        {(item.status === "PROCESSING" ||
                          item.status === "PENDING" ||
                          item.status === "PAUSED") && (
                          <button
                            type="button"
                            onClick={() => setAbortTarget(item)}
                            title="Hentikan dan batalkan proses"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#b91c1c] bg-[#fef2f2] hover:bg-[#fee2e2] border border-[#fecaca] transition-all focus-utility-ring cursor-pointer min-h-[36px]"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Batal</span>
                          </button>
                        )}

                        {(item.failedRows > 0 ||
                          (item._count?.errors && item._count.errors > 0)) && (
                          <button
                            type="button"
                            onClick={() => setErrorLogTarget(item)}
                            title="Buka rincian baris galat batch ini"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-[#b91c1c] bg-[#fef2f2] hover:bg-[#fee2e2] border border-[#fecaca] transition-all focus-utility-ring cursor-pointer min-h-[36px]"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Galat ({item.failedRows || item._count?.errors})</span>
                          </button>
                        )}

                        {item.status !== "PROCESSING" &&
                          item.status !== "PENDING" &&
                          item.status !== "PAUSED" &&
                          item.failedRows === 0 && (
                            <span className="text-[#94a3b8] text-[11px] font-semibold">
                              Tuntas
                            </span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#64748b]">
            <div>
              Menampilkan Halaman <span className="font-bold text-[#0f172a]">{currentPage}</span> dari{" "}
              <span className="font-bold text-[#0f172a]">{totalPages}</span> ({totalBatches} total data)
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-utility-ring font-bold text-xs text-[#334155] min-h-[36px]"
              >
                <ChevronLeft className="w-4 h-4" />
                Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-utility-ring font-bold text-xs text-[#334155] min-h-[36px]"
              >
                Berikutnya
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {abortTarget && (
        <AbortMigrationModal
          isOpen={Boolean(abortTarget)}
          onClose={() => setAbortTarget(null)}
          onConfirm={handleConfirmAbort}
          batchFileName={abortTarget.fileName}
          processedRows={abortTarget.processedRows}
          isLoading={isAborting}
        />
      )}

      {errorLogTarget && (
        <BatchErrorLogsModal
          isOpen={Boolean(errorLogTarget)}
          onClose={() => setErrorLogTarget(null)}
          batchId={errorLogTarget.id}
          fileName={errorLogTarget.fileName}
        />
      )}
    </>
  );
}
