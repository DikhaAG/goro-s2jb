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
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-[#00A3E0]/10 text-[#00A3E0] rounded-lg">
              <Terminal className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Pusat Kontrol Layanan & Proses Sistem Lokal
            </h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Pemantauan langsung port TCP, Process ID (PID), penggunaan sumber daya host, pembacaan log real-time, serta pengendalian siklus hidup proses latar belakang.
          </p>
        </div>

        {/* Global Control Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={cleanOrphansMutation.isPending}
            onClick={() => cleanOrphansMutation.mutate({})}
            className="h-9 text-xs px-3 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 font-medium transition-colors"
            title="Hentikan proses detached / zombie yang tidak terikat terminal"
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${cleanOrphansMutation.isPending ? "animate-spin" : ""}`} />
            Bersihkan Proses Zombie
          </Button>

          <Button
            size="sm"
            onClick={handleRefreshAll}
            disabled={overviewQuery.isFetching}
            className="h-9 text-xs px-3.5 rounded-xl bg-[#00A3E0] hover:bg-[#0072A3] text-white font-medium shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />
            Segarkan Status
          </Button>
        </div>
      </div>

      {/* Floating Feedback Notification */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 duration-150 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Service Status Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00A3E0]" />
            Status Port Layanan Inti
          </h2>
          <span className="text-xs text-slate-400">Pembaruan otomatis setiap 5 detik</span>
        </div>
        <ServiceStatusGrid
          services={overviewQuery.data?.services || []}
          onRestartWorker={handleRestartWorker}
          onViewLogs={handleViewLogs}
          isRestarting={restartMutation.isPending}
        />
      </div>

      {/* 3. System Hardware & Runtime Telemetry */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600" />
            Telemetri Sumber Daya Sistem Host
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
      <div id="log-viewer-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#00A3E0]" />
            Inspeksi Berkas Log Real-Time
          </h2>
          <span className="text-xs text-slate-400">Stream dari direktori logs/</span>
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
