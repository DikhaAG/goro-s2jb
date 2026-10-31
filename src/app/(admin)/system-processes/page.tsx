"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Terminal,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileText,
  Activity,
  Zap,
  Server,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceStatusGrid } from "@/components/admin/system/ServiceStatusGrid";
import { RunningProcessTable, ManagedProcessItem } from "@/components/admin/system/RunningProcessTable";
import { LiveLogViewer } from "@/components/admin/system/LiveLogViewer";
import { KillProcessConfirmModal } from "@/components/admin/system/KillProcessConfirmModal";
import { SystemResourceGauge } from "@/components/admin/system/SystemResourceGauge";

export default function SystemProcessesPage() {
  const [activeLogFile, setActiveLogFile] = useState<string>("worker_import.log");
  const [lineCount, setLineCount] = useState<number>(100);
  const [processToKill, setProcessToKill] = useState<ManagedProcessItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Queries with auto-polling
  const overviewQuery = trpc.systemProcesses.getSystemOverview.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const processesQuery = trpc.systemProcesses.getRunningProcesses.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const logsQuery = trpc.systemProcesses.getServiceLogs.useQuery(
    {
      fileName: activeLogFile,
      lines: lineCount,
    },
    {
      refetchInterval: 4000,
    }
  );

  // Mutations
  const terminateMutation = trpc.systemProcesses.terminateProcess.useMutation({
    onSuccess: (data) => {
      setFeedback({ type: "success", message: data.message });
      setProcessToKill(null);
      processesQuery.refetch();
      overviewQuery.refetch();
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err) => {
      setFeedback({ type: "error", message: err.message });
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const restartMutation = trpc.systemProcesses.restartWorker.useMutation({
    onSuccess: (data) => {
      setFeedback({ type: "success", message: data.message });
      processesQuery.refetch();
      overviewQuery.refetch();
      logsQuery.refetch();
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err) => {
      setFeedback({ type: "error", message: err.message });
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const cleanOrphansMutation = trpc.systemProcesses.cleanOrphanProcesses.useMutation({
    onSuccess: (data) => {
      setFeedback({ type: "success", message: data.message });
      processesQuery.refetch();
      overviewQuery.refetch();
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err) => {
      setFeedback({ type: "error", message: err.message });
      setTimeout(() => setFeedback(null), 5000);
    },
  });

  const handleRefreshAll = () => {
    overviewQuery.refetch();
    processesQuery.refetch();
    logsQuery.refetch();
  };

  const handleConfirmKill = (pid: number, reason: string, force: boolean) => {
    terminateMutation.mutate({ pid, reason, force });
  };

  const handleRestartWorker = (workerType: "import" | "ocr" | "python") => {
    restartMutation.mutate({ workerType });
  };

  const handleViewLogs = (fileName: string) => {
    setActiveLogFile(fileName);
    // Smooth scroll to log viewer section
    const el = document.getElementById("log-viewer-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Enterprise Command Header Banner */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Brand Badges Bar */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#006877]/10 text-[#006877] text-xs font-bold">
              <Zap className="w-3.5 h-3.5 fill-[#006877]" />
              PLN UID S2JB
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-semibold">
              <Server className="w-3.5 h-3.5 text-[#64748b]" />
              Host System &amp; OS Daemon Controller
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              System Engine Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 border border-[#bae6fd]">
              <Terminal className="w-5 h-5 text-[#006877]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight">
                Pusat Kontrol Layanan &amp; Proses Sistem Lokal
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
                Pemantauan langsung port TCP, Process ID (PID), penggunaan sumber daya host, pembacaan log real-time, serta pengendalian siklus hidup proses latar belakang.
              </p>
            </div>
          </div>
        </div>

        {/* Global Control Buttons */}
        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            type="button"
            disabled={cleanOrphansMutation.isPending}
            onClick={() => cleanOrphansMutation.mutate({})}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold border border-[#fed7aa] bg-[#fff7ed] hover:bg-[#ffedd5] text-[#b45309] shadow-xs transition-all flex items-center gap-2 focus-utility-ring cursor-pointer disabled:opacity-50"
            title="Hentikan proses detached / zombie yang tidak terikat terminal"
          >
            <Sparkles className={`w-3.5 h-3.5 ${cleanOrphansMutation.isPending ? "animate-spin text-[#f59e0b]" : "text-[#b45309]"}`} />
            <span>Bersihkan Zombie</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={overviewQuery.isFetching}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-[#00a2b9] hover:bg-[#008c9f] text-white shadow-xs transition-all flex items-center gap-2 focus-utility-ring cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${overviewQuery.isFetching ? "animate-spin text-white" : "text-white"}`} />
            <span>Segarkan Status</span>
          </button>
        </div>
      </div>

      {/* Floating Dark Toast Notification */}
      {feedback && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0f172a] text-white border border-[#334155] shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3 animate-in fade-in duration-200"
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white font-bold ml-2 text-xs focus-utility-ring rounded p-1"
          >
            x
          </button>
        </div>
      )}

      {/* 2. Service Status Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#006877]" />
            <span>Status Port Layanan Inti</span>
          </h2>
          <span className="text-xs font-mono text-[#64748b]">Pembaruan otomatis setiap 5 detik</span>
        </div>
        <ServiceStatusGrid
          services={overviewQuery.data?.services || []}
          onRestartWorker={handleRestartWorker}
          onViewLogs={handleViewLogs}
          isRestarting={restartMutation.isPending}
        />
      </div>

      {/* 3. System Hardware & Runtime Telemetry */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#006877]" />
            <span>Telemetri Sumber Daya Sistem Host</span>
          </h2>
        </div>
        <SystemResourceGauge resources={overviewQuery.data?.resources || null} />
      </div>

      {/* 4. Running OS Process Table */}
      <RunningProcessTable
        processes={processesQuery.data?.processes || []}
        onSelectProcessToKill={(proc) => setProcessToKill(proc)}
        isLoading={processesQuery.isFetching}
      />

      {/* 5. Live Log Viewer Terminal */}
      <div id="log-viewer-section" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#006877]" />
            <span>Inspeksi Berkas Log Real-Time</span>
          </h2>
          <span className="text-xs font-mono text-[#64748b]">Stream dari direktori logs/</span>
        </div>
        <LiveLogViewer
          activeFile={activeLogFile}
          onSelectFile={(f) => setActiveLogFile(f)}
          lines={logsQuery.data?.lines || []}
          totalLines={logsQuery.data?.totalLines || 0}
          sizeBytes={logsQuery.data?.sizeBytes || 0}
          lastModified={logsQuery.data?.lastModified}
          isLoading={logsQuery.isFetching}
          onRefresh={() => logsQuery.refetch()}
          lineCount={lineCount}
          onChangeLineCount={(c) => setLineCount(c)}
        />
      </div>

      {/* Kill Process Modal */}
      <KillProcessConfirmModal
        process={processToKill}
        isOpen={!!processToKill}
        onClose={() => setProcessToKill(null)}
        onConfirm={handleConfirmKill}
        isSubmitting={terminateMutation.isPending}
      />
    </div>
  );
}
