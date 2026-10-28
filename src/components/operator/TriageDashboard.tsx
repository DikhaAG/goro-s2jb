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
      <div className="min-h-screen flex items-center justify-center bg-[#070b13] text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (user && user.role === "PETUGAS_LAPANGAN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b13] p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-full w-14 h-14 mx-auto flex items-center justify-center text-red-400">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Akses Ditolak (403 Forbidden)</h2>
            <p className="text-xs text-slate-400 mt-1">
              Modul Dasbor Triase hanya diperuntukkan bagi Pegawai Verifikator atau Super Admin.
              Akun Anda terdaftar sebagai <span className="text-amber-400 font-mono">PETUGAS_LAPANGAN</span>.
            </p>
          </div>
          <Link href="/intake">
            <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs mt-2">
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
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Kembali ke Beranda"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-xs">
              ⚡
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide text-white">
                GORO S2JB <span className="text-cyan-400">2026</span>
              </span>
              <span className="text-xs text-slate-400 ml-2 font-mono">/ Operator Triage</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/migration">
            <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white">
              Migrasi Data
            </Button>
          </Link>
          <Link href="/intake">
            <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white">
              Input Eviden
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
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
          <div className="h-96 flex flex-col items-center justify-center space-y-3 bg-slate-900/30 border border-slate-800 rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <span className="text-xs text-slate-400">Memuat antrean ulasan...</span>
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
      </main>

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
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-3 px-4 text-xs animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            {undoState.decision === "APPROVED" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-red-400" />
            )}
            <span className="text-slate-200">
              Ulasan <span className="font-semibold text-amber-300 font-mono">{undoState.reviewerName}</span>{" "}
              {undoState.decision === "APPROVED" ? "disetujui" : "ditolak"}.
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            className="h-7 px-2.5 text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-500/40 gap-1 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo ({undoSecondsLeft}s)</span>
          </Button>
        </div>
      )}
    </div>
  );
}
