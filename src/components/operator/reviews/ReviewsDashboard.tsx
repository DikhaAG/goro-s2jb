"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/client/csvDownload";
import {
  FolderKanban,
  FilePlus,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Zap,
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
import { DuplicateSplitViewModal } from "./DuplicateSplitViewModal";
import { EvidenceLightbox } from "@/components/operator/EvidenceLightbox";
import { RejectReasonDialog } from "@/components/operator/RejectReasonDialog";
import { OperatorPipelineStatusBar } from "./OperatorPipelineStatusBar";
import { useTriageHotkeys } from "@/hooks/useTriageHotkeys";
import { SessionUser } from "@/types";
import {
  CLEARED_FILTERS,
  isReviewPageSize,
  isReviewSortColumn,
  reviewsSearchParams,
} from "./reviewsSearchParams";

type TriageDecision = "APPROVED" | "REJECTED";

const UNDO_WINDOW_MS = 5000;

const CSV_HEADERS = [
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

function toastError(fallback: string) {
  return (err: { message: string }) => {
    toast.error(err.message || fallback);
  };
}

export interface ReviewsDashboardProps {
  initialSession?: SessionUser | null;
}

export function ReviewsDashboard({ initialSession }: ReviewsDashboardProps = {}) {
  // Session to check user role with initial SSR session fallback
  const { data: session } = trpc.auth.getSession.useQuery(undefined, {
    initialData: initialSession || undefined,
  });
  const currentSession = session || initialSession;
  const userRole = currentSession?.role || "PEGAWAI";

  // Filters, paging and sort live in the URL, so a refresh or a shared link keeps them.
  const [params, setParams] = useQueryStates(reviewsSearchParams);
  const { page, pageSize, sortBy, sortOrder, isDuplicate, ...filterParams } = params;
  const filters: FilterState = { ...filterParams, isDuplicate: isDuplicate ?? undefined };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Triage Active Row & Modals State
  const [chosenActiveId, setActiveId] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<ReviewItem | null>(null);
  const [rejectDialogItem, setRejectDialogItem] = useState<ReviewItem | null>(null);
  const [duplicateSplitViewItem, setDuplicateSplitViewItem] = useState<ReviewItem | null>(null);

  // Drawer & Modals State (a drawer or modal is open while its review is set)
  const [drawerReviewId, setDrawerReviewId] = useState<string | null>(null);
  const [reviewToDelete, setReviewToDelete] = useState<{ id: string; playstoreReviewerName: string } | null>(null);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isPurgeAllModalOpen, setIsPurgeAllModalOpen] = useState(false);

  const [isBulkReassignModalOpen, setIsBulkReassignModalOpen] = useState(false);

  // Queries
  const { data: filterOptions } = trpc.reviews.getFilterOptions.useQuery();

  const listQueryInput = {
    page,
    pageSize,
    sortBy,
    sortOrder,
    search: filters.search.trim() || undefined,
    validationStatus: filters.validationStatus,
    ocrStatus: filters.ocrStatus,
    validationZone: filters.validationZone,
    up3Id: filters.up3Id || undefined,
    ulpId: filters.ulpId || undefined,
    isDuplicate: filters.isDuplicate,
  };

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

  // Falls back to the first row when the chosen row is no longer on this page.
  const activeItem =
    currentItems.find((i) => i.id === chosenActiveId) ?? currentItems[0] ?? null;
  const activeId = activeItem?.id ?? null;

  const activateNeighbor = (fromId: string | null, step: 1 | -1) => {
    const neighbor = currentItems[currentItems.findIndex((i) => i.id === fromId) + step];
    if (neighbor) setActiveId(neighbor.id);
  };

  const isDialogOpen =
    !!rejectDialogItem ||
    !!duplicateSplitViewItem ||
    !!drawerReviewId ||
    !!reviewToDelete ||
    isBulkDeleteModalOpen ||
    isPurgeAllModalOpen ||
    isBulkReassignModalOpen;
  const isOverlayOpen = isDialogOpen || !!lightboxItem;

  // Mutations
  const utils = trpc.useUtils();
  const refreshReviews = () => utils.reviews.invalidate();

  const submitDecisionMutation = trpc.reviews.submitDecision.useMutation({
    onSuccess: refreshReviews,
    onError: toastError("Gagal memperbarui status verifikasi."),
  });

  const undoDecisionMutation = trpc.reviews.undoDecision.useMutation({
    onSuccess: () => {
      toast.success("Keputusan verifikasi berhasil dibatalkan.");
      return refreshReviews();
    },
    onError: toastError("Gagal membatalkan keputusan verifikasi."),
  });

  const retryOcrMutation = trpc.reviews.retryOcr.useMutation({
    onSuccess: () => {
      toast.success("Pekerjaan OCR berhasil di-enqueue ulang ke worker.");
      return refreshReviews();
    },
    onError: toastError("Gagal memicu ulang OCR."),
  });
  const retryingSingleId = retryOcrMutation.isPending
    ? (retryOcrMutation.variables?.reviewId ?? null)
    : null;

  const bulkRetryOcrMutation = trpc.reviews.bulkRetryOcr.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.count} pekerjaan OCR berhasil dimasukkan ke antrean.`);
      setSelectedIds([]);
      return refreshReviews();
    },
    onError: toastError("Gagal memicu ulang OCR massal."),
  });

  const bulkUpdateMutation = trpc.reviews.bulkUpdate.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.count} baris data ulasan berhasil diperbarui.`);
      setSelectedIds([]);
      setIsBulkReassignModalOpen(false);
      return refreshReviews();
    },
    onError: toastError("Gagal memperbarui ulasan massal."),
  });

  const deleteMutation = trpc.reviews.delete.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.mode === "PERMANENT"
          ? "Ulasan berhasil dihapus secara permanen dari basis data."
          : "Ulasan berhasil ditandai REJECTED (kuratif)."
      );
      setReviewToDelete(null);
      return refreshReviews();
    },
    onError: toastError("Gagal melakukan tindakan kuratif."),
  });

  const bulkDeleteMutation = trpc.reviews.bulkDelete.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.mode === "PERMANENT"
          ? `${res.count} baris ulasan berhasil dihapus secara permanen.`
          : `${res.count} baris ulasan berhasil ditandai REJECTED (kuratif massal).`
      );
      setIsBulkDeleteModalOpen(false);
      setSelectedIds([]);
      return refreshReviews();
    },
    onError: toastError("Gagal melakukan tindakan kuratif massal."),
  });

  const deleteAllMutation = trpc.reviews.deleteAll.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.mode === "PERMANENT"
          ? `Seluruh data ulasan (${res.count} baris) berhasil dihapus permanen.`
          : `Seluruh data ulasan (${res.count} baris) berhasil ditandai REJECTED.`
      );
      setIsPurgeAllModalOpen(false);
      setSelectedIds([]);
      return refreshReviews();
    },
    onError: toastError("Gagal melakukan tindakan pada seluruh data ulasan."),
  });

  // The decision is saved right away; the toast only offers a short window to revert it.
  const showUndoToast = (item: ReviewItem, decision: TriageDecision) => {
    const approved = decision === "APPROVED";
    toast(
      <span className="font-normal">
        Ulasan <span className="font-semibold text-[#f59e0b] font-mono">{item.playstoreReviewerName}</span>{" "}
        {approved ? "disetujui" : "ditolak"}.
      </span>,
      {
        duration: UNDO_WINDOW_MS,
        icon: approved ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-400" aria-hidden />
        ),
        action: {
          label: "Batalkan",
          onClick: () =>
            undoDecisionMutation.mutate({
              reviewId: item.id,
              previousStatus: item.validationStatus,
            }),
        },
      }
    );
  };

  // Triage Quick Action Handlers
  const submitDecision = (item: ReviewItem, decision: TriageDecision, remarks?: string) => {
    activateNeighbor(item.id, 1);
    showUndoToast(item, decision);
    submitDecisionMutation.mutate({ reviewId: item.id, decision, remarks });
  };

  const handleApprove = (id: string) => {
    const item = currentItems.find((i) => i.id === id);
    if (item) submitDecision(item, "APPROVED");
  };

  const handleConfirmReject = (reason: string) => {
    if (!rejectDialogItem) return;
    setRejectDialogItem(null);
    submitDecision(rejectDialogItem, "REJECTED", reason);
  };

  // Keyboard Navigation Hotkeys
  useTriageHotkeys(
    {
      onApprove: () => {
        if (activeId && !isOverlayOpen) handleApprove(activeId);
      },
      onReject: () => {
        if (activeItem && !isOverlayOpen) setRejectDialogItem(activeItem);
      },
      onNext: () => {
        if (!isOverlayOpen) activateNeighbor(activeId, 1);
      },
      onPrevious: () => {
        if (!isOverlayOpen) activateNeighbor(activeId, -1);
      },
      onToggleLightbox: () => {
        if (isDialogOpen) return;
        setLightboxItem(lightboxItem ? null : activeItem);
      },
      onCloseModal: () => {
        setLightboxItem(null);
        setRejectDialogItem(null);
        setDuplicateSplitViewItem(null);
      },
    },
    {
      enabled: true,
      isModalOpen: !!lightboxItem || !!rejectDialogItem || !!duplicateSplitViewItem,
    }
  );

  // Filter Handlers
  const handleFilterChange = (updates: Partial<FilterState>) => {
    const { isDuplicate: duplicateUpdate, ...rest } = updates;
    setParams({
      ...rest,
      // An undefined duplicate flag means "no filter", which nuqs spells as null.
      ...("isDuplicate" in updates && { isDuplicate: duplicateUpdate ?? null }),
      page: null,
    });
    setSelectedIds([]);
  };

  const handleResetFilters = () => {
    setParams(CLEARED_FILTERS);
    setSelectedIds([]);
  };

  // Sort Handler
  const handleSortChange = (column: string) => {
    if (!isReviewSortColumn(column)) return;
    setParams({
      sortBy: column,
      sortOrder: sortBy === column && sortOrder === "desc" ? "asc" : "desc",
      page: null,
    });
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
  const handleOpenDetail = (review: ReviewItem) => setDrawerReviewId(review.id);

  const handleOpenDelete = (review: ReviewItem) => {
    setReviewToDelete({
      id: review.id,
      playstoreReviewerName: review.playstoreReviewerName,
    });
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
    const records = onlySelected
      ? currentItems.filter((i) => selectedIds.includes(i.id))
      : currentItems;

    if (records.length === 0) {
      toast.error("Tidak ada baris data untuk diekspor.");
      return;
    }

    const dateStr = new Date().toISOString().split("T")[0];
    downloadCsv(`ulasan_export_${dateStr}.csv`, [
      CSV_HEADERS,
      ...records.map((item) => [
        item.id,
        item.playstoreReviewerName,
        item.originalReviewerName,
        item.up3?.name,
        item.ulp?.name,
        new Date(item.entryDate).toISOString(),
        item.confidenceScore !== null ? item.confidenceScore.toFixed(1) : "-",
        item.ocrStatus,
        item.validationStatus,
        item.isDuplicate ? "YA" : "TIDAK",
        item.reviewRemarks || item.fieldNotes,
      ]),
    ]);

    toast.success(`${records.length} baris ulasan berhasil diekspor ke CSV.`);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Top Header Banner */}
      <div className="rounded-2xl p-5 sm:p-6 lg:p-8 bg-white border border-[#e2e8f0] shadow-xs relative overflow-hidden">
        <div className="flex flex-col 2xl:flex-row 2xl:items-start justify-between gap-5">
          <div className="min-w-0 flex-1 space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral" className="gap-1 font-semibold whitespace-nowrap shrink-0">
                <Zap className="w-3.5 h-3.5 text-[#006877]" />
                <span>PLN UID S2JB</span>
              </Badge>
              <span className="text-xs text-[#64748b]">
                Sistem Validasi Eviden Rating PLN Mobile 2026
              </span>
              <span className="bg-[#00A3E0]/10 text-[#006877] border border-[#00A3E0]/25 text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap shrink-0">
                Human-in-the-Loop &amp; Triase
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a] flex items-start sm:items-center gap-2.5">
              <FolderKanban className="w-6 h-6 text-[#00A3E0] shrink-0 mt-0.5 sm:mt-0" />
              <span>Pusat Triase &amp; Kelola Data Ulasan</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed">
              Verifikasi cepat dengan hotkey taktis [A]/[R], inspeksi citra resolusi tinggi Lightbox [Spasi], koreksi metadata unit kerja, dan kontrol kuratif operator UID S2JB.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full 2xl:w-auto 2xl:max-w-xl 2xl:justify-end min-w-0">
            {/* Operator Info Pill */}
            <div className="flex items-center gap-2 px-3.5 min-h-[44px] py-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs max-w-full min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-[#16a34a] shrink-0 animate-pulse" />
              <span className="text-[#0f172a] font-semibold truncate" suppressHydrationWarning>
                {currentSession?.name || "Petugas Verifikator"}
              </span>
              <span className="text-[#64748b] font-mono text-xs uppercase shrink-0" suppressHydrationWarning>
                ({userRole})
              </span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => refetchList()}
              disabled={isListFetching}
              className="min-h-[44px] h-11 px-4 rounded-xl bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs disabled:opacity-50 shrink-0"
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
              className="min-h-[44px] h-11 px-4 rounded-xl bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs shrink-0"
              title="Ekspor ulasan pada halaman saat ini ke CSV"
            >
              <Download className="w-4 h-4 text-[#64748b]" />
              <span>Ekspor CSV</span>
            </button>

            {/* Purge All Reviews Button */}
            <button
              type="button"
              onClick={() => setIsPurgeAllModalOpen(true)}
              className="min-h-[44px] h-11 px-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] hover:bg-[#fee2e2] text-[#dc2626] hover:text-[#b91c1c] text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs shrink-0"
              title="Hapus atau tolak seluruh data ulasan sekaligus"
            >
              <Trash2 className="w-4 h-4 text-[#dc2626]" />
              <span className="hidden xl:inline">Hapus Seluruh Data</span>
              <span className="inline xl:hidden">Hapus Semua</span>
            </button>

            {/* New Review Entry Link */}
            <Link
              href="/intake"
              className="min-h-[44px] h-11 px-4 rounded-xl bg-[#00a2b9] hover:bg-[#008b9e] text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs shrink-0"
            >
              <FilePlus className="w-4 h-4" />
              <span>Entri Baru</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Operator Background Pipeline & AI Health Status Bar */}
      <OperatorPipelineStatusBar />

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
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#00a2b9] text-white">
                  {listData?.kpi?.activeOcr} baris dalam pemrosesan
                </span>
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
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
        onSelectQuickFilter={handleFilterChange}
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
        onPageChange={(p) => setParams({ page: p })}
        onPageSizeChange={(ps) => {
          if (isReviewPageSize(ps)) setParams({ pageSize: ps, page: null });
        }}
        onOpenDetail={handleOpenDetail}
        onRetryOcr={(reviewId) => retryOcrMutation.mutate({ reviewId })}
        onOpenDelete={handleOpenDelete}
        onOpenDuplicateSplitView={(item) => setDuplicateSplitViewItem(item)}
        isRetryingOcrId={retryingSingleId}
        activeId={activeId}
        onSelectActive={(id) => setActiveId(id)}
        onApprove={handleApprove}
        onReject={setRejectDialogItem}
        onOpenLightbox={(item) => setLightboxItem(item)}
      />

      {/* Duplicate Split View Comparison Modal */}
      <DuplicateSplitViewModal
        isOpen={!!duplicateSplitViewItem}
        duplicateReview={duplicateSplitViewItem}
        onClose={() => setDuplicateSplitViewItem(null)}
        onOpenFullDetail={(item) => {
          setDuplicateSplitViewItem(null);
          handleOpenDetail(item);
        }}
        onActionComplete={() => {
          toast.success("Tindakan verifikasi pada ulasan duplikat berhasil diproses.");
          refreshReviews();
        }}
      />

      {/* Lightbox Modal */}
      <EvidenceLightbox
        item={lightboxItem}
        isOpen={!!lightboxItem}
        onClose={() => setLightboxItem(null)}
        onApprove={handleApprove}
        onReject={(id) => {
          const item = currentItems.find((i) => i.id === id);
          if (item) setRejectDialogItem(item);
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
        reviewId={drawerReviewId}
        isOpen={!!drawerReviewId}
        onClose={() => setDrawerReviewId(null)}
        up3s={filterOptions?.up3s || []}
        ulps={filterOptions?.ulps || []}
        onReviewUpdated={() => {
          refreshReviews();
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
        isOpen={!!reviewToDelete}
        onClose={() => setReviewToDelete(null)}
        review={reviewToDelete}
        userRole={userRole}
        onConfirmDelete={(data) => {
          deleteMutation.mutate(data);
        }}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
