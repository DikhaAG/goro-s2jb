"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";

export interface MigrationBatchData {
  id: string;
  fileName: string;
  fileSize: number;
  filePath: string | null;
  targetType: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PAUSED";
  totalRows: number;
  processedRows: number;
  failedRows: number;
  lastProcessedRow: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  errorMessage: string | null;
  errors?: Array<{
    id: string;
    rowNumber: number;
    rawRowData: string;
    errorReason: string;
    createdAt: Date | string;
  }>;
}

interface MigrationGuardContextType {
  isMigrationActive: boolean;
  hasInterruptedBatch: boolean;
  activeBatch: MigrationBatchData | null;
  progressPercentage: number;
  throughput: number; // rows per second
  resumeBatch: (batchId: string) => Promise<void>;
  pauseBatch: (batchId: string) => Promise<void>;
  cancelBatch: (batchId: string) => Promise<void>;
  refetchStatus: () => Promise<void>;
  isActionLoading: boolean;
}

const MigrationGuardContext = createContext<MigrationGuardContextType>({
  isMigrationActive: false,
  hasInterruptedBatch: false,
  activeBatch: null,
  progressPercentage: 0,
  throughput: 0,
  resumeBatch: async () => {},
  pauseBatch: async () => {},
  cancelBatch: async () => {},
  refetchStatus: async () => {},
  isActionLoading: false,
});

export function MigrationGuardProvider({ children }: { children: React.ReactNode }) {
  const sessionQuery = trpc.auth.getSession.useQuery(undefined, {
    staleTime: 30000,
  });
  const user = sessionQuery.data;
  const isOperatorOrAdmin = user?.role === "PEGAWAI" || user?.role === "SUPER_ADMIN";

  const [throughput, setThroughput] = useState(0);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const lastMetricsRef = useRef<{ processed: number; timestamp: number } | null>(null);

  // Poll active or interrupted batch if operator/admin
  const batchQuery = trpc.migration.getActiveOrInterruptedBatch.useQuery(undefined, {
    enabled: Boolean(isOperatorOrAdmin),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "PROCESSING" || status === "PENDING") {
        return 1500;
      }
      return 8000;
    },
  });

  const resumeMutation = trpc.migration.resumeMigration.useMutation();
  const pauseMutation = trpc.migration.pauseMigration.useMutation();
  const cancelMutation = trpc.migration.cancelBatch.useMutation();

  const activeBatch = (batchQuery.data as unknown as MigrationBatchData) || null;

  const isMigrationActive =
    activeBatch?.status === "PROCESSING" || activeBatch?.status === "PENDING";
  const hasInterruptedBatch = activeBatch?.status === "PAUSED";

  // Calculate Throughput (rows/sec)
  useEffect(() => {
    if (!activeBatch || !isMigrationActive) {
      setThroughput(0);
      lastMetricsRef.current = null;
      return;
    }

    const now = Date.now();
    const currentProcessed = activeBatch.processedRows;

    if (lastMetricsRef.current) {
      const deltaRows = currentProcessed - lastMetricsRef.current.processed;
      const deltaTimeSec = (now - lastMetricsRef.current.timestamp) / 1000;

      if (deltaTimeSec >= 1 && deltaRows >= 0) {
        const speed = Math.round(deltaRows / deltaTimeSec);
        setThroughput(speed);
        lastMetricsRef.current = { processed: currentProcessed, timestamp: now };
      }
    } else {
      lastMetricsRef.current = { processed: currentProcessed, timestamp: now };
    }
  }, [activeBatch, isMigrationActive]);

  // Protect against accidental tab close / navigation
  useEffect(() => {
    if (!isMigrationActive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      const warningMessage =
        "Proses migrasi sedang berlangsung. Jika Anda keluar atau menutup halaman ini, proses migrasi dapat terhenti.";
      e.returnValue = warningMessage;
      return warningMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isMigrationActive]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (!activeBatch) return 0;
    if (activeBatch.totalRows && activeBatch.totalRows > 0) {
      return Math.min(100, Math.round((activeBatch.processedRows / activeBatch.totalRows) * 100));
    }
    return 0; // Indeterminate or streaming mode
  }, [activeBatch]);

  const resumeBatch = async (batchId: string) => {
    setIsActionLoading(true);
    try {
      await resumeMutation.mutateAsync({ batchId });
      await batchQuery.refetch();
    } finally {
      setIsActionLoading(false);
    }
  };

  const pauseBatch = async (batchId: string) => {
    setIsActionLoading(true);
    try {
      await pauseMutation.mutateAsync({ batchId });
      await batchQuery.refetch();
    } finally {
      setIsActionLoading(false);
    }
  };

  const cancelBatch = async (batchId: string) => {
    setIsActionLoading(true);
    try {
      await cancelMutation.mutateAsync({ batchId });
      await batchQuery.refetch();
    } finally {
      setIsActionLoading(false);
    }
  };

  const refetchStatus = async () => {
    await batchQuery.refetch();
  };

  return (
    <MigrationGuardContext.Provider
      value={{
        isMigrationActive,
        hasInterruptedBatch,
        activeBatch,
        progressPercentage,
        throughput,
        resumeBatch,
        pauseBatch,
        cancelBatch,
        refetchStatus,
        isActionLoading,
      }}
    >
      {children}
    </MigrationGuardContext.Provider>
  );
}

export function useMigrationGuard() {
  const context = useContext(MigrationGuardContext);
  if (!context) {
    throw new Error("useMigrationGuard must be used within a MigrationGuardProvider");
  }
  return context;
}
