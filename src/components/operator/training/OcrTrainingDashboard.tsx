"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  BrainCircuit,
  FileSpreadsheet,
  RefreshCw,
  Layers,
  Database,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActiveModelHeroCard } from "./ActiveModelHeroCard";
import { LiveTrainingConsole } from "./LiveTrainingConsole";
import { ModelRegistryTable } from "./ModelRegistryTable";
import { DatasetCuratorTable } from "./DatasetCuratorTable";
import { TrainingJobsTable } from "./TrainingJobsTable";
import { TrainingTriggerModal } from "./TrainingTriggerModal";
import { ModelComparisonModal } from "./ModelComparisonModal";
import { ColdStartHarvestModal } from "./ColdStartHarvestModal";

export function OcrTrainingDashboard() {
  const [activeTab, setActiveTab] = useState<"MODELS" | "DATASET" | "JOBS">("MODELS");

  // Modal Dialog States
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [isColdStartModalOpen, setIsColdStartModalOpen] = useState(false);
  const [comparisonPair, setComparisonPair] = useState<{ modelAId: string; modelBId: string } | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Queries
  const { data: activeModel, refetch: refetchActiveModel } = trpc.ocrTraining.getActiveModel.useQuery();
  const { data: triggerStatus, refetch: refetchTriggerStatus } = trpc.ocrTraining.getTriggerStatus.useQuery();
  const { data: datasetStats, refetch: refetchDatasetStats } = trpc.ocrTraining.getDatasetStats.useQuery();

  const handleRefreshAll = () => {
    refetchActiveModel();
    refetchTriggerStatus();
    refetchDatasetStats();
    showToast("success", "Data status dan katalog model berhasil disegarkan.");
  };

  const handleOpenCompare = (modelAId: string, modelBId: string) => {
    setComparisonPair({ modelAId, modelBId });
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification (Floating Dark Slate Container) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0f172a] text-white border border-[#334155] shadow-2xl rounded-2xl p-4 text-xs animate-in slide-in-from-bottom-5 duration-200">
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
            className="p-1 text-[#94a3b8] hover:text-white rounded-lg transition-colors cursor-pointer focus-utility-ring"
            title="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Enterprise Header Banner */}
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
                Continuous Active Learning
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a] flex items-center gap-2.5">
              <BrainCircuit className="w-6 h-6 text-[#00a2b9]" />
              <span>Pelatihan & Katalog Model OCR Deep Learning</span>
            </h1>

            <p className="text-xs text-[#64748b] leading-relaxed">
              Pusat komando pelatihan model PyTorch CRNN kontinu berbasis ulasan terverifikasi operator, kurasi dataset ground truth, komparasi benchmark, dan hot-reload produksi tanpa downtime.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {/* Operator Engine Status Pill */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-[#16a34a] animate-pulse" />
              <span className="text-[#0f172a] font-semibold">Engine Aktif:</span>
              <span className="text-[#006877] font-mono text-[11px] font-bold">
                {activeModel?.name ? `${activeModel.name} (${activeModel.version})` : "Tesseract Baseline"}
              </span>
            </div>

            {/* Cold Start Harvest Button */}
            <button
              type="button"
              onClick={() => setIsColdStartModalOpen(true)}
              className="min-h-[44px] h-11 px-4 rounded-xl bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs"
              title="Panen Data Historis Spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#16a34a]" />
              <span>Panen Data Historis</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefreshAll}
              className="min-h-[44px] h-11 px-4 rounded-xl bg-[#00a2b9] hover:bg-[#008c9f] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs"
              title="Segarkan Seluruh Data Status"
            >
              <RefreshCw className="w-4 h-4 text-white" />
              <span>Segarkan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Hero Section: Active Model Card & Dual Trigger Gauge */}
      <ActiveModelHeroCard
        activeModel={activeModel}
        triggerStatus={triggerStatus}
        onOpenTriggerModal={() => setIsTriggerModalOpen(true)}
        canRollback={false}
      />

      {/* Live Training Console (Visible when active job running) */}
      <LiveTrainingConsole onJobFinished={handleRefreshAll} />

      {/* Navigation Tabs (PLN Corporate Brand Styling) */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("MODELS")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer focus-utility-ring ${
            activeTab === "MODELS"
              ? "border-[#00a2b9] text-[#006877] bg-[#00a2b9]/10 rounded-t-xl font-bold"
              : "border-transparent text-[#64748b] hover:text-[#0f172a]"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Katalog Versi Model (Model Registry)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DATASET")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer focus-utility-ring ${
            activeTab === "DATASET"
              ? "border-[#00a2b9] text-[#006877] bg-[#00a2b9]/10 rounded-t-xl font-bold"
              : "border-transparent text-[#64748b] hover:text-[#0f172a]"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Kurasi Data Latih</span>
          {datasetStats && (
            <span className="text-[10px] font-mono bg-white border border-[#cbd5e1] text-[#006877] px-2 py-0.5 rounded-full font-bold ml-1">
              {datasetStats.totalSamples}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("JOBS")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer focus-utility-ring ${
            activeTab === "JOBS"
              ? "border-[#00a2b9] text-[#006877] bg-[#00a2b9]/10 rounded-t-xl font-bold"
              : "border-transparent text-[#64748b] hover:text-[#0f172a]"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Riwayat Pekerjaan Pelatihan</span>
        </button>
      </div>

      {/* Active Tab Panel */}
      {activeTab === "MODELS" && (
        <ModelRegistryTable
          activeModelId={activeModel?.id}
          onCompare={handleOpenCompare}
          onModelStatusChanged={handleRefreshAll}
        />
      )}

      {activeTab === "DATASET" && (
        <DatasetCuratorTable onDatasetChanged={handleRefreshAll} />
      )}

      {activeTab === "JOBS" && <TrainingJobsTable />}

      {/* Modals */}
      <TrainingTriggerModal
        isOpen={isTriggerModalOpen}
        onClose={() => setIsTriggerModalOpen(false)}
        onSuccess={(jobId) => {
          showToast("success", `Pekerjaan pelatihan (${jobId}) berhasil didaftarkan ke antrean BullMQ!`);
          handleRefreshAll();
        }}
        totalApprovedSamples={datasetStats?.approvedCount ?? 0}
      />

      <ColdStartHarvestModal
        isOpen={isColdStartModalOpen}
        onClose={() => setIsColdStartModalOpen(false)}
        onSuccess={(count) => {
          showToast("success", `Panen data berhasil! ${count} sampel baru ditambahkan ke dataset latih.`);
          handleRefreshAll();
        }}
      />

      {comparisonPair && (
        <ModelComparisonModal
          isOpen={!!comparisonPair}
          onClose={() => setComparisonPair(null)}
          modelAId={comparisonPair.modelAId}
          modelBId={comparisonPair.modelBId}
        />
      )}
    </div>
  );
}

