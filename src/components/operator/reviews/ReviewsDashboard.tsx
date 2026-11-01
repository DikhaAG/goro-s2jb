"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  FolderKanban,
  FilePlus,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Trash2,
  X,
  Zap,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReviewsKpiRibbon } from "./ReviewsKpiRibbon";
import { ReviewsFilterBar, FilterState } from "./ReviewsFilterBar";
import { ReviewsTable, ReviewItem } from "./ReviewsTable";
import { ReviewDetailDrawer } from "./ReviewDetailDrawer";
import { BulkActionBar } from "./BulkActionBar";
import { BulkReassignUnitModal } from "./BulkReassignUnitModal";
import { DeleteReviewModal } from "./DeleteReviewModal";
import { BulkDeleteReviewModal } from "./BulkDeleteReviewModal";
import { PurgeAllReviewsModal } from "./PurgeAllReviewsModal";
import { EvidenceLightbox } from "@/components/operator/EvidenceLightbox";
import { RejectReasonDialog } from "@/components/operator/RejectReasonDialog";
import { useTriageHotkeys } from "@/hooks/useTriageHotkeys";

interface UndoState {
  reviewId: string;
  reviewerName: string;
  decision: "APPROVED" | "REJECTED";
  item: ReviewItem;
  expiresAt: number;
}

export function ReviewsDashboard() {
  // Session to check user role
  const { data: session } = trpc.auth.getSession.useQuery();
  const userRole = session?.role || "PEGAWAI";

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    validationStatus: "ALL",
    ocrStatus: "ALL",
    validationZone: "ALL",
    up3Id: "",
    ulpId: "",
    isDuplicate: undefined,
  });

  // Table State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<string>("entryDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Triage Active Row & Modals State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<ReviewItem | null>(null);
  const [rejectDialogItem, setRejectDialogItem] = useState<ReviewItem | null>(null);

  // Optimistic 5-Second Undo Toast State
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(5);

  // Drawer & Modals State
  const [selectedReviewForDrawer, setSelectedReviewForDrawer] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [reviewToDelete, setReviewToDelete] = useState<{ id: string; playstoreReviewerName: string } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isPurgeAllModalOpen, setIsPurgeAllModalOpen] = useState(false);

  const [isBulkReassignModalOpen, setIsBulkReassignModalOpen] = useState(false);
  const [retryingSingleId, setRetryingSingleId] = useState<string | null>(null);

  // Notification Toast State
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Queries
  const { data: filterOptions } = trpc.reviews.getFilterOptions.useQuery();

  const listQueryInput = useMemo(
    () => ({
      page,
      pageSize,
      sortBy: sortBy as any,
      sortOrder,
      search: filters.search.trim() || undefined,
      validationStatus: (filters.validationStatus as any) || "ALL",
      ocrStatus: (filters.ocrStatus as any) || "ALL",
      validationZone: (filters.validationZone as any) || "ALL",
      up3Id: filters.up3Id || undefined,
      ulpId: filters.ulpId || undefined,
      isDuplicate: filters.isDuplicate,
    }),
    [page, pageSize, sortBy, sortOrder, filters]
  );

  const {
    data: listData,
    isLoading: isListLoading,
    isFetching: isListFetching,
    refetch: refetchList,
  } = trpc.reviews.getList.useQuery(listQueryInput, {
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const activeOcrCount = query.state.data?.kpi?.activeOcr ?? 0;
      return activeOcrCount > 0 ? 2500 : false;
    },
  });

  const currentItems = useMemo(
    () => (listData?.items as unknown as ReviewItem[]) || [],
    [listData?.items]
  );

  // Synchronize activeId with current items
  useEffect(() => {
    if (currentItems.length > 0) {
      if (!activeId || !currentItems.some((i) => i.id === activeId)) {
        setActiveId(currentItems[0].id);
      }
    } else {
      setActiveId(null);
    }
  }, [currentItems, activeId]);

  const activeItem = useMemo(() => {
    return currentItems.find((i) => i.id === activeId) || null;
  }, [currentItems, activeId]);

  // Mutations
  const submitDecisionMutation = trpc.triage.submitDecision.useMutation({
    onSuccess: () => {
      refetchList();
    },
    onError: (err) => {
      showToast("error", err.message || "Gagal memperbarui status verifikasi.");
    },
  });

  const undoDecisionMutation = trpc.triage.undoDecision.useMutation({
    onSuccess: () => {
      showToast("success", "Keputusan verifikasi berhasil dibatalkan.");
      refetchList();
    },
    onError: (err) => {
      showToast("error", err.message || "Gagal membatalkan keputusan verifikasi.");
    },
  });

  const retryOcrMutation = trpc.reviews.retryOcr.useMutation({
    onSuccess: () => {
      showToast("success", "Pekerjaan OCR berhasil di-enqueue ulang ke worker.");
      setRetryingSingleId(null);
      refetchList();
    },
    onError: (err) => {
      showToast("error", err.message || "Gagal memicu ulang OCR.");
      setRetryingSingleId(null);
    },
  });

  const bulkRetryOcrMutation = trpc.reviews.bulkRetryOcr.useMutation({
    onSuccess: (res) => {
      showToast("success", `${res.count} pekerjaan OCR berhasil dimasukkan ke antrean.`);
      setSelectedIds([]);
      refetchList();
    },
    onError: (err) => {
      showToast("error", err.message || "Gagal memicu ulang OCR massal.");
    },
  });

  const bulkUpdateMutation = trpc.reviews.bulkUpdate.useMutation({
    onSuccess: (res) => {
      showToast("success", `${res.count} baris data ulasan berhasil diperbarui.`);
      setSelectedIds([]);
      setIsBulkReassignModalOpen(false);
      refetchList();
    },
    onError: (err) => {
      showToast("error", err.message || "Gagal memperbarui ulasan massal.");
    },
  });

  const deleteMutation = trpc.reviews.delete.useMutation({
    onSuccess: (res) => {
      if (res.mode === "PERMANENT") {
        showToast("success", "Ulasan berhasil dihapus secara permanen dari basis data.");
      } else {
        showToast("success", "Ulasan berhasil ditandai REJECTED (kuratif).");
      }
      setIsDeleteModalOpen(false);
      setReviewToDelete(null);
      refetchList();
    },
    onError: (err) => {
      showToast("error", err.message || "Gagal melakukan tindakan kuratif.");
    },
  });

  const bulkDeleteMutation = trpc.reviews.bulkDelete.useMutation({
    onSuccess: (res) => {
      if (res.mode === "PERMANENT") {
        showToast("success", `${res.count} baris ulasan berhasil dihapus secara permanen.`);
      } else {
        showToast("success", `${res.count} baris ulasan berhasil ditandai REJECTED (kuratif massal).`);
      }
      setIsBulkDeleteModalOpen(false);
      setSelectedIds([]);
      refetchList();
    },
    onError: (err) => {
      showToast("error", err.message || "Gagal melakukan tindakan kuratif massal.");
    },
  });

  const deleteAllMutation = trpc.reviews.deleteAll.useMutation({
    onSuccess: (res) => {
      if (res.mode === "PERMANENT") {
        showToast("success", `Seluruh data ulasan (${res.count} baris) berhasil dihapus permanen.`);
      } else {
        showToast("success", `Seluruh data ulasan (${res.count} baris) berhasil ditandai REJECTED.`);
      }
      setIsPurgeAllModalOpen(false);
      setSelectedIds([]);
      refetchList();
    },
    onError: (err) => {
      showToast("error", err.message || "Gagal melakukan tindakan pada seluruh data ulasan.");
    },
  });

  // Undo Timer Countdown
  useEffect(() => {
    if (!undoState) return;

    const interval = setInterval(() => {
      const remainingMs = undoState.expiresAt - Date.now();
      const seconds = Math.ceil(remainingMs / 1000);
      if (seconds <= 0) {
        setUndoState(null);
      } else {
        setUndoSecondsLeft(seconds);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [undoState]);

  // Triage Quick Action Handlers
  const handleApprove = (id: string) => {
    const targetItem = currentItems.find((i) => i.id === id);
    if (!targetItem) return;

    // Advance activeId to next row for smooth workflow
    const currentIndex = currentItems.findIndex((i) => i.id === id);
    if (currentIndex < currentItems.length - 1) {
      setActiveId(currentItems[currentIndex + 1].id);
    }

    setUndoState({
      reviewId: id,
      reviewerName: targetItem.playstoreReviewerName,
      decision: "APPROVED",
      item: targetItem,
      expiresAt: Date.now() + 5000,
    });
    setUndoSecondsLeft(5);

    submitDecisionMutation.mutate({
      reviewId: id,
      decision: "APPROVED",
    });
  };

  const handleOpenRejectDialog = (item: ReviewItem) => {
    setRejectDialogItem(item);
  };

  const handleConfirmReject = (reason: string) => {
    if (!rejectDialogItem) return;
    const targetItem = rejectDialogItem;
    const id = targetItem.id;

    setRejectDialogItem(null);

    // Advance activeId to next row for smooth workflow
    const currentIndex = currentItems.findIndex((i) => i.id === id);
    if (currentIndex < currentItems.length - 1) {
      setActiveId(currentItems[currentIndex + 1].id);
    }

    setUndoState({
      reviewId: id,
      reviewerName: targetItem.playstoreReviewerName,
      decision: "REJECTED",
      item: targetItem,
      expiresAt: Date.now() + 5000,
    });
    setUndoSecondsLeft(5);

    submitDecisionMutation.mutate({
      reviewId: id,
      decision: "REJECTED",
      remarks: reason,
    });
  };

  const handleUndo = () => {
    if (!undoState) return;
    const { reviewId } = undoState;
    setUndoState(null);

    undoDecisionMutation.mutate({
      reviewId,
      previousStatus: "NEEDS_REVIEW",
    });
  };

  // Keyboard Navigation Hotkeys
  useTriageHotkeys(
    {
      onApprove: () => {
        if (
          activeId &&
          !lightboxItem &&
          !rejectDialogItem &&
          !isDrawerOpen &&
          !isDeleteModalOpen &&
          !isBulkDeleteModalOpen &&
          !isPurgeAllModalOpen &&
          !isBulkReassignModalOpen
        ) {
          handleApprove(activeId);
        }
      },
      onReject: () => {
        if (
          activeItem &&
          !lightboxItem &&
          !rejectDialogItem &&
          !isDrawerOpen &&
          !isDeleteModalOpen &&
          !isBulkDeleteModalOpen &&
          !isPurgeAllModalOpen &&
          !isBulkReassignModalOpen
        ) {
          handleOpenRejectDialog(activeItem);
        }
      },
      onNext: () => {
        if (
          !lightboxItem &&
          !rejectDialogItem &&
          !isDrawerOpen &&
          currentItems.length > 0
        ) {
          const currentIndex = currentItems.findIndex((i) => i.id === activeId);
          if (currentIndex < currentItems.length - 1) {
            setActiveId(currentItems[currentIndex + 1].id);
          }
        }
      },
      onPrevious: () => {
        if (
          !lightboxItem &&
          !rejectDialogItem &&
          !isDrawerOpen &&
          currentItems.length > 0
        ) {
          const currentIndex = currentItems.findIndex((i) => i.id === activeId);
          if (currentIndex > 0) {
            setActiveId(currentItems[currentIndex - 1].id);
          }
        }
      },
      onToggleLightbox: () => {
        if (
          rejectDialogItem ||
          isDrawerOpen ||
          isDeleteModalOpen ||
          isBulkDeleteModalOpen ||
          isPurgeAllModalOpen ||
          isBulkReassignModalOpen
        ) {
          return;
        }
        if (lightboxItem) {
          setLightboxItem(null);
        } else if (activeItem) {
          setLightboxItem(activeItem);
        }
      },
      onCloseModal: () => {
        setLightboxItem(null);
        setRejectDialogItem(null);
      },
    },
    {
      enabled: true,
      isModalOpen: !!lightboxItem || !!rejectDialogItem,
    }
  );

  // Filter Handlers
  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPage(1); // reset to page 1 on filter change
    setSelectedIds([]); // clear selection
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      validationStatus: "ALL",
      ocrStatus: "ALL",
      validationZone: "ALL",
      up3Id: "",
      ulpId: "",
      isDuplicate: undefined,
    });
    setPage(1);
    setSelectedIds([]);
  };

  const handleQuickKpiFilter = (quickFilter: {
    validationStatus?: string;
    ocrStatus?: string;
    isDuplicate?: boolean;
  }) => {
    setFilters((prev) => ({
      ...prev,
      ...quickFilter,
    }));
    setPage(1);
    setSelectedIds([]);
  };

  // Sort Handler
  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // Selection Handlers
  const isAllCurrentSelected =
    currentItems.length > 0 &&
    currentItems.every((item) => selectedIds.includes(item.id));

  const handleToggleSelectAll = () => {
    if (isAllCurrentSelected) {
      // Deselect all on current page
      const pageItemIds = new Set(currentItems.map((i) => i.id));
      setSelectedIds((prev) => prev.filter((id) => !pageItemIds.has(id)));
    } else {
      // Select all on current page
      const pageItemIds = currentItems.map((i) => i.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageItemIds])));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Single Action Handlers
  const handleOpenDetail = (review: ReviewItem) => {
    setSelectedReviewForDrawer(review.id);
    setIsDrawerOpen(true);
  };

  const handleRetrySingleOcr = (reviewId: string) => {
    setRetryingSingleId(reviewId);
    retryOcrMutation.mutate({ reviewId });
  };

  const handleOpenDelete = (review: ReviewItem) => {
    setReviewToDelete({
      id: review.id,
      playstoreReviewerName: review.playstoreReviewerName,
    });
    setIsDeleteModalOpen(true);
  };

  // Bulk Action Handlers
  const handleBulkRetryOcr = () => {
    if (selectedIds.length === 0) return;
    bulkRetryOcrMutation.mutate({ reviewIds: selectedIds });
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      ids: selectedIds,
      validationStatus: "APPROVED",
      remarks: "Disetujui serentak oleh operator triase",
    });
  };

  const handleBulkReject = () => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({
      ids: selectedIds,
      validationStatus: "REJECTED",
      remarks: "Ditolak serentak oleh operator triase",
    });
  };

  const handleBulkReassignConfirm = (data: { up3Id: string; ulpId: string; remarks?: string }) => {
    bulkUpdateMutation.mutate({
      ids: selectedIds,
      up3Id: data.up3Id,
      ulpId: data.ulpId,
      remarks: data.remarks,
    });
  };

  // CSV Export Handler
  const handleExportCsv = (onlySelected = false) => {
    const recordsToExport = onlySelected
      ? currentItems.filter((i) => selectedIds.includes(i.id))
      : currentItems;

    if (recordsToExport.length === 0) {
      showToast("error", "Tidak ada baris data untuk diekspor.");
      return;
    }

    const headers = [
      "ID",
      "Nama Pengulas Play Store",
      "Akun Google Form",
      "UP3",
      "ULP",
      "Tanggal Entri",
      "Skor OCR (%)",
      "Status OCR",
      "Status Validasi",
      "Indikasi Duplikat",
      "Catatan",
    ];

    const rows = recordsToExport.map((item) => [
      `"${item.id}"`,
      `"${(item.playstoreReviewerName || "").replace(/"/g, '""')}"`,
      `"${(item.originalReviewerName || "").replace(/"/g, '""')}"`,
      `"${(item.up3?.name || "").replace(/"/g, '""')}"`,
      `"${(item.ulp?.name || "").replace(/"/g, '""')}"`,
      `"${new Date(item.entryDate).toISOString()}"`,
      item.confidenceScore !== null ? item.confidenceScore.toFixed(1) : "-",
      item.ocrStatus,
      item.validationStatus,
      item.isDuplicate ? "YA" : "TIDAK",
      `"${(item.reviewRemarks || item.fieldNotes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `ulasan_export_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("success", `${recordsToExport.length} baris ulasan berhasil diekspor ke CSV.`);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Toast Notification (Matching Triage Undo Banner) */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0f172a] text-white border border-[#334155] shadow-2xl rounded-2xl p-4 text-xs animate-in slide-in-from-bottom-5 duration-200"
          )}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#ef4444] shrink-0" />
            )}
            <span className="text-[#f8fafc] font-medium">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 text-[#94a3b8] hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="rounded-2xl p-6 sm:p-8 bg-white border border-[#e2e8f0] shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral" className="gap-1 font-semibold">
                <Zap className="w-3.5 h-3.5 text-[#006877]" />
                <span>PLN UID S2JB</span>
              </Badge>
              <span className="text-xs text-[#64748b]">
                Sistem Validasi Eviden Rating PLN Mobile 2026
              </span>
              <span className="bg-[#00A3E0]/10 text-[#00A3E0] border border-[#00A3E0]/20 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Human-in-the-Loop & Triase
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a] flex items-center gap-2.5">
              <FolderKanban className="w-6 h-6 text-[#00A3E0]" />
              <span>Pusat Triase & Kelola Data Ulasan</span>
            </h1>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Verifikasi cepat dengan hotkey taktis [A]/[R], inspeksi citra resolusi tinggi Lightbox [Spasi], koreksi metadata unit kerja, dan kontrol kuratif operator UID S2JB.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {/* Operator Info Pill */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-[#16a34a] animate-pulse" />
              <span className="text-[#0f172a] font-semibold">{session?.name || "Petugas Verifikator"}</span>
              <span className="text-[#64748b] font-mono text-[10px] uppercase">({userRole})</span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => refetchList()}
              disabled={isListFetching}
              className="min-h-[44px] h-11 px-4 rounded-xl bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs disabled:opacity-50"
              title="Segarkan Data Tabel"
            >
              <RefreshCw
                className={cn("w-4 h-4 text-[#006877]", isListFetching && "animate-spin")}
              />
              <span>Segarkan</span>
            </button>

            {/* Export Current Page Button */}
            <button
              type="button"
              onClick={() => handleExportCsv(false)}
              className="min-h-[44px] h-11 px-4 rounded-xl bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs"
              title="Ekspor ulasan pada halaman saat ini ke CSV"
            >
              <Download className="w-4 h-4 text-[#64748b]" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>

            {/* Purge All Reviews Button */}
            <button
              type="button"
              onClick={() => setIsPurgeAllModalOpen(true)}
              className="min-h-[44px] h-11 px-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] hover:bg-[#fee2e2] text-[#dc2626] hover:text-[#b91c1c] text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs"
              title="Hapus atau tolak seluruh data ulasan sekaligus"
            >
              <Trash2 className="w-4 h-4 text-[#dc2626]" />
              <span className="hidden xl:inline">Hapus Seluruh Data</span>
              <span className="inline xl:hidden">Hapus Semua</span>
            </button>

            {/* New Review Entry Link */}
            <Link
              href="/intake"
              className="min-h-[44px] h-11 px-4 rounded-xl bg-[#00a2b9] hover:bg-[#008b9e] text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs"
            >
              <FilePlus className="w-4 h-4" />
              <span>Entri Baru</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Live OCR In-Progress Banner */}
      {(listData?.kpi?.activeOcr ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f0f9ff] border border-[#00a2b9]/30 rounded-2xl shadow-xs text-[#0f172a] animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00a2b9]/10 text-[#006877] flex items-center justify-center shrink-0 border border-[#00a2b9]/20">
              <RefreshCw className="w-5 h-5 text-[#006877] animate-spin" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#0f172a] flex items-center gap-2">
                <span>Background OCR Worker & Image Proxy Sedang Berjalan</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00a2b9] text-white">
                  {listData?.kpi?.activeOcr} baris dalam pemrosesan
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] mt-0.5">
                Citra eviden beresolusi tinggi sedang diunduh dari Google Drive dan diekstraksi teksnya secara asinkron. Halaman otomatis memperbarui progress.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleFilterChange({ ocrStatus: "PROCESSING" })}
            className="text-xs font-semibold text-[#006877] hover:underline self-start sm:self-auto cursor-pointer"
          >
            Saring Baris yang Sedang Diproses &rarr;
          </button>
        </div>
      )}

      {/* KPI Ribbon */}
      <ReviewsKpiRibbon
        kpi={listData?.kpi}
        isLoading={isListLoading}
        selectedValidationStatus={filters.validationStatus}
        selectedOcrStatus={filters.ocrStatus}
        selectedDuplicateOnly={filters.isDuplicate}
        onSelectQuickFilter={handleQuickKpiFilter}
      />

      {/* Multidimensional Filter Bar */}
      <ReviewsFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        up3s={filterOptions?.up3s || []}
        ulps={filterOptions?.ulps || []}
        isSearching={isListFetching}
      />

      {/* Reviews & Triage Unified Table */}
      <ReviewsTable
        items={currentItems}
        isLoading={isListLoading}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelectOne}
        onToggleSelectAll={handleToggleSelectAll}
        isAllSelected={isAllCurrentSelected}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        totalPages={listData?.totalPages || 1}
        totalCount={listData?.totalCount || 0}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(ps) => {
          setPageSize(ps);
          setPage(1);
        }}
        onOpenDetail={handleOpenDetail}
        onRetryOcr={handleRetrySingleOcr}
        onOpenDelete={handleOpenDelete}
        isRetryingOcrId={retryingSingleId}
        activeId={activeId}
        onSelectActive={(id) => setActiveId(id)}
        onApprove={handleApprove}
        onReject={handleOpenRejectDialog}
        onOpenLightbox={(item) => setLightboxItem(item)}
      />

      {/* Lightbox Modal */}
      <EvidenceLightbox
        item={lightboxItem}
        isOpen={!!lightboxItem}
        onClose={() => setLightboxItem(null)}
        onApprove={handleApprove}
        onReject={(id) => {
          const item = currentItems.find((i) => i.id === id);
          if (item) handleOpenRejectDialog(item);
        }}
      />

      {/* Reject Reason Dialog */}
      <RejectReasonDialog
        isOpen={!!rejectDialogItem}
        reviewerName={rejectDialogItem?.playstoreReviewerName || ""}
        onClose={() => setRejectDialogItem(null)}
        onConfirm={handleConfirmReject}
      />

      {/* Slide-Over Inspection & Edit Drawer */}
      <ReviewDetailDrawer
        reviewId={selectedReviewForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedReviewForDrawer(null);
        }}
        up3s={filterOptions?.up3s || []}
        ulps={filterOptions?.ulps || []}
        onReviewUpdated={() => {
          refetchList();
        }}
      />

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        onOpenBulkReassign={() => setIsBulkReassignModalOpen(true)}
        onBulkRetryOcr={handleBulkRetryOcr}
        onBulkApprove={handleBulkApprove}
        onBulkReject={handleBulkReject}
        onBulkDelete={() => setIsBulkDeleteModalOpen(true)}
        onBulkExport={() => handleExportCsv(true)}
        isProcessing={
          bulkRetryOcrMutation.isPending ||
          bulkUpdateMutation.isPending ||
          bulkDeleteMutation.isPending
        }
      />

      {/* Bulk Unit Reassignment Modal */}
      <BulkReassignUnitModal
        isOpen={isBulkReassignModalOpen}
        onClose={() => setIsBulkReassignModalOpen(false)}
        selectedIds={selectedIds}
        up3s={filterOptions?.up3s || []}
        ulps={filterOptions?.ulps || []}
        onConfirm={handleBulkReassignConfirm}
        isSubmitting={bulkUpdateMutation.isPending}
      />

      {/* Bulk Delete Selected Reviews Modal */}
      <BulkDeleteReviewModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        selectedCount={selectedIds.length}
        userRole={userRole}
        onConfirmDelete={(data) => {
          bulkDeleteMutation.mutate({
            ids: selectedIds,
            mode: data.mode,
            reason: data.reason,
          });
        }}
        isDeleting={bulkDeleteMutation.isPending}
      />

      {/* Purge / Delete All Reviews Modal */}
      <PurgeAllReviewsModal
        isOpen={isPurgeAllModalOpen}
        onClose={() => setIsPurgeAllModalOpen(false)}
        userRole={userRole}
        totalCount={listData?.totalCount || 0}
        onConfirmPurge={(data) => {
          deleteAllMutation.mutate(data);
        }}
        isPurging={deleteAllMutation.isPending}
      />

      {/* Delete / Curative Rejection Modal */}
      <DeleteReviewModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setReviewToDelete(null);
        }}
        review={reviewToDelete}
        userRole={userRole}
        onConfirmDelete={(data) => {
          deleteMutation.mutate(data);
        }}
        isDeleting={deleteMutation.isPending}
      />

      {/* Optimistic 5-Second Undo Toast */}
      {undoState && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0f172a] text-white border border-[#334155] shadow-2xl rounded-2xl p-4 text-xs animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            {undoState.decision === "APPROVED" ? (
              <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#ef4444]" />
            )}
            <span className="text-[#f8fafc]">
              Ulasan <span className="font-semibold text-[#f59e0b] font-mono">{undoState.reviewerName}</span>{" "}
              {undoState.decision === "APPROVED" ? "disetujui" : "ditolak"}.
            </span>
          </div>

          <button
            type="button"
            onClick={handleUndo}
            className="h-8 px-3 text-xs bg-[#1e293b] hover:bg-[#334155] text-[#38bdf8] border border-[#0284c7]/40 gap-1 font-semibold rounded-lg flex items-center transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span>Batalkan ({undoSecondsLeft}s)</span>
          </button>
        </div>
      )}
    </div>
  );
}
