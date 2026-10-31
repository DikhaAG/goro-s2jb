"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { OcrModelStatus } from "@prisma/client";
import {
  Layers,
  CheckCircle2,
  RotateCcw,
  Scale,
  XCircle,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ModelRegistryTableProps {
  activeModelId?: string | null;
  onCompare: (modelAId: string, modelBId: string) => void;
  onModelStatusChanged: () => void;
}

export function ModelRegistryTable({
  activeModelId,
  onCompare,
  onModelStatusChanged,
}: ModelRegistryTableProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Activation & Rollback Modal States
  const [modelToActivate, setModelToActivate] = useState<any | null>(null);
  const [modelToRollback, setModelToRollback] = useState<any | null>(null);
  const [modelToReject, setModelToReject] = useState<any | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.ocrTraining.listModels.useQuery({
    status: selectedStatus === "ALL" ? undefined : (selectedStatus as OcrModelStatus),
    page,
    pageSize,
  });

  const activateMutation = trpc.ocrTraining.activateModel.useMutation({
    onSuccess: () => {
      setModelToActivate(null);
      refetch();
      onModelStatusChanged();
    },
    onError: (err) => {
      setActionError(err.message || "Gagal mengaktifkan model.");
    },
  });

  const rollbackMutation = trpc.ocrTraining.rollbackModel.useMutation({
    onSuccess: () => {
      setModelToRollback(null);
      setRollbackReason("");
      refetch();
      onModelStatusChanged();
    },
    onError: (err) => {
      setActionError(err.message || "Gagal melakukan rollback model.");
    },
  });

  const rejectMutation = trpc.ocrTraining.rejectModel.useMutation({
    onSuccess: () => {
      setModelToReject(null);
      setRejectReason("");
      refetch();
      onModelStatusChanged();
    },
    onError: (err) => {
      setActionError(err.message || "Gagal menolak model staging.");
    },
  });

  const handleConfirmActivate = () => {
    if (!modelToActivate) return;
    setActionError(null);
    activateMutation.mutate({ modelId: modelToActivate.id });
  };

  const handleConfirmRollback = () => {
    if (!modelToRollback) return;
    if (!rollbackReason.trim()) {
      setActionError("Mohon masukkan alasan rollback.");
      return;
    }
    setActionError(null);
    rollbackMutation.mutate({
      targetModelId: modelToRollback.id,
      reason: rollbackReason.trim(),
    });
  };

  const handleConfirmReject = () => {
    if (!modelToReject) return;
    if (!rejectReason.trim()) {
      setActionError("Mohon masukkan alasan penolakan model.");
      return;
    }
    setActionError(null);
    rejectMutation.mutate({
      modelId: modelToReject.id,
      reason: rejectReason.trim(),
    });
  };

  const items = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;

  const renderStatusBadge = (status: OcrModelStatus) => {
    switch (status) {
      case OcrModelStatus.ACTIVE:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active (Produksi)
          </span>
        );
      case OcrModelStatus.STAGING:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Staging (Evaluasi)
          </span>
        );
      case OcrModelStatus.ARCHIVED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Archived (Arsip)
          </span>
        );
      case OcrModelStatus.REJECTED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            Rejected (Ditolak)
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header & Filter Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
            Katalog Versi Model OCR (Model Registry)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar checkpoint model terversi, evaluasi metrik objektif, dan kontrol staging ke produksi.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {["ALL", "ACTIVE", "STAGING", "ARCHIVED", "REJECTED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setSelectedStatus(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedStatus === st
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {st === "ALL" ? "Semua Status" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Versi & Nama Model</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Akurasi</th>
              <th className="py-3 px-4">CER / WER</th>
              <th className="py-3 px-4">Sampel Latih</th>
              <th className="py-3 px-4">Tanggal Latih</th>
              <th className="py-3 px-4 text-right">Aksi Manajemen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
                  Memuat katalog model...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  Tidak ada model OCR yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              items.map((m: any) => {
                const isActive = m.status === OcrModelStatus.ACTIVE;
                const isStaging = m.status === OcrModelStatus.STAGING;
                const isArchived = m.status === OcrModelStatus.ARCHIVED;

                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isActive ? "bg-sky-50/20 font-medium" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        {m.version}
                        {isActive && (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            PROD
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{m.name}</div>
                    </td>

                    <td className="py-3 px-4">{renderStatusBadge(m.status)}</td>

                    <td className="py-3 px-4">
                      {m.accuracyScore !== null ? (
                        <span className="font-bold text-emerald-600">
                          {m.accuracyScore.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className="text-sky-700">CER: {m.cerScore !== null ? `${m.cerScore.toFixed(2)}%` : "N/A"}</span>
                      <br />
                      <span className="text-slate-500">WER: {m.werScore !== null ? `${m.werScore.toFixed(2)}%` : "N/A"}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{m.trainingSamplesCount}</span>
                      <span className="text-slate-400 text-[10px] block">
                        ({m.epochsTrained} epochs, {m.durationSeconds}s)
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      <div>
                        {new Date(m.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Oleh: {m.trainedBy?.name || "Sistem"}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {/* Compare Button */}
                        {activeModelId && activeModelId !== m.id && (
                          <button
                            type="button"
                            onClick={() => onCompare(activeModelId, m.id)}
                            title="Bandingkan dengan model aktif"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          >
                            <Scale className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Staging Actions: Activate & Reject */}
                        {isStaging && (
                          <>
                            <button
                              type="button"
                              onClick={() => setModelToActivate(m)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] inline-flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aktifkan
                            </button>
                            <button
                              type="button"
                              onClick={() => setModelToReject(m)}
                              title="Tolak model staging"
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* Archived Action: Rollback */}
                        {isArchived && (
                          <button
                            type="button"
                            onClick={() => setModelToRollback(m)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[11px] inline-flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Rollback
                          </button>
                        )}

                        {isActive && (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                            Sedang Aktif
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
        <div>
          Menampilkan <strong className="text-slate-900">{items.length}</strong> dari{" "}
          <strong className="text-slate-900">{totalCount}</strong> versi model
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-slate-700">
            Halaman {page} dari {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. Modal Konfirmasi Aktivasi (Hot-Reload) */}
      {modelToActivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setModelToActivate(null)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                Aktifkan Model ke Produksi (Hot-Reload)
              </h3>
              <button
                type="button"
                onClick={() => setModelToActivate(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Anda akan mempromosikan model <strong className="text-slate-900">{modelToActivate.version}</strong> ke status <strong>ACTIVE</strong>. Model aktif saat ini akan otomatis diarsipkan (ARCHIVED) dan inferensi ulasan berikutnya seketika beralih ke model ini tanpa downtime.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Akurasi Benchmark:</span>
                <span className="font-bold text-emerald-600">
                  {modelToActivate.accuracyScore ? `${modelToActivate.accuracyScore.toFixed(1)}%` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Character Error Rate (CER):</span>
                <span className="font-mono text-slate-700">
                  {modelToActivate.cerScore ? `${modelToActivate.cerScore.toFixed(2)}%` : "N/A"}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModelToActivate(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmActivate}
                disabled={activateMutation.isPending}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                {activateMutation.isPending ? "Mengaktifkan..." : "Konfirmasi & Aktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Konfirmasi Rollback */}
      {modelToRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setModelToRollback(null)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 text-amber-600">
                <RotateCcw className="w-4 h-4" />
                Rollback ke Versi {modelToRollback.version}
              </h3>
              <button
                type="button"
                onClick={() => setModelToRollback(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan mengembalikan model produksi ke versi <strong className="text-slate-900">{modelToRollback.version}</strong>. Gunakan jika ditemukan anomali inferensi atau penurunan akurasi di lapangan.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Rollback (Wajib dicatat di Audit Log)
              </label>
              <textarea
                rows={2}
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Contoh: Ditemukan false negative pada ulasan bintang 5 berspasi lebar"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-900"
              />
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModelToRollback(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRollback}
                disabled={rollbackMutation.isPending}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
              >
                {rollbackMutation.isPending ? "Melakukan Rollback..." : "Ya, Lakukan Rollback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Konfirmasi Penolakan Model Staging */}
      {modelToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setModelToReject(null)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 text-rose-600">
                <XCircle className="w-4 h-4" />
                Tolak Model Staging {modelToReject.version}
              </h3>
              <button
                type="button"
                onClick={() => setModelToReject(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Model ini tidak akan dapat diaktifkan ke produksi kecuali dilatih ulang. Status model akan diubah menjadi REJECTED.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Penolakan
              </label>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Skor CER melebihi batas toleransi 5%"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-slate-900"
              />
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModelToReject(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {rejectMutation.isPending ? "Menolak..." : "Tolak Model"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

