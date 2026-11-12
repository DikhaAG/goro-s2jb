"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  XCircle,
  Clock,
  User,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { EvidenceLightbox } from "@/components/operator/EvidenceLightbox";
import { hasConfirmedDuplicate } from "./duplicateDisplay";

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

const reviewDetailSchema = z.object({
  playstoreReviewerName: z.string().min(1, "Nama pengulas Play Store wajib diisi."),
  originalReviewerName: z.string().optional(),
  up3Id: z.string().min(1, "Unit UP3 wajib dipilih."),
  ulpId: z.string().min(1, "Unit ULP wajib dipilih."),
  entryDate: z.string().optional(),
  reviewerCategory: z.string(),
  validationStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  isDuplicate: z.boolean(),
  fieldNotes: z.string().optional(),
  reviewRemarks: z.string().optional(),
});

type ReviewDetailFormData = z.infer<typeof reviewDetailSchema>;

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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // React Hook Form implementation
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ReviewDetailFormData>({
    resolver: zodResolver(reviewDetailSchema),
    defaultValues: {
      playstoreReviewerName: "",
      originalReviewerName: "",
      up3Id: "",
      ulpId: "",
      entryDate: "",
      reviewerCategory: "Pelanggan",
      validationStatus: "PENDING",
      isDuplicate: false,
      fieldNotes: "",
      reviewRemarks: "",
    },
    mode: "onSubmit",
  });

  // Watch up3Id for cascading ULP options without re-rendering the whole drawer
  const selectedUp3Id = useWatch({ control, name: "up3Id" });
  const filteredUlps = useMemo(() => {
    return selectedUp3Id ? ulps.filter((u) => u.up3Id === selectedUp3Id) : ulps;
  }, [selectedUp3Id, ulps]);

  // Fetch full review detail including audit logs
  const {
    data: detailData,
    isLoading: isDetailLoading,
    refetch: refetchDetail,
  } = trpc.reviews.getDetail.useQuery(
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

  // Populate React Hook Form state when detailData arrives
  useEffect(() => {
    if (detailData?.review) {
      const rev = detailData.review;
      reset({
        playstoreReviewerName: rev.playstoreReviewerName || "",
        originalReviewerName: rev.originalReviewerName || "",
        up3Id: rev.up3Id || "",
        ulpId: rev.ulpId || "",
        entryDate: rev.entryDate
          ? new Date(rev.entryDate).toISOString().split("T")[0]
          : "",
        reviewerCategory: rev.reviewerCategory || "Pelanggan",
        validationStatus: (rev.validationStatus as any) || "PENDING",
        isDuplicate: Boolean(rev.isDuplicate),
        fieldNotes: rev.fieldNotes || "",
        reviewRemarks: rev.reviewRemarks || "",
      });
      setFormError(null);
      setFormSuccess(null);
      setZoom(1);
      setRotation(0);
    }
  }, [detailData, reset]);

  if (!isOpen) return null;

  const review = detailData?.review;
  const auditLogs = detailData?.auditLogs || [];

  const handleCopyOcr = () => {
    if (review?.extractedOcrText) {
      navigator.clipboard.writeText(review.extractedOcrText);
      setHasCopiedOcr(true);
      setTimeout(() => setHasCopiedOcr(false), 2000);
    }
  };

  const onSubmit = (data: ReviewDetailFormData) => {
    if (!reviewId) return;

    updateMutation.mutate({
      id: reviewId,
      playstoreReviewerName: data.playstoreReviewerName.trim(),
      originalReviewerName: data.originalReviewerName?.trim() || undefined,
      up3Id: data.up3Id,
      ulpId: data.ulpId,
      entryDate: data.entryDate ? new Date(data.entryDate) : undefined,
      reviewerCategory: data.reviewerCategory,
      validationStatus: data.validationStatus,
      isDuplicate: data.isDuplicate,
      fieldNotes: data.fieldNotes?.trim() || undefined,
      reviewRemarks: data.reviewRemarks?.trim() || undefined,
    });
  };

  const handleRetryOcr = () => {
    if (!reviewId) return;
    retryOcrMutation.mutate({ reviewId });
  };

  const imageUrl = review?.evidenceImagePath
    ? review.evidenceImagePath.startsWith("http")
      ? `/api/evidence/proxy/${review.id}`
      : review.evidenceImagePath.startsWith("/")
      ? `/api/uploads${review.evidenceImagePath}`
      : `/api/uploads/${review.evidenceImagePath}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop with transition */}
      <div
        className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-Over Drawer Sheet */}
      <div
        className="relative w-full max-w-5xl xl:max-w-6xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-[#e2e8f0] transition-transform duration-300 animate-in slide-in-from-right ease-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Sticky Header */}
        <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center border border-[#cfdaf2] shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="drawer-title"
                  className="text-base font-bold text-[#0f172a] truncate"
                >
                  Inspeksi & Koreksi Ulasan
                </h2>
                {review && (
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0",
                      review.validationStatus === "APPROVED" &&
                        "bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]",
                      review.validationStatus === "REJECTED" &&
                        "bg-[#fef2f2] text-[#b91c1c] border border-[#fee2e2]",
                      review.validationStatus === "PENDING" &&
                        "bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]"
                    )}
                  >
                    {review.validationStatus === "APPROVED" ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
                        <span>Disetujui</span>
                      </>
                    ) : review.validationStatus === "REJECTED" ? (
                      <>
                        <XCircle className="w-3 h-3 text-[#ef4444]" />
                        <span>Ditolak</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-[#f97316]" />
                        <span>Menunggu Triase</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#64748b] font-mono mt-0.5 truncate">
                ID: {reviewId}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#64748b] flex items-center justify-center transition-colors cursor-pointer focus-utility-ring shadow-xs shrink-0"
            title="Tutup lembar inspeksi [Esc]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body: 2 Independent Scrolling Columns */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-[#e2e8f0]">
          {/* Left Column: Media & OCR Inspection (Scrolls independently) */}
          <div className="w-full lg:w-[48%] h-full overflow-y-auto p-5 bg-[#f8fafc] flex flex-col space-y-4">
            {/* High-Res Image Viewport with Dark Studio Canvas & Next.js Image */}
            <div className="relative w-full h-[460px] lg:h-[500px] bg-[#0b1120] rounded-2xl border border-[#1e293b] overflow-hidden flex flex-col shadow-inner group/canvas">
              {/* Floating Top Left Context Badge */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
                <span className="text-[11px] font-semibold text-white/90 bg-[#0f172a]/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 shadow-sm">
                  Citra Eviden Tangkapan Layar
                </span>
                {hasConfirmedDuplicate(review) && (
                  <span className="text-[10px] font-extrabold text-white bg-[#7e22ce] px-2 py-0.5 rounded-md shadow-sm">
                    DUP (pHash)
                  </span>
                )}
              </div>

              {/* Floating Top Right HUD Controls Toolbar */}
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-[#0f172a]/85 backdrop-blur-md border border-white/10 rounded-xl p-1 text-white shadow-lg">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(prev + 0.25, 3))}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Perbesar Citra (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono font-bold px-1.5 text-[#38bdf8] min-w-[38px] text-center select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Perkecil Citra (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
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
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Reset Ukuran & Posisi"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Buka Layar Penuh (Lightbox)"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scrollable Viewport with Centered Responsive Next.js Image */}
              <div className="flex-1 w-full h-full overflow-auto flex p-4 scrollbar-thin scrollbar-thumb-white/20">
                {imageUrl ? (
                  <div
                    className="m-auto relative transition-transform duration-200 ease-out origin-center"
                    style={{
                      width: "100%",
                      height: "100%",
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  >
                    <Image
                      src={imageUrl}
                      alt={`Eviden ${review?.playstoreReviewerName || "Review"}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-contain drop-shadow-2xl select-none pointer-events-none"
                      unoptimized
                      priority
                    />
                  </div>
                ) : (
                  <div className="m-auto text-center p-8 text-xs text-slate-400">
                    Tidak ada citra eviden tersedia.
                  </div>
                )}
              </div>

              {/* Bottom Canvas Context Bar */}
              <div className="shrink-0 h-8 px-4 bg-[#090d16]/90 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate max-w-[280px]">
                  {review?.playstoreReviewerName || "Eviden"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="text-[#38bdf8] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <span>Buka Lightbox Penuh</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Detailed Duplication Breakdown Card */}
            {hasConfirmedDuplicate(review) ? (
              <div className="rounded-2xl border border-[#e9d5ff] bg-[#faf5ff] p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4 text-[#7e22ce]" />
                    <span className="text-xs font-bold text-[#581c87] uppercase tracking-wider">
                      Terindikasi Duplikasi Visual
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7e22ce] text-white">
                    Duplikat pHash
                  </span>
                </div>

                {(review as any)?.duplicateOf ? (
                  <div className="p-3 bg-white rounded-xl border border-[#ddd6fe] text-xs space-y-2">
                    <div className="text-[11px] text-[#64748b]">
                      Tangkapan layar ini terdeteksi identik secara visual dengan ulasan pertama:
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0f172a] text-sm font-mono truncate">
                        {(review as any).duplicateOf.playstoreReviewerName}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-[#7e22ce] bg-[#f5f3ff] px-2 py-0.5 rounded shrink-0">
                        {new Date((review as any).duplicateOf.entryDate).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#64748b] flex flex-wrap items-center gap-2 pt-1 border-t border-[#f1f5f9]">
                      <span>
                        Unit: <strong className="text-[#334155]">{(review as any).duplicateOf.up3?.name || "-"} / {(review as any).duplicateOf.ulp?.name || "-"}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Status: <strong className="text-[#334155]">{(review as any).duplicateOf.validationStatus}</strong>
                      </span>
                      {(review as any).duplicateOf.confidenceScore !== null && (
                        <>
                          <span>•</span>
                          <span>
                            Skor: <strong className="text-[#334155]">{(review as any).duplicateOf.confidenceScore.toFixed(1)}%</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#6b21a8] leading-relaxed">
                    {review?.reviewRemarks || "Terindikasi duplikasi citra bukti (Hamming Distance <= 5) terhadap entri yang tersimpan di sistem."}
                  </p>
                )}
              </div>
            ) : review?.ocrStatus === "FAILED" && review?.reviewRemarks ? (
              <div className="rounded-2xl border border-[#fee2e2] bg-[#fef2f2] p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#991b1b] uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 text-[#dc2626]" />
                  <span>Pemrosesan OCR Gagal</span>
                </div>
                <p className="text-xs text-[#991b1b] leading-relaxed break-words">
                  {review.reviewRemarks}
                </p>
              </div>
            ) : null}

            {/* OCR Extracted Text Section */}
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0f172a]">
                  Teks Hasil Ekstraksi OCR
                </span>
                <button
                  type="button"
                  onClick={handleCopyOcr}
                  className="text-xs text-[#006877] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  {hasCopiedOcr ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#16a34a]" />
                      <span className="text-[#16a34a]">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Teks OCR</span>
                    </>
                  )}
                </button>
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

          {/* Right Column: Metadata Form & Audit Log (With Sticky Footer) */}
          <div className="w-full lg:w-[52%] h-full flex flex-col bg-white overflow-hidden">
            {/* Tabs Header */}
            <div className="shrink-0 flex border-b border-[#e2e8f0] px-6 pt-3 bg-white">
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
              <form
                id="review-edit-form"
                onSubmit={handleSubmit(onSubmit)}
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
              >
                {/* Scrollable Form Fields */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {formError && (
                    <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-[#dc2626]" />
                      <span>{formError}</span>
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
                      {...register("playstoreReviewerName")}
                      className={cn(
                        "w-full min-h-[42px] px-3.5 rounded-xl border bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium",
                        errors.playstoreReviewerName ? "border-[#ef4444]" : "border-[#cbd5e1]"
                      )}
                    />
                    {errors.playstoreReviewerName ? (
                      <p className="text-[11px] text-[#ef4444] mt-1">
                        {errors.playstoreReviewerName.message}
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#64748b] mt-1">
                        Nama persis yang tertera pada tangkapan layar ulasan Play Store.
                      </p>
                    )}
                  </div>

                  {/* Nama Akun Pengisi Form */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                      Nama Akun Pengisi Google Form
                    </label>
                    <input
                      type="text"
                      {...register("originalReviewerName")}
                      className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                    />
                  </div>

                  {/* Unit Cascading: UP3 & ULP */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                        Unit Pelaksana Pelayanan (UP3) *
                      </label>
                      <select
                        {...register("up3Id", {
                          onChange: () => {
                            setValue("ulpId", "");
                          },
                        })}
                        className={cn(
                          "w-full min-h-[42px] px-3 rounded-xl border bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium",
                          errors.up3Id ? "border-[#ef4444]" : "border-[#cbd5e1]"
                        )}
                      >
                        <option value="">Pilih UP3</option>
                        {up3s.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      {errors.up3Id && (
                        <p className="text-[11px] text-[#ef4444] mt-1">{errors.up3Id.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                        Unit Layanan Pelanggan (ULP) *
                      </label>
                      <select
                        {...register("ulpId")}
                        disabled={!selectedUp3Id}
                        className={cn(
                          "w-full min-h-[42px] px-3 rounded-xl border bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium disabled:opacity-50",
                          errors.ulpId ? "border-[#ef4444]" : "border-[#cbd5e1]"
                        )}
                      >
                        <option value="">Pilih ULP</option>
                        {filteredUlps.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      {errors.ulpId && (
                        <p className="text-[11px] text-[#ef4444] mt-1">{errors.ulpId.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Tanggal Entri & Kategori */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                        Tanggal Entri Ulasan
                      </label>
                      <input
                        type="date"
                        {...register("entryDate")}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                        Kategori Pengulas
                      </label>
                      <select
                        {...register("reviewerCategory")}
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

                  {/* Status Validasi */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                      Status Validasi (Manual Override)
                    </label>
                    <select
                      {...register("validationStatus")}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold text-[#0f172a] focus:bg-white focus-utility-ring"
                    >
                      <option value="PENDING">Menunggu Triase (PENDING)</option>
                      <option value="APPROVED">Lolos Validasi (APPROVED)</option>
                      <option value="REJECTED">Ditolak (REJECTED)</option>
                    </select>
                  </div>

                  {/* Dedicated Duplication Checkbox Card */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#e9d5ff] bg-[#faf5ff] cursor-pointer hover:bg-[#f5f3ff] transition-colors">
                    <input
                      type="checkbox"
                      {...register("isDuplicate")}
                      className="w-4 h-4 mt-0.5 rounded border-[#cbd5e1] text-[#7e22ce] focus:ring-[#9333ea]"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[#581c87] block">
                        Tandai Sebagai Duplikat Visual
                      </span>
                      <span className="text-[11px] text-[#7e22ce]/80 block mt-0.5 leading-relaxed">
                        Indikasikan bahwa tangkapan layar ulasan ini identik dengan ulasan lain di sistem (anti-fraud pHash).
                      </span>
                    </div>
                  </label>

                  {/* Catatan Lapangan */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
                      Catatan Lapangan (Field Notes)
                    </label>
                    <textarea
                      rows={2}
                      {...register("fieldNotes")}
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
                      {...register("reviewRemarks")}
                      placeholder="Alasan perubahan atau catatan kuratif operator..."
                      className="w-full p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
                    />
                  </div>
                </div>

                {/* Sticky Drawer Footer with Action Buttons */}
                <div className="shrink-0 p-4 border-t border-[#e2e8f0] bg-white/95 backdrop-blur-xs flex items-center justify-between gap-3">
                  <div className="text-xs text-[#64748b]">
                    {isDirty ? (
                      <span className="inline-flex items-center gap-1.5 text-[#b45309] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse" />
                        <span>Perubahan belum disimpan</span>
                      </span>
                    ) : (
                      <span className="text-[#94a3b8]">Data sinkron</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[40px] h-10 px-4 rounded-xl border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] text-xs font-semibold transition-colors cursor-pointer focus-utility-ring shadow-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending || isSubmitting}
                      className="min-h-[40px] h-10 px-5 rounded-xl bg-[#00a2b9] hover:bg-[#008b9e] text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring active:scale-95"
                    >
                      {updateMutation.isPending || isSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Simpan Perubahan</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Tab 2: Audit Log Trail (Scrolls independently) */}
            {activeTab === "audit" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-3">
                <div className="text-xs text-[#64748b] mb-2 leading-relaxed">
                  Rekaman seluruh perubahan data dan riwayat intervensi operator tercatat secara transparan pada basis data.
                </div>

                {auditLogs.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#94a3b8]">
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

      {/* Direct Lightbox Integration from Drawer */}
      {isLightboxOpen && review && (
        <EvidenceLightbox
          item={review as any}
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </div>
  );
}
