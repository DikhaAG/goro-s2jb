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
  Sparkles,
} from "lucide-react";
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
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-in slide-in-from-top-3 duration-200 bg-white">
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span className="text-slate-800">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 mb-1">
            <span>Operasional UID S2JB</span>
            <span>/</span>
            <span>AI Vision Engine</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BrainCircuit className="w-6 h-6 text-sky-600" />
            Pelatihan & Katalog Model OCR Deep Learning
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Sistem Continuous Active Learning human-in-the-loop, pelatihan model PyTorch CRNN kontinu, manajemen model registry, dan hot-reload produksi tanpa downtime.
          </p>
        </div>

        {/* Global Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsColdStartModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Panen Data Historis (Cold-Start)
          </button>

          <button
            type="button"
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors shadow-2xs"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            Segarkan
          </button>
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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("MODELS")}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
            activeTab === "MODELS"
              ? "border-sky-600 text-sky-600 bg-sky-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          Katalog Versi Model (Model Registry)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DATASET")}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
            activeTab === "DATASET"
              ? "border-sky-600 text-sky-600 bg-sky-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Database className="w-4 h-4" />
          Kurasi Data Latih
          {datasetStats && (
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-bold ml-1">
              {datasetStats.totalSamples}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("JOBS")}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-xs border-b-2 transition-all ${
            activeTab === "JOBS"
              ? "border-sky-600 text-sky-600 bg-sky-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          Riwayat Pekerjaan Training
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

