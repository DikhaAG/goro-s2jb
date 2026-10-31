"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  Layers,
  Terminal,
  History,
  HardDrive,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMigrationGuard } from "@/context/MigrationGuardContext";
import { BatchProgressCard } from "@/components/migration/BatchProgressCard";
import { BatchMonitorTable } from "@/components/migration/BatchMonitorTable";
import { WorkerDetailInspector } from "@/components/migration/WorkerDetailInspector";
import { QueueJobsManager } from "@/components/migration/QueueJobsManager";
import { SystemDiagnosticsCard } from "@/components/migration/SystemDiagnosticsCard";

export default function MigrationMonitorPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "jobs" | "history" | "telemetry">(
    "overview"
  );

  // Batch History State
  const [batchPage, setBatchPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Queue Jobs State
  const [selectedQueue, setSelectedQueue] = useState<"import" | "ocr">("import");
  const [jobStatus, setJobStatus] = useState<
    "active" | "waiting" | "failed" | "completed" | "delayed"
  >("active");
  const [jobPage, setJobPage] = useState(1);

  // Notification feedback
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );

  const showFeedback = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const {
    activeBatch,
    throughput,
    cancelBatch,
    resumeBatch,
    isActionLoading,
    refetchStatus,
  } = useMigrationGuard();

  // 1. Detailed Worker & Queues Status Query
  const detailedWorkerQuery = trpc.migration.getDetailedWorkerStatus.useQuery(undefined, {
    refetchInterval: activeBatch ? 2000 : 6000,
  });

  // 2. Monitor Batches Query (RBAC)
  const monitorQuery = trpc.migration.getMonitorBatches.useQuery(
    {
      page: batchPage,
      pageSize: 10,
      status: statusFilter as any,
    },
    {
      refetchInterval: activeBatch ? 2500 : 8000,
    }
  );

  // 3. Queue Jobs Query
  const queueJobsQuery = trpc.migration.getQueueJobs.useQuery(
    {
      queueName: selectedQueue,
      status: jobStatus,
      page: jobPage,
      pageSize: 10,
    },
    {
      enabled: activeTab === "jobs",
      refetchInterval: 3000,
    }
  );

  // Mutations
  const pauseQueueMutation = trpc.migration.pauseQueue.useMutation();
  const resumeQueueMutation = trpc.migration.resumeQueue.useMutation();
  const retryJobMutation = trpc.migration.retryJob.useMutation();
  const removeJobMutation = trpc.migration.removeJob.useMutation();
  const retryAllFailedMutation = trpc.migration.retryAllFailedJobs.useMutation();
  const cleanQueueMutation = trpc.migration.cleanQueue.useMutation();

  const isSuperAdmin = detailedWorkerQuery.data?.isSuperAdmin || false;

  const handlePauseQueue = async (queueName: "import" | "ocr") => {
    try {
      const res = await pauseQueueMutation.mutateAsync({ queueName });
      showFeedback(res.message);
      await detailedWorkerQuery.refetch();
    } catch (err: any) {
      showFeedback(err.message || "Gagal menjeda antrean", "error");
    }
  };

  const handleResumeQueue = async (queueName: "import" | "ocr") => {
    try {
      const res = await resumeQueueMutation.mutateAsync({ queueName });
      showFeedback(res.message);
      await detailedWorkerQuery.refetch();
    } catch (err: any) {
      showFeedback(err.message || "Gagal melanjutkan antrean", "error");
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await retryJobMutation.mutateAsync({ queueName: selectedQueue, jobId });
      showFeedback(res.message);
      await Promise.all([queueJobsQuery.refetch(), detailedWorkerQuery.refetch()]);
    } catch (err: any) {
      showFeedback(err.message || "Gagal mencoba ulang job", "error");
    }
  };

  const handleRemoveJob = async (jobId: string) => {
    try {
      const res = await removeJobMutation.mutateAsync({ queueName: selectedQueue, jobId });
      showFeedback(res.message);
      await Promise.all([queueJobsQuery.refetch(), detailedWorkerQuery.refetch()]);
    } catch (err: any) {
      showFeedback(err.message || "Gagal menghapus job", "error");
    }
  };

  const handleRetryAllFailed = async () => {
    try {
      const res = await retryAllFailedMutation.mutateAsync({ queueName: selectedQueue });
      showFeedback(res.message);
      await Promise.all([queueJobsQuery.refetch(), detailedWorkerQuery.refetch()]);
    } catch (err: any) {
      showFeedback(err.message || "Gagal mencoba ulang seluruh job gagal", "error");
    }
  };

  const handleCleanQueue = async (type: "failed" | "completed") => {
    try {
      const res = await cleanQueueMutation.mutateAsync({ queueName: selectedQueue, type });
      showFeedback(res.message);
      await Promise.all([queueJobsQuery.refetch(), detailedWorkerQuery.refetch()]);
    } catch (err: any) {
      showFeedback(err.message || "Gagal membersihkan antrean", "error");
    }
  };

  const handleCancelBatch = async (batchId: string) => {
    await cancelBatch(batchId);
    showFeedback("Batch migrasi berhasil dihentikan.");
    await Promise.all([monitorQuery.refetch(), detailedWorkerQuery.refetch()]);
  };

  const handleResumeBatch = async (batchId: string) => {
    await resumeBatch(batchId);
    showFeedback("Batch migrasi berhasil dilanjutkan.");
    await Promise.all([monitorQuery.refetch(), detailedWorkerQuery.refetch()]);
  };

  const handleManualRefresh = async () => {
    await Promise.all([
      refetchStatus(),
      detailedWorkerQuery.refetch(),
      monitorQuery.refetch(),
      queueJobsQuery.refetch(),
    ]);
    showFeedback("Data telemetri berhasil diperbarui.");
  };

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Header Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              href="/migration"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors focus-utility-ring rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Unggah Migrasi
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#006877] flex items-center justify-center shrink-0 border border-teal-100">
              <Activity className="w-5 h-5 text-[#006877]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                Pusat Pemantauan & Manajemen Worker
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Pengelolaan komprehensif daemon worker BullMQ, diagnostik telemetri, dan kontrol operasional
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleManualRefresh}
            title="Segarkan status secara manual"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 transition-colors focus-utility-ring shadow-xs min-h-[40px] cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                detailedWorkerQuery.isRefetching ? "animate-spin text-[#006877]" : "text-slate-500"
              }`}
            />
            <span>Segarkan</span>
          </button>

          <Link
            href="/migration"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#006877] hover:bg-[#00525e] transition-colors focus-utility-ring shadow-xs min-h-[40px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Mulai Impor Baru</span>
          </Link>
        </div>
      </div>

      {/* Floating Alert / Toast */}
      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-teal-50 text-teal-800 border-teal-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-3"
          >
            x
          </button>
        </div>
      )}

      {/* 2. Active Processing Card (Always visible when a batch is active/paused) */}
      {activeBatch && (
        <section aria-labelledby="active-batch-heading">
          <h2 id="active-batch-heading" className="sr-only">
            Batch Sedang Diproses
          </h2>
          <BatchProgressCard
            batch={activeBatch}
            throughput={throughput}
            onCancel={handleCancelBatch}
            onResume={handleResumeBatch}
            isActionLoading={isActionLoading}
          />
        </section>
      )}

      {/* 3. Segmented Navigation Tabs (Apple Style) */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap sm:flex-nowrap items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all focus-utility-ring cursor-pointer min-h-[40px] ${
            activeTab === "overview"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Activity className="w-4 h-4 text-[#006877]" />
          <span>Ringkasan & Pipeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("jobs")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all focus-utility-ring cursor-pointer min-h-[40px] ${
            activeTab === "jobs"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Terminal className="w-4 h-4 text-indigo-600" />
          <span>Inspeksi Antrean Job</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all focus-utility-ring cursor-pointer min-h-[40px] ${
            activeTab === "history"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <History className="w-4 h-4 text-sky-600" />
          <span>Riwayat Batch ({monitorQuery.data?.total || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("telemetry")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all focus-utility-ring cursor-pointer min-h-[40px] ${
            activeTab === "telemetry"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <HardDrive className="w-4 h-4 text-amber-600" />
          <span>Telemetri Sistem</span>
        </button>
      </div>

      {/* Tab 1: Overview & Worker Pipeline Details */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {detailedWorkerQuery.data?.queues ? (
            <WorkerDetailInspector
              queues={detailedWorkerQuery.data.queues}
              isSuperAdmin={isSuperAdmin}
              onPauseQueue={handlePauseQueue}
              onResumeQueue={handleResumeQueue}
              isActionLoading={
                pauseQueueMutation.isPending || resumeQueueMutation.isPending
              }
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-400 text-xs animate-pulse">
              Memuat data pipeline dan status antrean worker...
            </div>
          )}

          {/* Quick Snapshot of Telemetry in Overview */}
          {detailedWorkerQuery.data && (
            <SystemDiagnosticsCard telemetry={detailedWorkerQuery.data} />
          )}
        </div>
      )}

      {/* Tab 2: Queue Jobs Manager (Deep Payload & Retry Inspector) */}
      {activeTab === "jobs" && (
        <div>
          <QueueJobsManager
            queueName={selectedQueue}
            onQueueNameChange={(q) => {
              setSelectedQueue(q);
              setJobPage(1);
            }}
            status={jobStatus}
            onStatusChange={(s) => {
              setJobStatus(s);
              setJobPage(1);
            }}
            jobs={queueJobsQuery.data?.jobs || []}
            totalJobs={queueJobsQuery.data?.total || 0}
            currentPage={jobPage}
            pageSize={10}
            totalPages={queueJobsQuery.data?.totalPages || 1}
            onPageChange={setJobPage}
            onRetryJob={handleRetryJob}
            onRemoveJob={handleRemoveJob}
            onRetryAllFailed={handleRetryAllFailed}
            onCleanQueue={handleCleanQueue}
            isSuperAdmin={isSuperAdmin}
            isLoading={queueJobsQuery.isLoading}
          />
        </div>
      )}

      {/* Tab 3: Migration Batch History (RBAC & Error Log Drilldown) */}
      {activeTab === "history" && (
        <div>
          <BatchMonitorTable
            batches={(monitorQuery.data?.batches as any) || []}
            totalBatches={monitorQuery.data?.total || 0}
            currentPage={batchPage}
            pageSize={10}
            totalPages={monitorQuery.data?.totalPages || 1}
            selectedStatus={statusFilter}
            onPageChange={setBatchPage}
            onStatusChange={(newStatus) => {
              setStatusFilter(newStatus);
              setBatchPage(1);
            }}
            onCancelBatch={handleCancelBatch}
            onResumeBatch={handleResumeBatch}
            isSuperAdmin={isSuperAdmin}
            isLoading={monitorQuery.isLoading}
          />
        </div>
      )}

      {/* Tab 4: System Diagnostics & Resource Telemetry */}
      {activeTab === "telemetry" && (
        <div>
          {detailedWorkerQuery.data ? (
            <SystemDiagnosticsCard telemetry={detailedWorkerQuery.data} />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-400 text-xs animate-pulse">
              Memuat diagnostik sistem...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
