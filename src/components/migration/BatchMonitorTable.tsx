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
          <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5" />
            Sedang Berjalan
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="w-3 h-3 mr-1" />
            Menunggu
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Selesai
          </Badge>
        );
      case "PAUSED":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <PauseCircle className="w-3 h-3 mr-1" />
            Dijeda
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
            <XCircle className="w-3 h-3 mr-1" />
            Dibatalkan
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Gagal
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Header & Status Filter Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              Riwayat & Daftar Batch Migrasi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSuperAdmin
                ? "Menampilkan seluruh batch dari semua pengguna (Super Admin)"
                : "Menampilkan riwayat migrasi yang diunggah oleh Anda"}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-400 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusChange(opt.value)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 focus-utility-ring ${
                  selectedStatus === opt.value
                    ? "bg-[#006877] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
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
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Berkas & Waktu</th>
                {isSuperAdmin && <th className="py-3 px-4">Pengunggah</th>}
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Tersimpan</th>
                <th className="py-3 px-4 text-right">Galat</th>
                <th className="py-3 px-4 text-center">Aksi Operasional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 6 : 5}
                    className="py-12 text-center text-slate-400"
                  >
                    Memuat data antrean migrasi...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 6 : 5}
                    className="py-12 text-center text-slate-400"
                  >
                    Tidak ada catatan batch migrasi untuk filter ini.
                  </td>
                </tr>
              ) : (
                batches.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 truncate max-w-[240px]">
                        {item.fileName}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {formatDate(item.createdAt)}
                      </div>
                    </td>

                    {isSuperAdmin && (
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">
                          {item.uploadedBy?.name || "Sistem"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.uploadedBy?.email || "internal"}
                        </div>
                      </td>
                    )}

                    <td className="py-3.5 px-4">
                      {getStatusBadge(item.status)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                      {item.processedRows.toLocaleString("id-ID")}
                      {item.totalRows > 0 && (
                        <span className="text-[11px] text-slate-400 font-normal">
                          {" "}/ {item.totalRows.toLocaleString("id-ID")}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium">
                      {item.failedRows > 0 ? (
                        <span className="text-rose-600 font-semibold">
                          {item.failedRows.toLocaleString("id-ID")}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.status === "PAUSED" && (
                          <button
                            type="button"
                            onClick={() => onResumeBatch(item.id)}
                            title="Lanjutkan migrasi dari baris terakhir"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-[#006877] bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors focus-utility-ring"
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors focus-utility-ring"
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors focus-utility-ring"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Galat ({item.failedRows || item._count?.errors})</span>
                          </button>
                        )}

                        {item.status !== "PROCESSING" &&
                          item.status !== "PENDING" &&
                          item.status !== "PAUSED" &&
                          item.failedRows === 0 && (
                            <span className="text-slate-400 text-[11px]">
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
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>
              Menampilkan Halaman <span className="font-bold">{currentPage}</span> dari{" "}
              <span className="font-bold">{totalPages}</span> ({totalBatches} total data)
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-utility-ring font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-utility-ring font-medium"
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
