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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Disetujui Latih
          </span>
        );
      case OcrSampleInclusion.PENDING_REVIEW:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Menunggu Review
          </span>
        );
      case OcrSampleInclusion.EXCLUDED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header & Filter Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-600" />
            Kurasi & Inspeksi Sampel Data Latih
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola pasangan citra eviden dan teks ground truth yang digunakan dalam proses training.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari pengulas / teks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Inclusion Filter */}
          <select
            value={inclusion}
            onChange={(e) => {
              setInclusion(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
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
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">Semua Sumber</option>
            <option value="TRIAGE_VALIDATION">Triase Operator</option>
            <option value="IMPORT_SPREADSHEET">Impor Spreadsheet</option>
            <option value="MANUAL_CURATION">Kurasi Manual</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Samples Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Eviden</th>
              <th className="py-3 px-4">Teks Ground Truth</th>
              <th className="py-3 px-4">Ekstraksi Awal</th>
              <th className="py-3 px-4">Sumber Data</th>
              <th className="py-3 px-4">Status Inklusi</th>
              <th className="py-3 px-4 text-right">Aksi Kurasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
                  Memuat data latih...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  Tidak ada sampel data latih yang cocok dengan kriteria pencarian.
                </td>
              </tr>
            ) : (
              items.map((sample: any) => (
                <tr key={sample.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Image Thumbnail */}
                  <td className="py-2.5 px-4">
                    <div
                      onClick={() => setPreviewImage(sample.imagePath)}
                      className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-sky-500 relative flex items-center justify-center group shrink-0"
                    >
                      {sample.imagePath ? (
                        <img
                          src={sample.imagePath.startsWith("/") ? sample.imagePath : `/${sample.imagePath}`}
                          alt="Thumbnail Eviden"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>
                  </td>

                  {/* Ground Truth Text */}
                  <td className="py-2.5 px-4 font-medium text-slate-900 max-w-xs">
                    <div className="font-semibold">{sample.groundTruthText}</div>
                    <div className="text-[11px] text-slate-500">
                      Pengulas: {sample.reviewerName || "-"}
                    </div>
                  </td>

                  {/* Initial OCR Extracted Text */}
                  <td className="py-2.5 px-4 text-slate-600 max-w-xs">
                    <div className="font-mono text-[11px] text-slate-700 truncate">
                      {sample.extractedText || "(Kosong)"}
                    </div>
                    {sample.ocrConfidence !== null && (
                      <span className="text-[10px] text-slate-400">
                        Confidence: {Math.round(sample.ocrConfidence)}%
                      </span>
                    )}
                  </td>

                  {/* Source */}
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-slate-800 text-xs">
                      {renderSourceLabel(sample.source)}
                    </span>
                    <span className="text-slate-400 text-[10px] block">
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
                      <div className="text-[10px] text-rose-600 italic mt-0.5 truncate max-w-xs">
                        {sample.exclusionReason}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {sample.inclusion !== OcrSampleInclusion.APPROVED_FOR_TRAIN && (
                        <button
                          type="button"
                          onClick={() => handleApprove(sample.id)}
                          className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold transition-colors"
                        >
                          Sertakan
                        </button>
                      )}

                      {sample.inclusion !== OcrSampleInclusion.EXCLUDED && (
                        <button
                          type="button"
                          onClick={() => setSampleToExclude(sample)}
                          className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition-colors"
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
      <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
        <div>
          Menampilkan <strong className="text-slate-900">{items.length}</strong> dari{" "}
          <strong className="text-slate-900">{totalCount}</strong> sampel data latih
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

      {/* Modal Pratinjau Citra Eviden */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs"
            onClick={() => setPreviewImage(null)}
          />
          <div className="relative bg-slate-900 rounded-2xl max-w-xl w-full p-4 shadow-2xl border border-slate-800 z-10 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h4 className="text-xs font-semibold text-slate-300">Pratinjau Citra Eviden Latih</h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black/40 rounded-xl p-2">
              <img
                src={previewImage.startsWith("/") ? previewImage : `/${previewImage}`}
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
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setSampleToExclude(null)}
          />
          <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 text-rose-600">
                <XCircle className="w-4 h-4" />
                Kecualikan Sampel dari Dataset Latih
              </h3>
              <button
                type="button"
                onClick={() => setSampleToExclude(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Sampel dengan ground truth <strong className="text-slate-900">"{sampleToExclude.groundTruthText}"</strong> tidak akan dimasukkan ke dalam batch training berikutnya.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Pengecualian (Wajib Diisi)
              </label>
              <textarea
                rows={2}
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value)}
                placeholder="Contoh: Gambar buram / resolusi terlalu rendah / teks nama terpotong"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-slate-900"
              />
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSampleToExclude(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmExclude}
                disabled={updateInclusionMutation.isPending}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
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
