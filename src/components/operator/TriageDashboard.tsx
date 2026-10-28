"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { TriageHeader } from "./TriageHeader";
import { TriageFilterBar, TriageFilters } from "./TriageFilterBar";
import { TriageTable } from "./TriageTable";
import { EvidenceLightbox } from "./EvidenceLightbox";
import { RejectReasonDialog } from "./RejectReasonDialog";
import { useTriageHotkeys } from "@/hooks/useTriageHotkeys";
import { TriageRowData } from "./TriageRow";
import {
  ArrowLeft,
  ShieldAlert,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertOctagon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface UndoState {
  reviewId: string;
  reviewerName: string;
  decision: "APPROVED" | "REJECTED";
  item: TriageRowData;
  expiresAt: number;
}

export function TriageDashboard() {
  // 1. Session & Auth Check
  const sessionQuery = trpc.auth.getSession.useQuery();
  const user = sessionQuery.data;

  // 2. Filters State
  const [filters, setFilters] = useState<TriageFilters>({
    tab: "NEEDS_REVIEW",
  });

  // 3. Master Data
  const unitsQuery = trpc.master.getUnits.useQuery();

  const up3List = useMemo(() => {
    return unitsQuery.data?.map((u) => ({ id: u.id, name: u.name })) || [];
  }, [unitsQuery.data]);

  const ulpList = useMemo(() => {
    return (
      unitsQuery.data?.flatMap((u) =>
        u.ulps.map((ulp) => ({ id: ulp.id, name: ulp.name, up3Id: u.id }))
      ) || []
    );
  }, [unitsQuery.data]);

  // 4. Triage Query Parameters
  const queryParams = useMemo(() => {
    return {
      up3Id: filters.up3Id,
      ulpId: filters.ulpId,
      status:
        filters.tab === "ALL"
          ? ("ALL" as const)
          : ("NEEDS_REVIEW" as const),
      isDuplicateOnly: filters.tab === "DUPLICATES",
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: 100,
    };
  }, [filters]);

  const queueQuery = trpc.triage.getQueue.useQuery(queryParams, {
    enabled: !!user && (user.role === "PEGAWAI" || user.role === "SUPER_ADMIN"),
    refetchOnWindowFocus: false,
  });

  // Local optimistic state for items
  const [items, setItems] = useState<TriageRowData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync server data to local items list
  useEffect(() => {
    if (queueQuery.data?.items) {
      const serverItems = queueQuery.data.items as unknown as TriageRowData[];
      setItems(serverItems);
      if (serverItems.length > 0 && !activeId) {
        setActiveId(serverItems[0].id);
      }
    }
  }, [queueQuery.data?.items]);

  // Ensure activeId remains valid when items change
  useEffect(() => {
    if (items.length > 0) {
      if (!activeId || !items.some((i) => i.id === activeId)) {
        setActiveId(items[0].id);
      }
    } else {
      setActiveId(null);
    }
  }, [items, activeId]);

  // Active item object
  const activeItem = useMemo(() => {
    return items.find((i) => i.id === activeId) || null;
  }, [items, activeId]);

  // Modal states
  const [lightboxItem, setLightboxItem] = useState<TriageRowData | null>(null);
  const [rejectDialogItem, setRejectDialogItem] = useState<TriageRowData | null>(null);

  // Undo notification state
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(5);

  // Mutations
  const submitDecisionMutation = trpc.triage.submitDecision.useMutation();
  const undoDecisionMutation = trpc.triage.undoDecision.useMutation();

  // Undo timer countdown
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

  // Handlers for Decisions
  const handleApprove = (id: string) => {
    const targetItem = items.find((i) => i.id === id);
    if (!targetItem) return;

    // Optimistically remove from list
    const currentIndex = items.findIndex((i) => i.id === id);
    const nextIndex = currentIndex < items.length - 1 ? currentIndex : currentIndex - 1;
    const nextActiveId = nextIndex >= 0 && items[nextIndex] ? items[nextIndex].id : null;

    setItems((prev) => prev.filter((i) => i.id !== id));
    setActiveId(nextActiveId);

    // Set 5-second undo toast
    setUndoState({
      reviewId: id,
      reviewerName: targetItem.playstoreReviewerName,
      decision: "APPROVED",
      item: targetItem,
      expiresAt: Date.now() + 5000,
    });
    setUndoSecondsLeft(5);

    // Trigger background mutation
    submitDecisionMutation.mutate({
      reviewId: id,
      decision: "APPROVED",
    });
  };

  const handleOpenRejectDialog = (item: TriageRowData) => {
    setRejectDialogItem(item);
  };

  const handleConfirmReject = (reason: string) => {
    if (!rejectDialogItem) return;

    const id = rejectDialogItem.id;
    const targetItem = rejectDialogItem;

    setRejectDialogItem(null);

    // Optimistically remove from list
    const currentIndex = items.findIndex((i) => i.id === id);
    const nextIndex = currentIndex < items.length - 1 ? currentIndex : currentIndex - 1;
    const nextActiveId = nextIndex >= 0 && items[nextIndex] ? items[nextIndex].id : null;

    setItems((prev) => prev.filter((i) => i.id !== id));
    setActiveId(nextActiveId);

    // Set 5-second undo toast
    setUndoState({
      reviewId: id,
      reviewerName: targetItem.playstoreReviewerName,
      decision: "REJECTED",
      item: targetItem,
      expiresAt: Date.now() + 5000,
    });
    setUndoSecondsLeft(5);

    // Trigger background mutation
    submitDecisionMutation.mutate({
      reviewId: id,
      decision: "REJECTED",
      remarks: reason,
    });
  };

  const handleUndo = () => {
    if (!undoState) return;

    const restoredItem = undoState.item;
    const reviewId = undoState.reviewId;

    // Cancel undo state
    setUndoState(null);

    // Restore item to list
    setItems((prev) => [restoredItem, ...prev]);
    setActiveId(reviewId);

    // Trigger background undo mutation
    undoDecisionMutation.mutate({
      reviewId,
      previousStatus: "NEEDS_REVIEW",
    });
  };

  // Keyboard navigation hook
  useTriageHotkeys(
    {
      onApprove: () => {
        if (activeId && !lightboxItem && !rejectDialogItem) {
          handleApprove(activeId);
        }
      },
      onReject: () => {
        if (activeItem && !lightboxItem && !rejectDialogItem) {
          handleOpenRejectDialog(activeItem);
        }
      },
      onNext: () => {
        if (!lightboxItem && !rejectDialogItem && items.length > 0) {
          const currentIndex = items.findIndex((i) => i.id === activeId);
          if (currentIndex < items.length - 1) {
            setActiveId(items[currentIndex + 1].id);
          }
        }
      },
      onPrevious: () => {
        if (!lightboxItem && !rejectDialogItem && items.length > 0) {
          const currentIndex = items.findIndex((i) => i.id === activeId);
          if (currentIndex > 0) {
            setActiveId(items[currentIndex - 1].id);
          }
        }
      },
      onToggleLightbox: () => {
        if (rejectDialogItem) return;
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

  // RBAC Access Control Guard
  if (sessionQuery.isLoading) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center text-[#64748b]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00a2b9]" />
      </div>
    );
  }

  if (user && user.role === "PETUGAS_LAPANGAN") {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#fed7aa] rounded-2xl p-6 text-center space-y-4 shadow-xs">
          <div className="p-3 bg-[#fff7ed] border border-[#fed7aa] rounded-full w-14 h-14 mx-auto flex items-center justify-center text-[#b45309]">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Akses Ditolak (403 Forbidden)</h2>
            <p className="text-xs text-[#64748b] mt-1">
              Modul Dasbor Triase hanya diperuntukkan bagi Pegawai Verifikator atau Super Admin.
              Akun Anda terdaftar sebagai <span className="text-[#b45309] font-mono font-semibold">PETUGAS_LAPANGAN</span>.
            </p>
          </div>
          <Link href="/intake">
            <Button className="w-full bg-[#00a2b9] hover:bg-[#008b9e] text-white text-xs mt-2 min-h-[44px] h-11 font-semibold rounded-xl">
              Beralih ke Formulir Input Lapangan
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const metrics = queueQuery.data?.metrics || {
    yellowQueueCount: 0,
    verifiedTodayCount: 0,
    aiAutomationRate: 0,
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Header & Tactical Metric Cards */}
      <TriageHeader
        operatorName={user?.name || "Petugas Verifikator"}
        operatorRole={user?.role || "PEGAWAI"}
        metrics={metrics}
      />

      {/* Filter Controls & Tabs */}
      <TriageFilterBar
        filters={filters}
        onFilterChange={setFilters}
        yellowCount={metrics.yellowQueueCount}
        up3List={up3List}
        ulpList={ulpList}
      />

      {/* Virtualized Triage Table */}
      {queueQuery.isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center space-y-3 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-[#00a2b9]" />
          <span className="text-xs text-[#64748b]">Memuat antrean ulasan...</span>
        </div>
      ) : (
        <TriageTable
          items={items}
          activeId={activeId}
          onSelect={setActiveId}
          onOpenLightbox={(item) => setLightboxItem(item)}
          onApprove={handleApprove}
          onReject={handleOpenRejectDialog}
        />
      )}

      {/* Lightbox Modal */}
      <EvidenceLightbox
        item={lightboxItem}
        isOpen={!!lightboxItem}
        onClose={() => setLightboxItem(null)}
        onApprove={handleApprove}
        onReject={(id) => {
          const item = items.find((i) => i.id === id);
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

      {/* Optimistic 5-Second Undo Toast */}
      {undoState && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0f172a] text-white border border-[#334155] shadow-2xl rounded-2xl p-4 text-xs animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            {undoState.decision === "APPROVED" ? (
              <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-[#ef4444]" />
            )}
            <span className="text-[#f8fafc]">
              Ulasan <span className="font-semibold text-[#f59e0b] font-mono">{undoState.reviewerName}</span>{" "}
              {undoState.decision === "APPROVED" ? "disetujui" : "ditolak"}.
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            className="h-8 px-3 text-xs bg-[#1e293b] hover:bg-[#334155] text-[#38bdf8] border-[#0284c7]/40 gap-1 font-semibold rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo ({undoSecondsLeft}s)</span>
          </Button>
        </div>
      )}
    </div>
  );
}
