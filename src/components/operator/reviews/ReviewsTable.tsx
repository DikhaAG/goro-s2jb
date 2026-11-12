"use client";

import React, { useMemo, useState } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  type RowData,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { hasConfirmedDuplicate } from "./duplicateDisplay";
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
  Check,
  Maximize2,
  Keyboard,
  ExternalLink,
  SlidersHorizontal,
  Columns2,
} from "lucide-react";

export interface ReviewItem {
  id: string;
  source?: "INTAKE" | "MIGRATION" | string;
  timestamp?: string | Date | null;
  createdAt?: string | Date | null;
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
  duplicateOfId?: string | null;
  duplicateOf?: {
    id: string;
    source?: "INTAKE" | "MIGRATION" | string;
    timestamp?: string | Date | null;
    createdAt?: string | Date | null;
    playstoreReviewerName: string;
    originalReviewerName?: string | null;
    entryDate: string | Date;
    evidenceImagePath: string;
    evidenceImageHash?: string | null;
    extractedOcrText?: string | null;
    validationStatus: string;
    confidenceScore?: number | null;
    up3?: { id?: string; name: string } | null;
    ulp?: { id?: string; name: string } | null;
  } | null;
  fieldNotes: string | null;
  reviewRemarks: string | null;
  extractedOcrText: string | null;
  evidenceImagePath: string;
  evidenceImageHash?: string | null;
}

// Module augmentation for TanStack Table Meta
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    onOpenDetail?: (review: ReviewItem) => void;
    onOpenLightbox?: (item: ReviewItem) => void;
    onApprove?: (id: string) => void;
    onReject?: (item: ReviewItem) => void;
    onRetryOcr?: (reviewId: string) => void;
    onOpenDelete?: (review: ReviewItem) => void;
    onOpenDuplicateSplitView?: (item: ReviewItem) => void;
    activeId?: string | null;
    isRetryingOcrId?: string | null;
  }
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
  onOpenDuplicateSplitView?: (item: ReviewItem) => void;
  isRetryingOcrId?: string | null;
  activeId?: string | null;
  onSelectActive?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (item: ReviewItem) => void;
  onOpenLightbox?: (item: ReviewItem) => void;
}

const columnHelper = createColumnHelper<ReviewItem>();

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
  onOpenDuplicateSplitView,
  isRetryingOcrId,
  activeId,
  onSelectActive,
  onApprove,
  onReject,
  onOpenLightbox,
}: ReviewsTableProps) {
  // Column Visibility State for TanStack Table
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

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

  const getImageUrl = (item: ReviewItem) => {
    if (!item.evidenceImagePath) return "";
    return item.evidenceImagePath.startsWith("http")
      ? `/api/evidence/proxy/${item.id}`
      : item.evidenceImagePath.startsWith("/")
      ? `/api/uploads${item.evidenceImagePath}`
      : `/api/uploads/${item.evidenceImagePath}`;
  };

  const renderSortIcon = (columnId: string) => {
    const isActive = sortBy === columnId;
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded-md transition-colors",
          isActive
            ? "bg-[#e0f2fe] text-[#006877]"
            : "text-[#94a3b8] group-hover:text-[#475569] group-hover:bg-[#f1f5f9]"
        )}
      >
        {isActive ? (
          sortOrder === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5 text-[#006877]" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-[#006877]" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5" />
        )}
      </span>
    );
  };

  const renderConfidencePill = (score: number | null, ocrStatus: string) => {
    if (ocrStatus === "PROCESSING" || ocrStatus === "DOWNLOADING") {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]">
          <RefreshCw className="w-3 h-3 animate-spin text-[#0284c7]" />
          <span>Proses</span>
        </span>
      );
    }

    if (ocrStatus === "FAILED" || score === null) {
      return (
        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-mono text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0]">
          -
        </span>
      );
    }

    if (score >= 90.0) {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono tabular-nums bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
          <span>{score.toFixed(1)}%</span>
        </span>
      );
    }

    if (score >= 70.0) {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono tabular-nums bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
          <span>{score.toFixed(1)}%</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono tabular-nums bg-[#fef2f2] text-[#b91c1c] border border-[#fee2e2]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
        <span>{score.toFixed(1)}%</span>
      </span>
    );
  };

  const renderValidationStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
            <span>Disetujui</span>
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#fef2f2] text-[#b91c1c] border border-[#fee2e2]">
            <XCircle className="w-3.5 h-3.5 text-[#ef4444]" />
            <span>Ditolak</span>
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
            <Clock className="w-3.5 h-3.5 text-[#f97316]" />
            <span>Menunggu</span>
          </span>
        );
    }
  };

  const renderOcrStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[#f8fafc] text-[#334155] border border-[#e2e8f0]">
            Selesai
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>Proses</span>
          </span>
        );
      case "DOWNLOADING":
        return (
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]">
            Unduh
          </span>
        );
      case "QUEUED":
        return (
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0]">
            Antre
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#fef2f2] text-[#b91c1c] border border-[#fee2e2]">
            <AlertCircle className="w-2.5 h-2.5" />
            <span>Gagal</span>
          </span>
        );
      default:
        return null;
    }
  };

  // Memoized Column Definitions leveraging TanStack Table Meta Pattern
  const columns = useMemo(
    () => [
      // 1. Checkbox Selection Column
      columnHelper.display({
        id: "select",
        size: 44,
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={onToggleSelectAll}
            aria-label="Pilih semua baris ulasan di halaman ini"
            className="w-4 h-4 rounded border-[#cbd5e1] text-[#006877] focus:ring-[#00a2b9] cursor-pointer transition-colors"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={() => onToggleSelect(row.original.id)}
            aria-label={`Pilih ulasan ${row.original.playstoreReviewerName}`}
            className="w-4 h-4 rounded border-[#cbd5e1] text-[#006877] focus:ring-[#00a2b9] cursor-pointer transition-colors"
          />
        ),
      }),

      // 2. Evidence Image Thumbnail Column with Lightbox Trigger UX
      columnHelper.display({
        id: "evidence",
        size: 60,
        header: "Eviden",
        cell: ({ row, table }) => {
          const item = row.original;
          const imageUrl = getImageUrl(item);
          return (
            <button
              type="button"
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              aria-label={`Buka pratinjau citra eviden ${item.playstoreReviewerName} di Lightbox`}
              onClick={(e) => {
                e.stopPropagation();
                table.options.meta?.onOpenLightbox?.(item);
              }}
              className="relative w-11 h-11 bg-[#f8fafc] rounded-xl overflow-hidden border border-[#cbd5e1] group/thumb cursor-zoom-in mx-auto shadow-2xs hover:border-[#00a2b9] hover:shadow-xs transition-all duration-200 block text-left focus-utility-ring"
              title="Klik atau tekan [Spasi] untuk pratinjau penuh Lightbox"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={`Eviden ${item.playstoreReviewerName}`}
                  className="w-full h-full object-cover group-hover/thumb:scale-108 transition-transform duration-200"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-[#94a3b8] font-mono">
                  N/A
                </div>
              )}
              <div className="absolute inset-0 bg-[#0f172a]/35 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-3.5 h-3.5 text-white drop-shadow-sm" />
              </div>
              {hasConfirmedDuplicate(item) && (
                <div
                  className="absolute top-0.5 right-0.5 bg-[#7e22ce] text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-2xs leading-none"
                  title="Terindikasi Duplikasi Visual"
                >
                  DUP
                </div>
              )}
            </button>
          );
        },
      }),

      // 3. Reviewer Name & Contextual Duplicate Attribution Column
      columnHelper.accessor("playstoreReviewerName", {
        id: "playstoreReviewerName",
        size: 320,
        header: "Pengulas Play Store",
        enableSorting: true,
        cell: ({ row, table }) => {
          const item = row.original;
          return (
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    e.stopPropagation();
                    table.options.meta?.onOpenDetail?.(item);
                  }}
                  className="font-semibold text-[#0f172a] hover:text-[#006877] transition-colors text-left text-xs leading-snug cursor-pointer group-hover/row:text-[#006877] underline decoration-transparent hover:decoration-[#006877]"
                  title="Klik untuk membuka lembar inspeksi & koreksi detail ulasan"
                >
                  {item.playstoreReviewerName}
                </button>
              </div>

              {item.originalReviewerName && (
                <span className="text-xs text-[#64748b] mt-0.5 truncate max-w-[260px]">
                  Akun Form: <strong className="text-[#475569] font-medium">{item.originalReviewerName}</strong>
                </span>
              )}

              {/* Cohesive Duplication Attribution Card with Split View Trigger */}
              {hasConfirmedDuplicate(item) ? (
                <div className="mt-2 p-2.5 rounded-xl bg-[#faf5ff] border border-[#e9d5ff] text-xs space-y-2 max-w-[380px] shadow-2xs">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold tracking-wide uppercase text-[#7e22ce]">
                      <Copy className="w-3.5 h-3.5 text-[#7e22ce]" />
                      <span>Duplikat Visual</span>
                    </span>
                    {item.duplicateOf?.entryDate && (
                      <span className="text-xs font-mono text-[#8b5cf6]">
                        {formatDate(item.duplicateOf.entryDate)}
                      </span>
                    )}
                  </div>

                  {item.duplicateOf ? (
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-xs text-[#6b21a8] flex items-center gap-1 truncate">
                        <span className="text-[#9333ea]">Sumber:</span>
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          onClick={(e) => {
                            e.stopPropagation();
                            table.options.meta?.onOpenDetail?.({
                              id: item.duplicateOf!.id,
                              playstoreReviewerName: item.duplicateOf!.playstoreReviewerName,
                              originalReviewerName: item.duplicateOf!.originalReviewerName || null,
                              entryDate: item.duplicateOf!.entryDate,
                              up3: (item.duplicateOf!.up3 as any) || { id: "", code: "", name: "" },
                              ulp: (item.duplicateOf!.ulp as any) || { id: "", code: "", name: "" },
                              appVersion: { id: "", version: "" },
                              confidenceScore: item.duplicateOf!.confidenceScore ?? null,
                              ocrStatus: "COMPLETED",
                              validationStatus: (item.duplicateOf!.validationStatus as any) || "PENDING",
                              isDuplicate: false,
                              fieldNotes: null,
                              reviewRemarks: null,
                              extractedOcrText: null,
                              evidenceImagePath: item.duplicateOf!.evidenceImagePath,
                            });
                          }}
                          className="font-bold underline decoration-dotted hover:decoration-solid text-[#6b21a8] hover:text-[#4c1d95] truncate text-left cursor-pointer"
                          title="Klik untuk membuka ulasan pertama yang identik"
                        >
                          {item.duplicateOf.playstoreReviewerName}
                        </button>
                      </span>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={(e) => {
                          e.stopPropagation();
                          table.options.meta?.onOpenDetail?.({
                            id: item.duplicateOf!.id,
                            playstoreReviewerName: item.duplicateOf!.playstoreReviewerName,
                            originalReviewerName: item.duplicateOf!.originalReviewerName || null,
                            entryDate: item.duplicateOf!.entryDate,
                            up3: (item.duplicateOf!.up3 as any) || { id: "", code: "", name: "" },
                            ulp: (item.duplicateOf!.ulp as any) || { id: "", code: "", name: "" },
                            appVersion: { id: "", version: "" },
                            confidenceScore: item.duplicateOf!.confidenceScore ?? null,
                            ocrStatus: "COMPLETED",
                            validationStatus: (item.duplicateOf!.validationStatus as any) || "PENDING",
                            isDuplicate: false,
                            fieldNotes: null,
                            reviewRemarks: null,
                            extractedOcrText: null,
                            evidenceImagePath: item.duplicateOf!.evidenceImagePath,
                          });
                        }}
                        className="shrink-0 p-1 rounded-md text-[#7e22ce] hover:bg-[#ede9fe] transition-colors cursor-pointer"
                        title="Buka ulasan asli"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : item.duplicateOfId ? (
                    <div className="text-xs font-mono text-[#7e22ce] bg-white px-2 py-0.5 rounded border border-[#ddd6fe] truncate">
                      Ref ID: {item.duplicateOfId}
                    </div>
                  ) : (
                    <p className="text-xs text-[#6b21a8] italic">
                      {item.reviewRemarks || "Terindikasi duplikat citra eviden"}
                    </p>
                  )}

                  {item.duplicateOf?.ulp && (
                    <div className="text-xs text-[#6b21a8]/80 flex items-center gap-1 pt-0.5 border-t border-[#f3e8ff]">
                      <span>Unit:</span>
                      <span className="font-medium text-[#4c1d95] truncate">
                        {item.duplicateOf.up3?.name || "-"} • {item.duplicateOf.ulp.name}
                      </span>
                    </div>
                  )}

                  {/* Primary Split View Comparison Action Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        table.options.meta?.onOpenDuplicateSplitView?.(item);
                      }}
                      className="w-full min-h-[34px] px-2.5 py-1.5 bg-white hover:bg-[#ede9fe] text-[#7e22ce] hover:text-[#581c87] border border-[#d8b4fe] rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95 focus-utility-ring"
                      title="Buka tampilan komparasi berdampingan (Split View) ulasan duplikat"
                    >
                      <Columns2 className="w-3.5 h-3.5 text-[#7e22ce]" />
                      <span>Bandingkan (Split View)</span>
                    </button>
                  </div>
                </div>
              ) : item.ocrStatus === "FAILED" && item.reviewRemarks ? (
                <div className="mt-2 p-2 rounded-xl bg-[#fef2f2] border border-[#fee2e2] text-xs text-[#991b1b] max-w-[380px] flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-[#dc2626] shrink-0 mt-0.5" />
                  <p className="leading-snug break-words">{item.reviewRemarks}</p>
                </div>
              ) : null}
            </div>
          );
        },
      }),

      // 4. Work Unit (UP3 & ULP) Column
      columnHelper.display({
        id: "unitKerja",
        size: 190,
        header: "Unit Kerja (UP3 / ULP)",
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col text-xs leading-snug">
              <span className="font-semibold text-[#0f172a] truncate max-w-[170px]">
                {item.up3?.name || "-"}
              </span>
              <span className="text-[#64748b] truncate max-w-[170px] mt-0.5">
                {item.ulp?.name || "-"}
              </span>
            </div>
          );
        },
      }),

      // 5. Entry Date Column
      columnHelper.accessor("entryDate", {
        id: "entryDate",
        size: 125,
        header: "Tanggal Entri",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-[#475569] whitespace-nowrap font-mono tabular-nums text-xs">
            {formatDate(row.original.entryDate)}
          </span>
        ),
      }),

      // 6. OCR Score Column
      columnHelper.accessor("confidenceScore", {
        id: "confidenceScore",
        size: 110,
        header: "Skor OCR",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-center whitespace-nowrap">
            {renderConfidencePill(row.original.confidenceScore, row.original.ocrStatus)}
          </div>
        ),
      }),

      // 7. OCR Processing Status Column
      columnHelper.accessor("ocrStatus", {
        id: "ocrStatus",
        size: 105,
        header: "Status OCR",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-center whitespace-nowrap">
            {renderOcrStatusBadge(row.original.ocrStatus)}
          </div>
        ),
      }),

      // 8. Validation Status Column
      columnHelper.accessor("validationStatus", {
        id: "validationStatus",
        size: 115,
        header: "Status Validasi",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="text-center whitespace-nowrap">
            {renderValidationStatusBadge(row.original.validationStatus)}
          </div>
        ),
      }),

      // 9. Actions Column
      columnHelper.display({
        id: "actions",
        size: 260,
        header: "Aksi Verifikasi & Kelola",
        cell: ({ row, table }) => {
          const item = row.original;
          const meta = table.options.meta;
          const isActive = meta?.activeId === item.id;
          const isRetrying = meta?.isRetryingOcrId === item.id;
          const isOcrPending =
            item.ocrStatus === "QUEUED" ||
            item.ocrStatus === "DOWNLOADING" ||
            item.ocrStatus === "PROCESSING";

          return (
            <div className="inline-flex items-center gap-1.5 justify-end">
              {/* Primary Decision: Approve */}
              <button
                type="button"
                disabled={isOcrPending}
                onClick={() => meta?.onApprove?.(item.id)}
                className={cn(
                  "min-h-[36px] h-9 min-w-[78px] px-2.5 rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] hover:bg-[#dcfce7] text-[#15803d] inline-flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer disabled:opacity-40 active:scale-95",
                  isActive && "ring-2 ring-[#16a34a]/40 font-bold"
                )}
                title={
                  isOcrPending
                    ? "Menunggu OCR selesai memproses data"
                    : "Setujui ulasan ini [A]"
                }
              >
                <Check className="w-3.5 h-3.5 text-[#16a34a] stroke-[2.5]" />
                <span className="text-xs font-semibold">Setujui</span>
                {isActive && !isOcrPending && (
                  <span className="text-xs font-mono text-[#15803d] bg-white/80 px-1.5 py-0.5 rounded border border-[#a7f3d0] leading-none">
                    A
                  </span>
                )}
              </button>

              {/* Primary Decision: Reject */}
              <button
                type="button"
                disabled={isOcrPending}
                onClick={() => meta?.onReject?.(item)}
                className={cn(
                  "min-h-[36px] h-9 min-w-[72px] px-2.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] inline-flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer disabled:opacity-40 active:scale-95",
                  isActive && "ring-2 ring-[#ef4444]/40 font-bold"
                )}
                title={
                  isOcrPending
                    ? "Menunggu OCR selesai memproses data"
                    : "Tolak ulasan ini [R]"
                }
              >
                <XCircle className="w-3.5 h-3.5 text-[#dc2626]" />
                <span className="text-xs font-semibold">Tolak</span>
                {isActive && !isOcrPending && (
                  <span className="text-xs font-mono text-[#dc2626] bg-white/80 px-1.5 py-0.5 rounded border border-[#fecaca] leading-none">
                    R
                  </span>
                )}
              </button>

              {/* Duplicate Comparison Split View Quick Button */}
              {hasConfirmedDuplicate(item) && (
                <button
                  type="button"
                  onClick={() => meta?.onOpenDuplicateSplitView?.(item)}
                  className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#e9d5ff] bg-[#faf5ff] hover:bg-[#ede9fe] text-[#7e22ce] inline-flex items-center justify-center transition-all shadow-2xs hover:border-[#c084fc] hover:text-[#581c87] active:scale-95 cursor-pointer focus-utility-ring"
                  title="Buka tampilan komparasi berdampingan (Split View) ulasan duplikat"
                  aria-label="Split view perbandingan duplikat"
                >
                  <Columns2 className="w-4 h-4 text-[#7e22ce]" />
                </button>
              )}

              <div className="w-[1px] h-5 bg-[#e2e8f0] mx-0.5" />

              {/* Detail / Inspection Drawer Button (onOpenDetail trigger) */}
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => meta?.onOpenDetail?.(item)}
                className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#334155] inline-flex items-center justify-center transition-all shadow-2xs hover:border-[#00a2b9] hover:text-[#006877] active:scale-95 cursor-pointer focus-utility-ring"
                title="Buka Lembar Inspeksi & Koreksi Ulasan Detail [Double-click]"
                aria-label="Inspeksi detail ulasan"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#006877]" />
              </button>

              {/* Retry OCR Button */}
              <button
                type="button"
                onClick={() => meta?.onRetryOcr?.(item.id)}
                disabled={isRetrying || item.ocrStatus === "PROCESSING"}
                className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#334155] inline-flex items-center justify-center transition-all shadow-2xs hover:border-[#00a2b9] hover:text-[#006877] disabled:opacity-40 active:scale-95 cursor-pointer"
                title="Picu Ulang Antrean OCR"
                aria-label="Picu ulang OCR"
              >
                <RefreshCw
                  className={cn(
                    "w-3.5 h-3.5 text-[#006877]",
                    isRetrying && "animate-spin"
                  )}
                />
              </button>

              {/* Delete / Curative Rejection Button */}
              <button
                type="button"
                onClick={() => meta?.onOpenDelete?.(item)}
                className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#fef2f2] text-[#94a3b8] hover:text-[#ef4444] hover:border-[#fecaca] inline-flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="Tolak Kuratif / Hapus Entri"
                aria-label="Hapus atau tolak kuratif ulasan"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      }),
    ],
    // Clean, static column memoization - callbacks accessed via table.options.meta
    [isAllSelected, onToggleSelectAll, onToggleSelect]
  );

  // Sync RowSelection state from selectedIds prop
  const rowSelection = useMemo<RowSelectionState>(() => {
    const map: RowSelectionState = {};
    for (const id of selectedIds) {
      map[id] = true;
    }
    return map;
  }, [selectedIds]);

  // Sync Sorting state from sortBy and sortOrder props
  const sorting = useMemo<SortingState>(() => {
    if (!sortBy) return [];
    return [{ id: sortBy, desc: sortOrder === "desc" }];
  }, [sortBy, sortOrder]);

  // TanStack Table Instance using Meta Pattern
  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: Math.max(0, page - 1),
        pageSize,
      },
      rowSelection,
      columnVisibility,
    },
    meta: {
      onOpenDetail,
      onOpenLightbox,
      onApprove,
      onReject,
      onRetryOcr,
      onOpenDelete,
      onOpenDuplicateSplitView,
      activeId,
      isRetryingOcrId,
    },
    getRowId: (row) => row.id,
    manualPagination: true,
    pageCount: totalPages,
    manualSorting: true,
    enableRowSelection: true,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden flex flex-col">
      {/* Tactical Hotkey Ribbon & Column Customization */}
      <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748b]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 font-semibold text-[#0f172a] bg-white px-2 py-1 rounded-lg border border-[#e2e8f0] shadow-2xs">
            <Keyboard className="w-3.5 h-3.5 text-[#006877]" />
            <span className="text-xs">Hotkey:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-[#334155]">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#cbd5e1] font-mono font-semibold text-xs shadow-2xs">
                A
              </kbd>
              <span>Setujui</span>
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span className="inline-flex items-center gap-1 text-[#334155]">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#cbd5e1] font-mono font-semibold text-xs shadow-2xs">
                R
              </kbd>
              <span>Tolak</span>
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span className="inline-flex items-center gap-1 text-[#334155]">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#cbd5e1] font-mono font-semibold text-xs shadow-2xs">
                J
              </kbd>
              <span>/</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#cbd5e1] font-mono font-semibold text-xs shadow-2xs">
                ↓
              </kbd>
              <span>Berikut</span>
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span className="inline-flex items-center gap-1 text-[#334155]">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#cbd5e1] font-mono font-semibold text-xs shadow-2xs">
                K
              </kbd>
              <span>/</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#cbd5e1] font-mono font-semibold text-xs shadow-2xs">
                ↑
              </kbd>
              <span>Sebelum</span>
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span className="inline-flex items-center gap-1 text-[#334155]">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#cbd5e1] font-mono font-semibold text-xs shadow-2xs">
                Spasi
              </kbd>
              <span>Lightbox</span>
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span className="inline-flex items-center gap-1 text-[#334155]">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#cbd5e1] font-mono font-semibold text-xs shadow-2xs">
                Esc
              </kbd>
              <span>Tutup</span>
            </span>
            <span className="text-[#cbd5e1]">•</span>
            <span className="inline-flex items-center gap-1 text-[#006877] font-medium">
              <span className="bg-[#e0f2fe] px-1.5 py-0.5 rounded text-xs font-mono">Double-Click</span>
              <span>Buka Detail</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeId && (
            <div className="inline-flex items-center gap-1.5 text-xs text-[#006877] font-semibold bg-[#e7eeff] px-2.5 py-1 rounded-full border border-[#cfdaf2]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a2b9]" />
              <span>Fokus Baris:</span>
              <span className="font-mono font-bold text-[#0f172a] truncate max-w-[140px]">
                {items.find((i) => i.id === activeId)?.playstoreReviewerName || "-"}
              </span>
            </div>
          )}

          {/* TanStack Column Visibility Control */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsColumnPickerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] hover:border-[#00a2b9] transition-colors shadow-2xs cursor-pointer focus-utility-ring"
              title="Atur Visibilitas Kolom Tabel"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#006877]" />
              <span>Kolom</span>
            </button>

            {isColumnPickerOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-2 z-30 space-y-1">
                <div className="text-xs font-bold text-[#64748b] uppercase tracking-wider px-2 py-1">
                  Visibilitas Kolom
                </div>
                {table
                  .getAllLeafColumns()
                  .filter((col) => col.id !== "select" && col.id !== "actions")
                  .map((column) => {
                    const columnLabel =
                      typeof column.columnDef.header === "string"
                        ? column.columnDef.header
                        : column.id;
                    return (
                      <label
                        key={column.id}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#f1f5f9] text-xs text-[#334155] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          onChange={column.getToggleVisibilityHandler()}
                          className="w-3.5 h-3.5 rounded border-[#cbd5e1] text-[#006877] focus:ring-[#00a2b9]"
                        />
                        <span className="truncate">{columnLabel}</span>
                      </label>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TanStack Table Rendering */}
      <div className="overflow-x-auto min-h-[380px]">
        <table className="w-full text-left border-collapse">
          {/* Sticky Header with TanStack flexRender */}
          <thead className="sticky top-0 z-10 bg-[#f8fafc]/95 backdrop-blur-xs border-b border-[#e2e8f0] shadow-2xs">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="text-xs font-bold text-[#64748b] uppercase tracking-wider select-none"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      style={{
                        width: header.getSize() !== 150 ? header.getSize() : undefined,
                      }}
                      className={cn(
                        "py-3.5 px-3",
                        header.id === "select" && "px-3.5 w-11 text-center",
                        header.id === "evidence" && "px-2 w-16 text-center",
                        (header.id === "confidenceScore" ||
                          header.id === "ocrStatus" ||
                          header.id === "validationStatus") &&
                          "text-center",
                        header.id === "actions" && "px-3.5 text-right min-w-[240px]"
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={() => onSortChange(header.column.id)}
                          className={cn(
                            "group inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                            (header.id === "confidenceScore" ||
                              header.id === "validationStatus") &&
                              "justify-center w-full",
                            isSorted ? "text-[#006877]" : "hover:text-[#0f172a]"
                          )}
                        >
                          <span>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {renderSortIcon(header.column.id)}
                        </button>
                      ) : (
                        <span>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-[#f1f5f9] text-xs text-[#334155]">
            {isLoading ? (
              // Skeleton Loading Rows
              Array.from({ length: 7 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  <td className="py-3.5 px-3.5 text-center">
                    <div className="w-4 h-4 bg-[#e2e8f0] rounded mx-auto" />
                  </td>
                  <td className="py-3.5 px-2 text-center">
                    <div className="w-11 h-11 bg-[#e2e8f0] rounded-xl mx-auto" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 w-36 bg-[#e2e8f0] rounded mb-1.5" />
                    <div className="h-3 w-24 bg-[#f1f5f9] rounded" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 w-28 bg-[#e2e8f0] rounded mb-1" />
                    <div className="h-3 w-20 bg-[#f1f5f9] rounded" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 w-20 bg-[#e2e8f0] rounded" />
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="h-6 w-16 bg-[#e2e8f0] rounded-full mx-auto" />
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="h-5 w-14 bg-[#e2e8f0] rounded-md mx-auto" />
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="h-6 w-20 bg-[#e2e8f0] rounded-lg mx-auto" />
                  </td>
                  <td className="py-3.5 px-3.5 text-right">
                    <div className="h-9 w-44 bg-[#e2e8f0] rounded-xl ml-auto" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="py-20 px-4 text-center">
                  <div className="max-w-sm mx-auto flex flex-col items-center space-y-3.5">
                    <div className="w-14 h-14 bg-[#f0fdf4] border border-[#bbf7d0] rounded-full flex items-center justify-center text-[#16a34a] shadow-xs">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0f172a]">
                        Tidak Ada Ulasan Ditemukan
                      </h3>
                      <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
                        Data ulasan tidak tersedia atau tidak ada baris yang cocok dengan kombinasi filter saat ini.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              // TanStack Table Rows with Double-Click UX to onOpenDetail
              table.getRowModel().rows.map((row) => {
                const item = row.original;
                const isSelected = row.getIsSelected();
                const isActive = activeId === item.id;

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectActive?.(item.id)}
                    onDoubleClick={() => onOpenDetail(item)}
                    title="Klik baris untuk memilih, double-click untuk membuka detail ulasan"
                    className={cn(
                      "transition-colors relative cursor-pointer group/row",
                      isActive
                        ? "bg-[#f0f9ff]/80 border-l-4 border-l-[#006877]"
                        : isSelected
                        ? "bg-[#f0fbfd]/60 hover:bg-[#e0f2fe]/80 border-l-4 border-l-[#00a2b9]/60"
                        : "hover:bg-[#f8fafc] border-l-4 border-l-transparent"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "py-3.5 px-3",
                          cell.column.id === "select" && "px-3.5 text-center",
                          cell.column.id === "evidence" && "px-2 text-center",
                          (cell.column.id === "confidenceScore" ||
                            cell.column.id === "ocrStatus" ||
                            cell.column.id === "validationStatus") &&
                            "text-center whitespace-nowrap",
                          cell.column.id === "entryDate" &&
                            "whitespace-nowrap font-mono tabular-nums text-xs text-[#475569]",
                          cell.column.id === "actions" && "px-3.5 text-right whitespace-nowrap"
                        )}
                        onClick={(e) => {
                          if (cell.column.id === "select" || cell.column.id === "actions") {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="border-t border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748b]">
        {/* Record Count & Page Size */}
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Menampilkan <span className="font-semibold text-[#0f172a] tabular-nums">{startRecord}</span> -{" "}
            <span className="font-semibold text-[#0f172a] tabular-nums">{endRecord}</span> dari{" "}
            <span className="font-semibold text-[#0f172a] tabular-nums">{totalCount.toLocaleString("id-ID")}</span> data
          </span>

          <div className="flex items-center gap-1.5 pl-3 border-l border-[#cbd5e1]">
            <span className="text-[#64748b]">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Pilih jumlah data per halaman"
              className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#0f172a] focus:ring-2 focus:ring-[#00a2b9] focus:outline-hidden transition-colors cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Tactical Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page <= 1 || isLoading}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center text-[#334155] transition-all shadow-2xs hover:border-[#00a2b9] active:scale-95 cursor-pointer"
            title="Halaman Pertama"
            aria-label="Ke halaman pertama"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center text-[#334155] transition-all shadow-2xs hover:border-[#00a2b9] active:scale-95 cursor-pointer"
            title="Halaman Sebelumnya"
            aria-label="Ke halaman sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 text-xs font-semibold text-[#0f172a] font-mono tabular-nums bg-white rounded-lg border border-[#e2e8f0] shadow-2xs">
            Hal {page} / {totalPages || 1}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center text-[#334155] transition-all shadow-2xs hover:border-[#00a2b9] active:scale-95 cursor-pointer"
            title="Halaman Berikutnya"
            aria-label="Ke halaman berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages || isLoading}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center text-[#334155] transition-all shadow-2xs hover:border-[#00a2b9] active:scale-95 cursor-pointer"
            title="Halaman Terakhir"
            aria-label="Ke halaman terakhir"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
