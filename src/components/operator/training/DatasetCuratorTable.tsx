"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { OcrSampleInclusion, OcrSampleSource } from "@prisma/client";
import {
  Database,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";

interface DatasetCuratorTableProps {
  onDatasetChanged: () => void;
}

export function DatasetCuratorTable({ onDatasetChanged }: DatasetCuratorTableProps) {
  const [search, setSearch] = useState("");
  const [inclusion, setInclusion] = useState<string>("ALL");
  const [source, setSource] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Modals state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [sampleToExclude, setSampleToExclude] = useState<any | null>(null);
  const [exclusionReason, setExclusionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const resolveImageSrc = (imgUrlOrPath: string, reviewId?: string) => {
    if (!imgUrlOrPath) return "";
    if (imgUrlOrPath.startsWith("http://") || imgUrlOrPath.startsWith("https://")) {
      return reviewId ? `/api/evidence/proxy/${reviewId}` : imgUrlOrPath;
    }
    return imgUrlOrPath.startsWith("/") ? imgUrlOrPath : `/${imgUrlOrPath}`;
  };

  const { data, isLoading, refetch } = trpc.ocrTraining.getSamples.useQuery({
    search: search.trim() || undefined,
    inclusion: inclusion === "ALL" ? undefined : (inclusion as OcrSampleInclusion),
    source: source === "ALL" ? undefined : (source as OcrSampleSource),
    page,
    pageSize,
  });

  const updateInclusionMutation = trpc.ocrTraining.updateSampleInclusion.useMutation({
    onSuccess: () => {
      setSampleToExclude(null);
      setExclusionReason("");
      refetch();
      onDatasetChanged();
    },
    onError: (err) => {
      setActionError(err.message || "Gagal memperbarui status kurasi sampel.");
    },
  });

  const handleApprove = (sampleId: string) => {
    setActionError(null);
    updateInclusionMutation.mutate({
      sampleId,
      inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN,
    });
  };

  const handleConfirmExclude = () => {
    if (!sampleToExclude) return;
    if (!exclusionReason.trim()) {
      setActionError("Mohon masukkan alasan pengecualian data latih.");
      return;
    }
    setActionError(null);
    updateInclusionMutation.mutate({
      sampleId: sampleToExclude.id,
      inclusion: OcrSampleInclusion.EXCLUDED,
      exclusionReason: exclusionReason.trim(),
    });
  };

  const items = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;

  const renderInclusionBadge = (inc: OcrSampleInclusion) => {
    switch (inc) {
      case OcrSampleInclusion.APPROVED_FOR_TRAIN:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
            Disetujui Latih
          </span>
        );
      case OcrSampleInclusion.PENDING_REVIEW:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            Menunggu Review
          </span>
        );
      case OcrSampleInclusion.EXCLUDED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
            <XCircle className="w-3.5 h-3.5 text-[#ef4444]" />
            Dikecualikan
          </span>
        );
    }
  };

  const renderSourceLabel = (src: OcrSampleSource) => {
    switch (src) {
      case OcrSampleSource.TRIAGE_VALIDATION:
        return "Triase Operator";
      case OcrSampleSource.IMPORT_SPREADSHEET:
        return "Impor Spreadsheet";
      case OcrSampleSource.MANUAL_CURATION:
        return "Kurasi Manual";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden">
      {/* Header & Filter Bar */}
      <div className="p-5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006877]/10 text-[#006877] flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              Kurasi & Inspeksi Sampel Data Latih
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Kelola pasangan citra eviden dan teks ground truth yang digunakan dalam proses training.
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari pengulas / teks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs pl-9 pr-3 py-2 min-h-[38px] rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#0f172a] placeholder-[#94a3b8] transition-all focus-utility-ring"
            />
          </div>

          {/* Inclusion Filter */}
          <select
            value={inclusion}
            onChange={(e) => {
              setInclusion(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 min-h-[38px] rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#0f172a] transition-all focus-utility-ring"
          >
            <option value="ALL">Semua Inklusi</option>
            <option value="APPROVED_FOR_TRAIN">Disetujui Latih</option>
            <option value="PENDING_REVIEW">Menunggu Review</option>
            <option value="EXCLUDED">Dikecualikan</option>
          </select>

          {/* Source Filter */}
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 min-h-[38px] rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#0f172a] transition-all focus-utility-ring"
          >
            <option value="ALL">Semua Sumber</option>
            <option value="TRIAGE_VALIDATION">Triase Operator</option>
            <option value="IMPORT_SPREADSHEET">Impor Spreadsheet</option>
            <option value="MANUAL_CURATION">Kurasi Manual</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="mx-5 mt-4 p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Samples Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Eviden</th>
              <th className="py-3 px-4">Teks Ground Truth</th>
              <th className="py-3 px-4">Ekstraksi Awal</th>
              <th className="py-3 px-4">Sumber Data</th>
              <th className="py-3 px-4">Status Inklusi</th>
              <th className="py-3 px-4 text-right">Aksi Kurasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#334155]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#64748b]">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#00a2b9] mb-2" />
                  Memuat data latih...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#64748b]">
                  Tidak ada sampel data latih yang cocok dengan kriteria pencarian.
                </td>
              </tr>
            ) : (
              items.map((sample: any) => (
                <tr key={sample.id} className="hover:bg-[#f8fafc] transition-colors">
                  {/* Image Thumbnail */}
                  <td className="py-2.5 px-4">
                    <div
                      onClick={() => setPreviewImage(resolveImageSrc(sample.imagePath, sample.reviewId))}
                      className="w-12 h-12 rounded-xl bg-slate-100 border border-[#cbd5e1] overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#00a2b9] relative flex items-center justify-center group shrink-0 transition-all"
                      title="Klik untuk melihat pratinjau penuh"
                    >
                      {sample.imagePath ? (
                        <img
                          src={resolveImageSrc(sample.imagePath, sample.reviewId)}
                          alt="Thumbnail Eviden"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                      )}
                      <div className="absolute inset-0 bg-[#0f172a]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>
                  </td>

                  {/* Ground Truth Text */}
                  <td className="py-2.5 px-4 font-medium text-[#0f172a] max-w-xs">
                    <div className="font-semibold text-xs text-[#0f172a]">{sample.groundTruthText}</div>
                    <div className="text-[11px] text-[#64748b] mt-0.5">
                      Pengulas: {sample.reviewerName || "-"}
                    </div>
                  </td>

                  {/* Initial OCR Extracted Text */}
                  <td className="py-2.5 px-4 text-[#334155] max-w-xs">
                    <div className="font-mono text-[11px] text-[#334155] truncate">
                      {sample.extractedText || "(Kosong)"}
                    </div>
                    {sample.ocrConfidence !== null && (
                      <span className="font-mono text-[10px] text-[#64748b] block mt-0.5">
                        Confidence: {Math.round(sample.ocrConfidence)}%
                      </span>
                    )}
                  </td>

                  {/* Source */}
                  <td className="py-2.5 px-4">
                    <span className="font-bold text-[#0f172a] text-xs">
                      {renderSourceLabel(sample.source)}
                    </span>
                    <span className="text-[#64748b] font-mono text-[10px] block mt-0.5">
                      {new Date(sample.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </td>

                  {/* Inclusion Status */}
                  <td className="py-2.5 px-4">
                    {renderInclusionBadge(sample.inclusion)}
                    {sample.exclusionReason && (
                      <div className="text-[10px] text-[#b91c1c] italic mt-1 truncate max-w-xs">
                        {sample.exclusionReason}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      {sample.inclusion !== OcrSampleInclusion.APPROVED_FOR_TRAIN && (
                        <button
                          type="button"
                          onClick={() => handleApprove(sample.id)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#ecfdf5] hover:bg-emerald-100 text-[#15803d] border border-[#a7f3d0] text-xs font-bold transition-all focus-utility-ring cursor-pointer"
                        >
                          Sertakan
                        </button>
                      )}

                      {sample.inclusion !== OcrSampleInclusion.EXCLUDED && (
                        <button
                          type="button"
                          onClick={() => setSampleToExclude(sample)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#fef2f2] hover:bg-rose-100 text-[#b91c1c] border border-[#fecaca] text-xs font-bold transition-all focus-utility-ring cursor-pointer"
                        >
                          Kecualikan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs text-[#64748b]">
        <div>
          Menampilkan <strong className="text-[#0f172a] font-mono">{items.length}</strong> dari{" "}
          <strong className="text-[#0f172a] font-mono">{totalCount}</strong> sampel data latih
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

      {/* Modal Pratinjau Citra Eviden */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-xs"
            onClick={() => setPreviewImage(null)}
          />
          <div className="relative bg-[#0f172a] rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-[#334155] z-10 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#334155] mb-3">
              <h4 className="text-xs font-bold text-[#f8fafc]">Pratinjau Citra Eviden Latih</h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-white transition-colors cursor-pointer focus-utility-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black/40 rounded-xl p-2 border border-[#334155]">
              <img
                src={previewImage.startsWith("http") || previewImage.startsWith("/") ? previewImage : `/${previewImage}`}
                alt="Pratinjau Penuh"
                className="max-h-[65vh] object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Pengecualian Sampel */}
      {sampleToExclude && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs"
            onClick={() => setSampleToExclude(null)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e2e8f0] z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#fef2f2] text-[#b91c1c] flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">
                    Kecualikan Sampel
                  </h3>
                  <p className="text-xs text-[#64748b]">Pengecualian dari dataset training</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSampleToExclude(null)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-slate-100 transition-colors cursor-pointer focus-utility-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-[#334155] leading-relaxed">
                Sampel dengan ground truth <strong className="text-[#0f172a]">"{sampleToExclude.groundTruthText}"</strong> tidak akan disertakan ke dalam batch training model berikutnya.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                  Alasan Pengecualian (Wajib Diisi)
                </label>
                <textarea
                  rows={2}
                  value={exclusionReason}
                  onChange={(e) => setExclusionReason(e.target.value)}
                  placeholder="Contoh: Gambar buram / resolusi terlalu rendah / teks nama terpotong"
                  className="w-full text-xs p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#0f172a] placeholder-[#94a3b8] transition-all focus-utility-ring"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSampleToExclude(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-bold text-[#334155] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-xl transition-all cursor-pointer focus-utility-ring"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmExclude}
                disabled={updateInclusionMutation.isPending}
                className="min-h-[44px] px-5 py-2 text-xs font-bold text-white bg-[#b91c1c] hover:bg-rose-700 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring"
              >
                {updateInclusionMutation.isPending ? "Menyimpan..." : "Kecualikan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
