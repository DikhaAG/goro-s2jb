"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  HardDrive,
  History,
  Layers,
  PlusCircle,
  RotateCw,
  Terminal,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useMigrationGuard } from "@/context/MigrationGuardContext";
import { BatchProgressCard } from "@/components/migration/BatchProgressCard";
import {
  BATCH_STATUS_FILTERS,
  BatchMonitorTable,
} from "@/components/migration/BatchMonitorTable";
import { WorkerDetailInspector } from "@/components/migration/WorkerDetailInspector";
import { QueueJobsManager } from "@/components/migration/QueueJobsManager";
import { SystemDiagnosticsCard } from "@/components/migration/SystemDiagnosticsCard";

const PAGE_SIZE = 10;

const MONITOR_TAB_IDS = ["overview", "jobs", "history", "telemetry"] as const;
type MonitorTab = (typeof MONITOR_TAB_IDS)[number];

const MONITOR_TABS: { id: MonitorTab; label: string; icon: LucideIcon; iconClass: string }[] = [
  { id: "overview", label: "Ringkasan & Pipeline", icon: Activity, iconClass: "text-[#006877]" },
  { id: "jobs", label: "Inspeksi Antrean Job", icon: Terminal, iconClass: "text-indigo-600" },
  { id: "history", label: "Riwayat Batch", icon: History, iconClass: "text-sky-600" },
  { id: "telemetry", label: "Telemetri Sistem", icon: HardDrive, iconClass: "text-amber-600" },
];

const QUEUE_NAMES = ["import", "ocr"] as const;
type QueueName = (typeof QUEUE_NAMES)[number];

const JOB_STATUSES = ["active", "waiting", "failed", "completed", "delayed"] as const;

function isMonitorTab(value: string): value is MonitorTab {
  return (MONITOR_TAB_IDS as readonly string[]).includes(value);
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function LoadingPanel({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center text-[#64748b] text-xs animate-pulse">
      {children}
    </div>
  );
}

export function MigrationMonitor() {
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(MONITOR_TAB_IDS).withDefault("overview")
  );
  const [batchStatus, setBatchStatus] = useQueryState(
    "batchStatus",
    parseAsStringLiteral(BATCH_STATUS_FILTERS).withDefault("ALL")
  );
  const [batchPage, setBatchPage] = useQueryState("batchPage", parseAsInteger.withDefault(1));
  const [queueName, setQueueName] = useQueryState(
    "queue",
    parseAsStringLiteral(QUEUE_NAMES).withDefault("import")
  );
  const [jobStatus, setJobStatus] = useQueryState(
    "jobStatus",
    parseAsStringLiteral(JOB_STATUSES).withDefault("active")
  );
  const [jobPage, setJobPage] = useQueryState("jobPage", parseAsInteger.withDefault(1));

  const { activeBatch, throughput, cancelBatch, resumeBatch, isActionLoading } =
    useMigrationGuard();
  const utils = trpc.useUtils();

  const detailedWorkerQuery = trpc.migration.getDetailedWorkerStatus.useQuery(undefined, {
    refetchInterval: activeBatch ? 2000 : 6000,
  });

  const monitorQuery = trpc.migration.getMonitorBatches.useQuery(
    { page: batchPage, pageSize: PAGE_SIZE, status: batchStatus },
    { refetchInterval: activeBatch ? 2500 : 8000 }
  );

  const queueJobsQuery = trpc.migration.getQueueJobs.useQuery(
    { queueName, status: jobStatus, page: jobPage, pageSize: PAGE_SIZE },
    { enabled: activeTab === "jobs", refetchInterval: 3000 }
  );

  const pauseQueue = trpc.migration.pauseQueue.useMutation();
  const resumeQueue = trpc.migration.resumeQueue.useMutation();
  const retryJob = trpc.migration.retryJob.useMutation();
  const removeJob = trpc.migration.removeJob.useMutation();
  const retryAllFailed = trpc.migration.retryAllFailedJobs.useMutation();
  const cleanQueue = trpc.migration.cleanQueue.useMutation();

  const isSuperAdmin = detailedWorkerQuery.data?.isSuperAdmin ?? false;

  // invalidate() refetches only mounted queries, so the jobs list is skipped while its tab is closed.
  const runAction = async (action: () => Promise<string>, fallbackError: string) => {
    try {
      toast.success(await action());
    } catch (err) {
      toast.error(errorMessage(err, fallbackError));
    }
    await utils.migration.invalidate();
  };

  const handlePauseQueue = (name: QueueName) =>
    runAction(
      async () => (await pauseQueue.mutateAsync({ queueName: name })).message,
      "Gagal menjeda antrean"
    );

  const handleResumeQueue = (name: QueueName) =>
    runAction(
      async () => (await resumeQueue.mutateAsync({ queueName: name })).message,
      "Gagal melanjutkan antrean"
    );

  const handleRetryJob = (jobId: string) =>
    runAction(
      async () => (await retryJob.mutateAsync({ queueName, jobId })).message,
      "Gagal mencoba ulang job"
    );

  const handleRemoveJob = (jobId: string) =>
    runAction(
      async () => (await removeJob.mutateAsync({ queueName, jobId })).message,
      "Gagal menghapus job"
    );

  const handleRetryAllFailed = () =>
    runAction(
      async () => (await retryAllFailed.mutateAsync({ queueName })).message,
      "Gagal mencoba ulang seluruh job gagal"
    );

  const handleCleanQueue = (type: "failed" | "completed") =>
    runAction(
      async () => (await cleanQueue.mutateAsync({ queueName, type })).message,
      "Gagal membersihkan antrean"
    );

  const handleCancelBatch = (batchId: string) =>
    runAction(async () => {
      await cancelBatch(batchId);
      return "Batch migrasi berhasil dihentikan.";
    }, "Gagal menghentikan batch migrasi");

  const handleResumeBatch = (batchId: string) =>
    runAction(async () => {
      await resumeBatch(batchId);
      return "Batch migrasi berhasil dilanjutkan.";
    }, "Gagal melanjutkan batch migrasi");

  const handleManualRefresh = async () => {
    await utils.migration.invalidate();
    toast.success("Data telemetri berhasil diperbarui.");
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#006877]/10 text-[#006877] text-xs font-bold">
              <Zap className="w-3.5 h-3.5 fill-[#006877]" />
              PLN UID S2JB
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-semibold">
              <Layers className="w-3.5 h-3.5 text-[#64748b]" />
              BullMQ Diagnostics & Telemetry
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Pipeline Monitoring
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 border border-[#bae6fd]">
              <Activity className="w-5 h-5 text-[#006877]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight">
                Pusat Pemantauan & Manajemen Worker
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
                Pengelolaan komprehensif daemon worker BullMQ, diagnostik telemetri antrean, dan kontrol operasional.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <Link
            href="/migration"
            className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 focus-utility-ring"
          >
            <ArrowLeft className="w-4 h-4 text-[#64748b]" />
            <span>Kembali ke Unggah</span>
          </Link>

          <button
            type="button"
            onClick={handleManualRefresh}
            title="Segarkan status secara manual"
            className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 focus-utility-ring cursor-pointer"
          >
            <RotateCw
              className={cn(
                "w-3.5 h-3.5",
                detailedWorkerQuery.isRefetching ? "animate-spin text-[#006877]" : "text-[#64748b]"
              )}
            />
            <span>Segarkan</span>
          </button>

          <Link
            href="/migration"
            className="min-h-[44px] px-4 py-2 bg-[#006877] hover:bg-[#004e5a] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 focus-utility-ring"
          >
            <PlusCircle className="w-4 h-4 text-white" />
            <span>Impor Baru</span>
          </Link>
        </div>
      </div>

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

      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => isMonitorTab(value) && setActiveTab(value)}
        className="space-y-6"
      >
        <Tabs.List
          aria-label="Bagian pemantauan worker"
          className="bg-[#f1f5f9] p-1.5 rounded-2xl flex flex-wrap sm:flex-nowrap items-center gap-1.5 border border-[#e2e8f0]"
        >
          {MONITOR_TABS.map(({ id, label, icon: Icon, iconClass }) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all focus-utility-ring cursor-pointer min-h-[40px] text-[#475569] hover:text-[#0f172a] data-[state=active]:bg-white data-[state=active]:text-[#0f172a] data-[state=active]:shadow-xs"
            >
              <Icon className={cn("w-4 h-4", iconClass)} aria-hidden />
              <span>
                {id === "history" ? `${label} (${monitorQuery.data?.total ?? 0})` : label}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="overview" className="space-y-6 focus-utility-ring rounded-2xl">
          {detailedWorkerQuery.data ? (
            <>
              <WorkerDetailInspector
                queues={detailedWorkerQuery.data.queues}
                isSuperAdmin={isSuperAdmin}
                onPauseQueue={handlePauseQueue}
                onResumeQueue={handleResumeQueue}
                isActionLoading={pauseQueue.isPending || resumeQueue.isPending}
              />
              <SystemDiagnosticsCard telemetry={detailedWorkerQuery.data} />
            </>
          ) : (
            <LoadingPanel>Memuat data pipeline dan status antrean worker...</LoadingPanel>
          )}
        </Tabs.Content>

        <Tabs.Content value="jobs" className="focus-utility-ring rounded-2xl">
          <QueueJobsManager
            queueName={queueName}
            onQueueNameChange={(name) => {
              setQueueName(name);
              setJobPage(1);
            }}
            status={jobStatus}
            onStatusChange={(status) => {
              setJobStatus(status);
              setJobPage(1);
            }}
            jobs={queueJobsQuery.data?.jobs ?? []}
            totalJobs={queueJobsQuery.data?.total ?? 0}
            currentPage={jobPage}
            pageSize={PAGE_SIZE}
            totalPages={queueJobsQuery.data?.totalPages ?? 1}
            onPageChange={setJobPage}
            onRetryJob={handleRetryJob}
            onRemoveJob={handleRemoveJob}
            onRetryAllFailed={handleRetryAllFailed}
            onCleanQueue={handleCleanQueue}
            isSuperAdmin={isSuperAdmin}
            isLoading={queueJobsQuery.isLoading}
          />
        </Tabs.Content>

        <Tabs.Content value="history" className="focus-utility-ring rounded-2xl">
          <BatchMonitorTable
            batches={monitorQuery.data?.batches ?? []}
            totalBatches={monitorQuery.data?.total ?? 0}
            currentPage={batchPage}
            pageSize={PAGE_SIZE}
            totalPages={monitorQuery.data?.totalPages ?? 1}
            selectedStatus={batchStatus}
            onPageChange={setBatchPage}
            onStatusChange={(status) => {
              setBatchStatus(status);
              setBatchPage(1);
            }}
            onCancelBatch={handleCancelBatch}
            onResumeBatch={handleResumeBatch}
            isSuperAdmin={isSuperAdmin}
            isLoading={monitorQuery.isLoading}
          />
        </Tabs.Content>

        <Tabs.Content value="telemetry" className="focus-utility-ring rounded-2xl">
          {detailedWorkerQuery.data ? (
            <SystemDiagnosticsCard telemetry={detailedWorkerQuery.data} />
          ) : (
            <LoadingPanel>Memuat diagnostik sistem...</LoadingPanel>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
