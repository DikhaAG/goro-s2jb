"use client";

import { useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { downloadCsv } from "@/lib/client/csvDownload";
import { AlertCircle, CheckCircle2 } from "lucide-react";
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
import { ReviewsHeader } from "./ReviewsHeader";
import { OcrProgressBanner } from "./OcrProgressBanner";
import { useTriageHotkeys } from "@/hooks/useTriageHotkeys";
import { forRole } from "@/lib/routeAuthorization";
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
    { isModalOpen: !!lightboxItem || !!rejectDialogItem || !!duplicateSplitViewItem }
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
      <ReviewsHeader
        operatorName={currentSession?.name}
        userRole={userRole}
        canCreateEntry={forRole(currentSession?.role).canVisit("/intake")}
        isRefreshing={isListFetching}
        onRefresh={() => refetchList()}
        onExportPage={() => handleExportCsv(false)}
        onPurgeAll={() => setIsPurgeAllModalOpen(true)}
      />

      {/* Operator Background Pipeline & AI Health Status Bar */}
      <OperatorPipelineStatusBar />

      <OcrProgressBanner
        activeCount={listData?.kpi?.activeOcr ?? 0}
        onShowProcessing={() => handleFilterChange({ ocrStatus: "PROCESSING" })}
      />

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
