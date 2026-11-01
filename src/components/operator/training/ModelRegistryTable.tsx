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
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden">
      {/* Header & Filter Bar */}
      <div className="p-5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006877]/10 text-[#006877] flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              Katalog Versi Model OCR (Model Registry)
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Daftar checkpoint model terversi, evaluasi metrik objektif, dan kontrol staging ke produksi.
            </p>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#f8fafc] border border-[#cbd5e1] p-1 rounded-xl text-xs font-semibold">
          {["ALL", "ACTIVE", "STAGING", "ARCHIVED", "REJECTED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setSelectedStatus(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer focus-utility-ring ${
                selectedStatus === st
                  ? "bg-[#00a2b9] text-white font-bold shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
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
          <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-bold uppercase tracking-wider text-[11px]">
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
          <tbody className="divide-y divide-[#f1f5f9] text-[#334155]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#64748b]">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#00a2b9] mb-2" />
                  Memuat katalog model...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#64748b]">
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
                    className={`hover:bg-[#f8fafc] transition-colors ${
                      isActive ? "bg-[#f0f9ff] border-b border-[#bae6fd] hover:bg-[#e0f2fe]" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-[#0f172a] text-xs flex items-center gap-1.5">
                        {m.version}
                        {isActive && (
                          <span className="text-[10px] text-[#15803d] font-bold bg-[#ecfdf5] px-1.5 py-0.5 rounded border border-[#a7f3d0]">
                            PROD
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#64748b] truncate max-w-xs">{m.name}</div>
                    </td>

                    <td className="py-3 px-4">{renderStatusBadge(m.status)}</td>

                    <td className="py-3 px-4">
                      {m.accuracyScore !== null ? (
                        <span className="font-mono font-bold text-[#15803d]">
                          {m.accuracyScore.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[#94a3b8] font-mono">N/A</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className="text-[#0369a1] font-bold">CER: {m.cerScore !== null ? `${m.cerScore.toFixed(2)}%` : "N/A"}</span>
                      <br />
                      <span className="text-[#64748b]">WER: {m.werScore !== null ? `${m.werScore.toFixed(2)}%` : "N/A"}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-[#0f172a]">{m.trainingSamplesCount}</span>
                      <span className="text-[#64748b] text-[10px] block">
                        ({m.epochsTrained} epochs, {m.durationSeconds}s)
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[#334155]">
                      <div>
                        {new Date(m.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-[10px] text-[#64748b]">
                        Oleh: {m.trainedBy?.name || "Sistem"}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {/* Compare Button */}
                        {activeModelId && activeModelId !== m.id && (
                          <button
                            type="button"
                            onClick={() => onCompare(activeModelId, m.id)}
                            title="Bandingkan dengan model aktif"
                            className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] transition-colors cursor-pointer focus-utility-ring"
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
                              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#00a2b9] hover:bg-[#008c9f] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer focus-utility-ring"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aktifkan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setModelToReject(m)}
                              title="Tolak model staging"
                              className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] hover:bg-rose-100 transition-colors cursor-pointer focus-utility-ring"
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
                            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#fff7ed] hover:bg-amber-100 text-[#b45309] border border-[#fed7aa] font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer focus-utility-ring"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Rollback</span>
                          </button>
                        )}

                        {isActive && (
                          <span className="text-xs font-bold text-[#15803d] bg-[#ecfdf5] px-2.5 py-1 rounded-xl border border-[#a7f3d0]">
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
      <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs text-[#64748b]">
        <div>
          Menampilkan <strong className="text-[#0f172a] font-mono">{items.length}</strong> dari{" "}
          <strong className="text-[#0f172a] font-mono">{totalCount}</strong> versi model
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="min-h-[36px] min-w-[36px] rounded-xl border border-[#cbd5e1] text-[#334155] font-bold hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all focus-utility-ring cursor-pointer flex items-center justify-center"
            title="Halaman sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-[#0f172a]">
            Halaman <span className="font-mono">{page}</span> dari <span className="font-mono">{Math.max(totalPages, 1)}</span>
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="min-h-[36px] min-w-[36px] rounded-xl border border-[#cbd5e1] text-[#334155] font-bold hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all focus-utility-ring cursor-pointer flex items-center justify-center"
            title="Halaman berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. Modal Konfirmasi Aktivasi (Hot-Reload) */}
      {modelToActivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs"
            onClick={() => setModelToActivate(null)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2e8f0] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#ecfdf5] text-[#15803d] flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">
                    Aktifkan Model ke Produksi
                  </h3>
                  <p className="text-xs text-[#64748b]">Hot-reload tanpa downtime sistem</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModelToActivate(null)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-slate-100 transition-colors cursor-pointer focus-utility-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-[#fef2f2] text-[#b91c1c] text-xs border border-[#fecaca]">
                {actionError}
              </div>
            )}

            <div className="p-6 space-y-4 text-xs">
              <p className="text-[#334155] leading-relaxed">
                Anda akan mempromosikan model <strong className="text-[#0f172a] font-mono">{modelToActivate.version}</strong> ke status <strong className="text-[#15803d]">ACTIVE</strong>. Model aktif saat ini akan otomatis diarsipkan (ARCHIVED) dan inferensi ulasan berikutnya seketika beralih ke model ini tanpa downtime.
              </p>

              <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#64748b]">Akurasi Benchmark:</span>
                  <span className="font-mono font-bold text-[#15803d]">
                    {modelToActivate.accuracyScore ? `${modelToActivate.accuracyScore.toFixed(1)}%` : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748b]">Character Error Rate (CER):</span>
                  <span className="font-mono font-bold text-[#0369a1]">
                    {modelToActivate.cerScore ? `${modelToActivate.cerScore.toFixed(2)}%` : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModelToActivate(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-xl transition-all cursor-pointer focus-utility-ring"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmActivate}
                disabled={activateMutation.isPending}
                className="min-h-[44px] px-5 py-2 text-xs font-bold text-white bg-[#00a2b9] hover:bg-[#008c9f] rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring"
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
            className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs"
            onClick={() => setModelToRollback(null)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2e8f0] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#fff7ed] text-[#b45309] flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">
                    Rollback ke Versi {modelToRollback.version}
                  </h3>
                  <p className="text-xs text-[#64748b]">Pemulihan versi stabil sebelumnya</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModelToRollback(null)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-slate-100 transition-colors cursor-pointer focus-utility-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-[#fef2f2] text-[#b91c1c] text-xs border border-[#fecaca]">
                {actionError}
              </div>
            )}

            <div className="p-6 space-y-4 text-xs">
              <p className="text-[#334155] leading-relaxed">
                Tindakan ini akan mengembalikan model produksi ke versi <strong className="text-[#0f172a] font-mono">{modelToRollback.version}</strong>. Gunakan jika ditemukan anomali inferensi atau penurunan akurasi di lapangan.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                  Alasan Rollback (Wajib dicatat di Audit Log)
                </label>
                <textarea
                  rows={2}
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Contoh: Ditemukan false negative pada ulasan bintang 5 berspasi lebar"
                  className="w-full text-xs p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#0f172a] placeholder-[#94a3b8] transition-all focus-utility-ring"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModelToRollback(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-xl transition-all cursor-pointer focus-utility-ring"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRollback}
                disabled={rollbackMutation.isPending}
                className="min-h-[44px] px-5 py-2 text-xs font-bold text-white bg-[#b45309] hover:bg-amber-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring"
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
            className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs"
            onClick={() => setModelToReject(null)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2e8f0] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#fef2f2] text-[#b91c1c] flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">
                    Tolak Model Staging {modelToReject.version}
                  </h3>
                  <p className="text-xs text-[#64748b]">Pengubahan status menjadi REJECTED</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModelToReject(null)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-slate-100 transition-colors cursor-pointer focus-utility-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-[#fef2f2] text-[#b91c1c] text-xs border border-[#fecaca]">
                {actionError}
              </div>
            )}

            <div className="p-6 space-y-4 text-xs">
              <p className="text-[#334155] leading-relaxed">
                Model ini tidak akan dapat diaktifkan ke produksi kecuali dilatih ulang. Status model akan diubah menjadi <strong className="text-[#b91c1c]">REJECTED</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                  Alasan Penolakan
                </label>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Contoh: Skor CER melebihi batas toleransi 5%"
                  className="w-full text-xs p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#0f172a] placeholder-[#94a3b8] transition-all focus-utility-ring"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModelToReject(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-xl transition-all cursor-pointer focus-utility-ring"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending}
                className="min-h-[44px] px-5 py-2 text-xs font-bold text-white bg-[#b91c1c] hover:bg-rose-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring"
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

