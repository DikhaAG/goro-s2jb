"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Copy,
} from "lucide-react";

export interface ReviewItem {
  id: string;
  playstoreReviewerName: string;
  originalReviewerName: string | null;
  entryDate: string | Date;
  up3: { id: string; code: string; name: string };
  ulp: { id: string; code: string; name: string };
  appVersion: { id: string; version: string };
  confidenceScore: number | null;
  ocrStatus: "QUEUED" | "DOWNLOADING" | "PROCESSING" | "COMPLETED" | "FAILED";
  validationStatus: "PENDING" | "APPROVED" | "REJECTED";
  isDuplicate: boolean;
  fieldNotes: string | null;
  reviewRemarks: string | null;
  extractedOcrText: string | null;
  evidenceImagePath: string;
}

interface ReviewsTableProps {
  items: ReviewItem[];
  isLoading: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  isAllSelected: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortChange: (column: string) => void;
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onOpenDetail: (review: ReviewItem) => void;
  onRetryOcr: (reviewId: string) => void;
  onOpenDelete: (review: ReviewItem) => void;
  isRetryingOcrId?: string | null;
}

export function ReviewsTable({
  items,
  isLoading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  sortBy,
  sortOrder,
  onSortChange,
  page,
  pageSize,
  totalPages,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onOpenDetail,
  onRetryOcr,
  onOpenDelete,
  isRetryingOcrId,
}: ReviewsTableProps) {
  const renderSortIcon = (column: string) => {
    if (sortBy !== column) {
      return (
        <ArrowUpDown className="w-3.5 h-3.5 text-[#94a3b8] group-hover:text-[#475569] transition-colors" />
      );
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#006877]" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#006877]" />
    );
  };

  const renderConfidencePill = (score: number | null, ocrStatus: string) => {
    if (ocrStatus === "PROCESSING" || ocrStatus === "DOWNLOADING") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]">
          <RefreshCw className="w-3 h-3 animate-spin text-[#0284c7]" />
          Proses
        </span>
      );
    }

    if (ocrStatus === "FAILED" || score === null) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0]">
          -
        </span>
      );
    }

    if (score >= 90.0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
          {score.toFixed(1)}%
        </span>
      );
    }

    if (score >= 70.0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
          {score.toFixed(1)}%
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-[#fef2f2] text-[#b91c1c] border border-[#fee2e2]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
        {score.toFixed(1)}%
      </span>
    );
  };

  const renderValidationStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
            <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
            Disetujui
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-[#fef2f2] text-[#b91c1c] border border-[#fee2e2]">
            <XCircle className="w-3 h-3 text-[#ef4444]" />
            Ditolak
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
            <Clock className="w-3 h-3 text-[#f97316]" />
            Menunggu
          </span>
        );
    }
  };

  const renderOcrStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#f8fafc] text-[#334155] border border-[#e2e8f0]">
            Selesai
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            Proses
          </span>
        );
      case "DOWNLOADING":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]">
            Unduh
          </span>
        );
      case "QUEUED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0]">
            Antre
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#fef2f2] text-[#b91c1c] border border-[#fee2e2]">
            <AlertCircle className="w-2.5 h-2.5" />
            Gagal
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateValue: string | Date) => {
    try {
      const d = new Date(dateValue);
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
    } catch {
      return String(dateValue);
    }
  };

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden flex flex-col">
      {/* Table Container */}
      <div className="overflow-x-auto min-h-[360px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
              {/* Checkbox All */}
              <th className="py-3 px-3.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Pilih semua baris pada halaman ini"
                  className="w-4 h-4 rounded border-[#cbd5e1] text-[#006877] focus:ring-[#00a2b9] cursor-pointer"
                />
              </th>

              {/* Reviewer Name */}
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => onSortChange("playstoreReviewerName")}
                  className="group inline-flex items-center gap-1.5 hover:text-[#0f172a] transition-colors cursor-pointer"
                >
                  <span>Pengulas Play Store</span>
                  {renderSortIcon("playstoreReviewerName")}
                </button>
              </th>

              {/* UP3 / ULP */}
              <th className="py-3 px-3">Unit Kerja (UP3 / ULP)</th>

              {/* Date */}
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => onSortChange("entryDate")}
                  className="group inline-flex items-center gap-1.5 hover:text-[#0f172a] transition-colors cursor-pointer"
                >
                  <span>Tanggal Entri</span>
                  {renderSortIcon("entryDate")}
                </button>
              </th>

              {/* OCR Score */}
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => onSortChange("confidenceScore")}
                  className="group inline-flex items-center gap-1.5 hover:text-[#0f172a] transition-colors cursor-pointer"
                >
                  <span>Skor OCR</span>
                  {renderSortIcon("confidenceScore")}
                </button>
              </th>

              {/* Status OCR */}
              <th className="py-3 px-3">Status OCR</th>

              {/* Status Validasi */}
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => onSortChange("validationStatus")}
                  className="group inline-flex items-center gap-1.5 hover:text-[#0f172a] transition-colors cursor-pointer"
                >
                  <span>Status Validasi</span>
                  {renderSortIcon("validationStatus")}
                </button>
              </th>

              {/* Actions Header */}
              <th className="py-3 px-3.5 text-right w-28">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#f1f5f9] text-xs text-[#334155]">
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  <td className="py-3 px-3.5 text-center">
                    <div className="w-4 h-4 bg-[#e2e8f0] rounded mx-auto" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-4 w-32 bg-[#e2e8f0] rounded mb-1" />
                    <div className="h-3 w-20 bg-[#f1f5f9] rounded" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-4 w-28 bg-[#e2e8f0] rounded" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-4 w-20 bg-[#e2e8f0] rounded" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-4 w-14 bg-[#e2e8f0] rounded-full" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-4 w-16 bg-[#e2e8f0] rounded" />
                  </td>
                  <td className="py-3 px-3">
                    <div className="h-4 w-20 bg-[#e2e8f0] rounded-md" />
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <div className="h-8 w-16 bg-[#e2e8f0] rounded-lg ml-auto" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              // Empty State (Matching TriageTable clean empty layout)
              <tr>
                <td colSpan={8} className="py-16 px-4 text-center">
                  <div className="max-w-xs mx-auto flex flex-col items-center space-y-3">
                    <div className="p-4 bg-[#ecfdf5] border border-[#a7f3d0] rounded-full text-[#16a34a] shadow-xs">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0f172a]">
                        Tidak Ada Ulasan Ditemukan
                      </h3>
                      <p className="text-xs text-[#64748b] mt-1">
                        Coba sesuaikan kata kunci pencarian atau atur ulang penyaring filter di atas.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              items.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isRetrying = isRetryingOcrId === item.id;

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "transition-colors",
                      isSelected
                        ? "bg-[#f0f9ff] hover:bg-[#e0f2fe]"
                        : "hover:bg-[#f8fafc]"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(item.id)}
                        aria-label={`Pilih ulasan ${item.playstoreReviewerName}`}
                        className="w-4 h-4 rounded border-[#cbd5e1] text-[#006877] focus:ring-[#00a2b9] cursor-pointer"
                      />
                    </td>

                    {/* Reviewer Name */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-semibold text-[#0f172a] hover:text-[#006877] cursor-pointer transition-colors"
                            onClick={() => onOpenDetail(item)}
                          >
                            {item.playstoreReviewerName}
                          </span>
                          {item.isDuplicate && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#faf5ff] text-[#7e22ce] border border-[#e9d5ff]">
                              <Copy className="w-2.5 h-2.5" />
                              Duplikat
                            </span>
                          )}
                        </div>
                        {item.originalReviewerName && (
                          <span className="text-[11px] text-[#64748b] truncate max-w-[200px]">
                            Akun Form: {item.originalReviewerName}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* UP3 & ULP */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col text-[11px]">
                        <span className="font-semibold text-[#0f172a]">
                          {item.up3.name}
                        </span>
                        <span className="text-[#64748b]">
                          {item.ulp.name}
                        </span>
                      </div>
                    </td>

                    {/* Entry Date */}
                    <td className="py-3 px-3 text-[#475569] whitespace-nowrap font-mono text-[11px]">
                      {formatDate(item.entryDate)}
                    </td>

                    {/* OCR Score */}
                    <td className="py-3 px-3">
                      {renderConfidencePill(item.confidenceScore, item.ocrStatus)}
                    </td>

                    {/* OCR Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderOcrStatusBadge(item.ocrStatus)}
                    </td>

                    {/* Validation Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderValidationStatusBadge(item.validationStatus)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Detail / Edit Drawer Button */}
                        <button
                          type="button"
                          onClick={() => onOpenDetail(item)}
                          className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#334155] inline-flex items-center justify-center transition-all shadow-xs focus-utility-ring cursor-pointer"
                          title="Inspeksi & Edit Ulasan"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#006877]" />
                        </button>

                        {/* Retry OCR Button */}
                        <button
                          type="button"
                          onClick={() => onRetryOcr(item.id)}
                          disabled={isRetrying || item.ocrStatus === "PROCESSING"}
                          className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#334155] inline-flex items-center justify-center transition-all shadow-xs disabled:opacity-40 focus-utility-ring cursor-pointer"
                          title="Picu Ulang OCR"
                        >
                          <RefreshCw
                            className={cn(
                              "w-3.5 h-3.5 text-[#006877]",
                              isRetrying && "animate-spin"
                            )}
                          />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => onOpenDelete(item)}
                          className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#fef2f2] text-[#94a3b8] hover:text-[#ef4444] inline-flex items-center justify-center transition-all shadow-xs focus-utility-ring cursor-pointer"
                          title="Tolak Kuratif / Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="border-t border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748b]">
        {/* Record count info */}
        <div className="flex items-center gap-3">
          <span>
            Menampilkan <span className="font-semibold text-[#0f172a]">{startRecord}</span> -{" "}
            <span className="font-semibold text-[#0f172a]">{endRecord}</span> dari{" "}
            <span className="font-semibold text-[#0f172a]">{totalCount.toLocaleString("id-ID")}</span> data
          </span>

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 pl-3 border-l border-[#cbd5e1]">
            <span className="text-[#64748b]">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#0f172a] focus-utility-ring"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Page Navigators */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page <= 1 || isLoading}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center text-[#334155] transition-colors shadow-xs focus-utility-ring cursor-pointer"
            title="Halaman Pertama"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center text-[#334155] transition-colors shadow-xs focus-utility-ring cursor-pointer"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 text-xs font-semibold text-[#0f172a] font-mono">
            Hal {page} / {totalPages || 1}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center text-[#334155] transition-colors shadow-xs focus-utility-ring cursor-pointer"
            title="Halaman Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages || isLoading}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center text-[#334155] transition-colors shadow-xs focus-utility-ring cursor-pointer"
            title="Halaman Terakhir"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
