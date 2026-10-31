"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  RefreshCw,
  Copy,
  Check,
  History,
  FileText,
  Save,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  User,
} from "lucide-react";

interface Up3Option {
  id: string;
  code: string;
  name: string;
}

interface UlpOption {
  id: string;
  code: string;
  name: string;
  up3Id: string;
}

interface ReviewDetailDrawerProps {
  reviewId: string | null;
  isOpen: boolean;
  onClose: () => void;
  up3s: Up3Option[];
  ulps: UlpOption[];
  onReviewUpdated: () => void;
}

export function ReviewDetailDrawer({
  reviewId,
  isOpen,
  onClose,
  up3s,
  ulps,
  onReviewUpdated,
}: ReviewDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "audit">("edit");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [hasCopiedOcr, setHasCopiedOcr] = useState(false);

  // Form State
  const [playstoreReviewerName, setPlaystoreReviewerName] = useState("");
  const [originalReviewerName, setOriginalReviewerName] = useState("");
  const [up3Id, setUp3Id] = useState("");
  const [ulpId, setUlpId] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [reviewerCategory, setReviewerCategory] = useState("Pelanggan");
  const [validationStatus, setValidationStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [fieldNotes, setFieldNotes] = useState("");
  const [reviewRemarks, setReviewRemarks] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Fetch full review detail including audit logs
  const { data: detailData, isLoading: isDetailLoading, refetch: refetchDetail } =
    trpc.reviews.getDetail.useQuery(
      { id: reviewId ?? "" },
      {
        enabled: isOpen && Boolean(reviewId),
      }
    );

  // tRPC Mutations
  const updateMutation = trpc.reviews.update.useMutation({
    onSuccess: () => {
      setFormSuccess("Data ulasan berhasil diperbarui.");
      setFormError(null);
      refetchDetail();
      onReviewUpdated();
      setTimeout(() => setFormSuccess(null), 3500);
    },
    onError: (err) => {
      setFormError(err.message || "Gagal memperbarui data ulasan.");
      setFormSuccess(null);
    },
  });

  const retryOcrMutation = trpc.reviews.retryOcr.useMutation({
    onSuccess: () => {
      setFormSuccess("Pekerjaan OCR berhasil dimasukkan ke antrean berprioritas tinggi.");
      refetchDetail();
      onReviewUpdated();
      setTimeout(() => setFormSuccess(null), 3500);
    },
    onError: (err) => {
      setFormError(err.message || "Gagal memicu ulang OCR.");
    },
  });

  // Populate form state when detailData arrives
  useEffect(() => {
    if (detailData?.review) {
      const rev = detailData.review;
      setPlaystoreReviewerName(rev.playstoreReviewerName || "");
      setOriginalReviewerName(rev.originalReviewerName || "");
      setUp3Id(rev.up3Id || "");
      setUlpId(rev.ulpId || "");
      setEntryDate(
        rev.entryDate
          ? new Date(rev.entryDate).toISOString().split("T")[0]
          : ""
      );
      setReviewerCategory(rev.reviewerCategory || "Pelanggan");
      setValidationStatus(rev.validationStatus as any);
      setIsDuplicate(rev.isDuplicate || false);
      setFieldNotes(rev.fieldNotes || "");
      setReviewRemarks(rev.reviewRemarks || "");
      setFormError(null);
      setFormSuccess(null);
      setZoom(1);
      setRotation(0);
    }
  }, [detailData]);

  if (!isOpen) return null;

  const review = detailData?.review;
  const auditLogs = detailData?.auditLogs || [];

  const filteredUlps = up3Id
    ? ulps.filter((u) => u.up3Id === up3Id)
    : ulps;

  const handleCopyOcr = () => {
    if (review?.extractedOcrText) {
      navigator.clipboard.writeText(review.extractedOcrText);
      setHasCopiedOcr(true);
      setTimeout(() => setHasCopiedOcr(false), 2000);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewId) return;

    if (!playstoreReviewerName.trim()) {
      setFormError("Nama pengulas Play Store wajib diisi.");
      return;
    }

    if (!up3Id || !ulpId) {
      setFormError("Unit UP3 dan ULP wajib dipilih.");
      return;
    }

    updateMutation.mutate({
      id: reviewId,
      playstoreReviewerName: playstoreReviewerName.trim(),
      originalReviewerName: originalReviewerName.trim() || undefined,
      up3Id,
      ulpId,
      entryDate: entryDate ? new Date(entryDate) : undefined,
      reviewerCategory,
      validationStatus,
      isDuplicate,
      fieldNotes: fieldNotes.trim() || undefined,
      reviewRemarks: reviewRemarks.trim() || undefined,
    });
  };

  const handleRetryOcr = () => {
    if (!reviewId) return;
    retryOcrMutation.mutate({ reviewId });
  };

  const proxyImageUrl = reviewId
    ? `/api/evidence/proxy/${reviewId}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-Over Drawer Sheet (Apple Design) */}
      <div
        className="relative w-full max-w-5xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-[#e2e8f0] transition-transform duration-300 animate-in slide-in-from-right ease-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Drawer Header (Matching TriageHeader & HomePageClient) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center border border-[#cfdaf2]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="drawer-title"
                className="text-base font-bold text-[#0f172a] leading-tight"
              >
                Inspeksi & Koreksi Ulasan
              </h2>
              <p className="text-xs text-[#64748b] font-mono mt-0.5">
                ID: {reviewId}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#64748b] flex items-center justify-center transition-colors cursor-pointer focus-utility-ring shadow-xs"
              title="Tutup lembar inspeksi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[#e2e8f0]">
          {/* Left Column: Evidence Viewer & OCR Extraction */}
          <div className="w-full lg:w-1/2 p-5 bg-[#f8fafc] flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0f172a] uppercase tracking-wider">
                Citra Eviden Tangkapan Layar
              </span>

              {/* Viewer Controls */}
              <div className="flex items-center gap-1 bg-white border border-[#cbd5e1] rounded-xl p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(prev + 0.25, 3))}
                  className="p-1.5 text-[#475569] hover:text-[#0f172a] rounded-lg hover:bg-[#f8fafc] cursor-pointer"
                  title="Perbesar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
                  className="p-1.5 text-[#475569] hover:text-[#0f172a] rounded-lg hover:bg-[#f8fafc] cursor-pointer"
                  title="Perkecil"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="p-1.5 text-[#475569] hover:text-[#0f172a] rounded-lg hover:bg-[#f8fafc] cursor-pointer"
                  title="Putar 90 Derajat"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="p-1.5 text-[#475569] hover:text-[#0f172a] rounded-lg hover:bg-[#f8fafc] cursor-pointer"
                  title="Atur Ulang Tampilan"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Image Canvas Container */}
            <div className="relative w-full h-80 rounded-2xl border border-[#cbd5e1] bg-[#0f172a]/5 flex items-center justify-center overflow-hidden">
              {isDetailLoading ? (
                <div className="flex flex-col items-center gap-2 text-[#64748b]">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#006877]" />
                  <span className="text-xs">Memuat berkas eviden...</span>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={proxyImageUrl}
                  alt={`Eviden ulasan ${review?.playstoreReviewerName || ""}`}
                  className="max-h-full max-w-full object-contain transition-transform duration-150 select-none"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              )}

              {/* pHash Duplication Banner */}
              {review?.isDuplicate && (
                <div className="absolute top-2 left-2 bg-[#7e22ce] text-white text-[10px] font-semibold px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Terindikasi Duplikat (pHash 64-bit)</span>
                </div>
              )}
            </div>

            {/* OCR Extracted Text Section */}
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#006877]" />
                  <span className="text-xs font-bold text-[#0f172a]">
                    Hasil Ekstraksi OCR Tesseract
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {review?.confidenceScore !== null && review?.confidenceScore !== undefined && (
                    <span className="text-[11px] font-bold font-mono text-[#006877] bg-[#e7eeff] border border-[#cfdaf2] px-2 py-0.5 rounded-md">
                      Skor: {review.confidenceScore.toFixed(1)}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyOcr}
                    className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer"
                    title="Salin teks OCR"
                  >
                    {hasCopiedOcr ? (
                      <Check className="w-3.5 h-3.5 text-[#16a34a]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-xs text-[#334155] font-mono bg-[#f8fafc] p-3 rounded-xl max-h-32 overflow-y-auto whitespace-pre-wrap border border-[#e2e8f0] leading-relaxed">
                {review?.extractedOcrText || (
                  <span className="text-[#94a3b8] italic">
                    Belum ada teks terekstraksi atau OCR gagal diproses.
                  </span>
                )}
              </div>

              {/* Retry OCR Button */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleRetryOcr}
                  disabled={retryOcrMutation.isPending}
                  className="min-h-[40px] h-10 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold inline-flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring"
                >
                  <RefreshCw
                    className={cn(
                      "w-3.5 h-3.5 text-[#006877]",
                      retryOcrMutation.isPending && "animate-spin"
                    )}
                  />
                  <span>Picu Ulang Pemrosesan OCR</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Metadata Form & Audit Log */}
          <div className="w-full lg:w-1/2 flex flex-col bg-white">
            {/* Tabs */}
            <div className="flex border-b border-[#e2e8f0] px-6 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className={cn(
                  "pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer focus-utility-ring",
                  activeTab === "edit"
                    ? "border-[#00a2b9] text-[#006877]"
                    : "border-transparent text-[#64748b] hover:text-[#0f172a]"
                )}
              >
                Informasi & Koreksi Metadata
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={cn(
                  "pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 cursor-pointer focus-utility-ring",
                  activeTab === "audit"
                    ? "border-[#00a2b9] text-[#006877]"
                    : "border-transparent text-[#64748b] hover:text-[#0f172a]"
                )}
              >
                <History className="w-3.5 h-3.5" />
                <span>Jejak Audit ({auditLogs.length})</span>
              </button>
            </div>

            {/* Tab 1: Edit Form */}
            {activeTab === "edit" && (
              <form onSubmit={handleSave} className="flex-1 p-6 space-y-4 overflow-y-auto">
                {formError && (
                  <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] font-medium">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="p-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-xs text-[#15803d] flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16a34a]" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {/* Nama Pengulas Play Store */}
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                    Nama Pengulas di Google Play Store *
                  </label>
                  <input
                    type="text"
                    value={playstoreReviewerName}
                    onChange={(e) => setPlaystoreReviewerName(e.target.value)}
                    required
                    className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                  />
                  <p className="text-[11px] text-[#64748b] mt-1">
                    Nama persis yang tertera pada tangkapan layar ulasan Play Store.
                  </p>
                </div>

                {/* Nama Akun Pengisi Form */}
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                    Nama Akun Pengisi Google Form
                  </label>
                  <input
                    type="text"
                    value={originalReviewerName}
                    onChange={(e) => setOriginalReviewerName(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                  />
                </div>

                {/* Unit Cascading: UP3 & ULP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                      Unit Pelaksana Pelayanan (UP3) *
                    </label>
                    <select
                      value={up3Id}
                      onChange={(e) => {
                        setUp3Id(e.target.value);
                        setUlpId("");
                      }}
                      required
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                    >
                      <option value="">Pilih UP3</option>
                      {up3s.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                      Unit Layanan Pelanggan (ULP) *
                    </label>
                    <select
                      value={ulpId}
                      onChange={(e) => setUlpId(e.target.value)}
                      required
                      disabled={!up3Id}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium disabled:opacity-50"
                    >
                      <option value="">Pilih ULP</option>
                      {filteredUlps.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tanggal Entri & Kategori */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                      Tanggal Entri Ulasan
                    </label>
                    <input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                      Kategori Pengulas
                    </label>
                    <select
                      value={reviewerCategory}
                      onChange={(e) => setReviewerCategory(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                    >
                      <option value="Pelanggan">Pelanggan</option>
                      <option value="Pegawai PLN">Pegawai PLN</option>
                      <option value="Tenaga Alih Daya">Tenaga Alih Daya</option>
                      <option value="Mitra Kerja">Mitra Kerja</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                </div>

                {/* Override Status Validasi & Duplikat */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#f1f5f9]">
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                      Status Validasi (Manual Override)
                    </label>
                    <select
                      value={validationStatus}
                      onChange={(e) => setValidationStatus(e.target.value as any)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold text-[#0f172a] focus:bg-white focus-utility-ring"
                    >
                      <option value="PENDING">Menunggu Triase (PENDING)</option>
                      <option value="APPROVED">Lolos Validasi (APPROVED)</option>
                      <option value="REJECTED">Ditolak (REJECTED)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center space-x-2 text-xs font-semibold text-[#0f172a] cursor-pointer min-h-[42px]">
                      <input
                        type="checkbox"
                        checked={isDuplicate}
                        onChange={(e) => setIsDuplicate(e.target.checked)}
                        className="w-4 h-4 rounded border-[#cbd5e1] text-[#7e22ce] focus:ring-[#9333ea]"
                      />
                      <span>Tandai Sebagai Duplikat Eviden</span>
                    </label>
                  </div>
                </div>

                {/* Catatan Lapangan */}
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                    Catatan Lapangan (Field Notes)
                  </label>
                  <textarea
                    rows={2}
                    value={fieldNotes}
                    onChange={(e) => setFieldNotes(e.target.value)}
                    placeholder="Catatan dari petugas saat pengunggahan..."
                    className="w-full p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                  />
                </div>

                {/* Catatan Verifikator / Remarks */}
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                    Catatan Verifikator / Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    placeholder="Alasan perubahan atau catatan kuratif operator..."
                    className="w-full p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-[#e2e8f0] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] h-11 px-4 rounded-xl border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] text-xs font-semibold transition-colors cursor-pointer focus-utility-ring shadow-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="min-h-[44px] h-11 px-5 rounded-xl bg-[#00a2b9] hover:bg-[#008b9e] text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring"
                  >
                    {updateMutation.isPending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Audit Log Trail */}
            {activeTab === "audit" && (
              <div className="flex-1 p-6 space-y-3 overflow-y-auto">
                <div className="text-xs text-[#64748b] mb-2">
                  Rekaman seluruh perubahan data dan riwayat intervensi operator tercatat secara transparan pada basis data.
                </div>

                {auditLogs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#94a3b8]">
                    Belum ada rekaman log audit untuk ulasan ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log: any) => (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] space-y-1.5 text-xs shadow-xs"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#0f172a]">
                            {log.action}
                          </span>
                          <span className="text-[#64748b] font-mono">
                            {new Date(log.createdAt).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#334155]">
                          <User className="w-3 h-3 text-[#64748b]" />
                          <span>
                            {log.user?.name || "Sistem Otomatis"} ({log.user?.role || "SYSTEM"})
                          </span>
                        </div>
                        {log.metadata && (
                          <pre className="text-[10px] font-mono bg-white p-2.5 rounded-lg border border-[#e2e8f0] overflow-x-auto text-[#334155]">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
