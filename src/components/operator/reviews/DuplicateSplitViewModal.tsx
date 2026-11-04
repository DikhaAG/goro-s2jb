"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  X,
  Columns2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Calendar,
  MapPin,
  Smartphone,
  User,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Sparkles,
  Info,
  Eye,
  Layers,
  Split,
  SlidersHorizontal,
  ChevronsLeftRight,
  Play,
  Pause,
  ScanLine,
} from "lucide-react";
import { ReviewItem } from "./ReviewsTable";
import { EvidenceLightbox } from "@/components/operator/EvidenceLightbox";
import {
  calculateHammingDistance,
  calculateVisualSimilarity,
  calculateTextSimilarity,
  calculateReviewerSimilarity,
} from "@/lib/similarity";

export interface DuplicateSplitViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateReview: ReviewItem | null;
  onOpenFullDetail?: (review: ReviewItem) => void;
  onActionComplete?: () => void;
}

export function DuplicateSplitViewModal({
  isOpen,
  onClose,
  duplicateReview,
  onOpenFullDetail,
  onActionComplete,
}: DuplicateSplitViewModalProps) {
  // Main View Tab: "overview" (Data & Metadata) vs "image-diff" (Dedicated Image Studio)
  const [activeTab, setActiveTab] = useState<"overview" | "image-diff">("overview");

  // Image Comparison Studio Modes
  const [imageCompareMode, setImageCompareMode] = useState<
    "slider" | "side-by-side" | "overlay" | "difference"
  >("slider");

  // Studio Interactive States
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(50);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [studioZoom, setStudioZoom] = useState<number>(1);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  // Studio Image Loading & Error States
  const [isOriginalImgLoading, setIsOriginalImgLoading] = useState<boolean>(true);
  const [isCurrentImgLoading, setIsCurrentImgLoading] = useState<boolean>(true);
  const [hasOriginalImgError, setHasOriginalImgError] = useState<boolean>(false);
  const [hasCurrentImgError, setHasCurrentImgError] = useState<boolean>(false);
  const [imageReloadKey, setImageReloadKey] = useState<number>(0);

  // Overview Independent Zooms
  const [zoomLeft, setZoomLeft] = useState<number>(1);
  const [zoomRight, setZoomRight] = useState<number>(1);

  // Lightbox & Actions State
  const [lightboxItem, setLightboxItem] = useState<ReviewItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  // Slider container reference for drag tracking
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // Original target review ID from relationship
  const duplicateOfId =
    duplicateReview?.duplicateOfId || duplicateReview?.duplicateOf?.id || null;

  // Query comprehensive details of the original review
  const {
    data: originalDetailData,
    isLoading: isOriginalLoading,
  } = trpc.reviews.getDetail.useQuery(
    { id: duplicateOfId || "" },
    {
      enabled: isOpen && !!duplicateOfId,
      staleTime: 30000,
    }
  );

  // Mutations for verification decisions and duplicate flags
  const submitDecisionMutation = trpc.triage.submitDecision.useMutation();
  const updateReviewMutation = trpc.reviews.update.useMutation();

  // Reset zoom, error states, and lock body scroll on open
  useEffect(() => {
    if (isOpen) {
      setZoomLeft(1);
      setZoomRight(1);
      setStudioZoom(1);
      setSliderPosition(50);
      setOverlayOpacity(50);
      setIsBlinking(false);
      setActionError(null);
      setIsOriginalImgLoading(true);
      setIsCurrentImgLoading(true);
      setHasOriginalImgError(false);
      setHasCurrentImgError(false);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle curtain slider drag motion
  const updateSliderFromClientX = useCallback((clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(Math.round(percentage));
  }, []);

  useEffect(() => {
    if (!isDraggingSlider) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateSliderFromClientX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDraggingSlider(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSlider, updateSliderFromClientX]);

  // Auto-flicker / blink animation for overlay mode
  useEffect(() => {
    if (!isBlinking || activeTab !== "image-diff" || imageCompareMode !== "overlay") return;
    const interval = setInterval(() => {
      setOverlayOpacity((prev) => (prev <= 20 ? 80 : 20));
    }, 600);
    return () => clearInterval(interval);
  }, [isBlinking, activeTab, imageCompareMode]);

  // Keyboard hotkeys for power verifier
  useEffect(() => {
    if (!isOpen || lightboxItem) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        handleResolveAndApprove();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleConfirmReject();
      } else if (e.key === "1") {
        e.preventDefault();
        setActiveTab("overview");
      } else if (e.key === "2") {
        e.preventDefault();
        setActiveTab("image-diff");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, lightboxItem, duplicateReview, duplicateOfId]);

  // Derived original review record with fallback to partial data from table item
  const originalReview = useMemo(() => {
    if (originalDetailData?.review) {
      return originalDetailData.review;
    }
    if (duplicateReview?.duplicateOf) {
      return {
        id: duplicateReview.duplicateOf.id,
        source: duplicateReview.duplicateOf.source || "MIGRATION",
        timestamp: duplicateReview.duplicateOf.timestamp || null,
        createdAt: duplicateReview.duplicateOf.createdAt || null,
        playstoreReviewerName: duplicateReview.duplicateOf.playstoreReviewerName,
        originalReviewerName: duplicateReview.duplicateOf.originalReviewerName || null,
        entryDate: duplicateReview.duplicateOf.entryDate,
        evidenceImagePath: duplicateReview.duplicateOf.evidenceImagePath,
        evidenceImageHash: duplicateReview.duplicateOf.evidenceImageHash ?? null,
        confidenceScore: duplicateReview.duplicateOf.confidenceScore ?? null,
        validationStatus: duplicateReview.duplicateOf.validationStatus as any,
        extractedOcrText: duplicateReview.duplicateOf.extractedOcrText ?? null,
        up3: duplicateReview.duplicateOf.up3 || { name: "-" },
        ulp: duplicateReview.duplicateOf.ulp || { name: "-" },
        appVersion: { version: "-" },
        fieldNotes: null,
        reviewRemarks: null,
      };
    }
    return null;
  }, [originalDetailData, duplicateReview]);

  // Multimodal Similarity Comparisons (Visual pHash, OCR Text, and Reviewer Name)
  const visualSimilarity = useMemo(() => {
    return calculateVisualSimilarity(
      originalReview?.evidenceImageHash,
      duplicateReview?.evidenceImageHash
    );
  }, [originalReview?.evidenceImageHash, duplicateReview?.evidenceImageHash]);

  const textSimilarity = useMemo(() => {
    return calculateTextSimilarity(
      originalReview?.extractedOcrText,
      duplicateReview?.extractedOcrText
    );
  }, [originalReview?.extractedOcrText, duplicateReview?.extractedOcrText]);

  const reviewerSimilarity = useMemo(() => {
    return calculateReviewerSimilarity(
      originalReview?.playstoreReviewerName,
      duplicateReview?.playstoreReviewerName
    );
  }, [originalReview?.playstoreReviewerName, duplicateReview?.playstoreReviewerName]);

  const hammingDistance = useMemo(() => {
    return calculateHammingDistance(
      originalReview?.evidenceImageHash,
      duplicateReview?.evidenceImageHash
    );
  }, [originalReview?.evidenceImageHash, duplicateReview?.evidenceImageHash]);

  const isLikelyTemplateCollision =
    visualSimilarity >= 90 && textSimilarity < 70 && reviewerSimilarity < 75;

  if (!isOpen || !duplicateReview) return null;

  const currentReview = duplicateReview;

  // Format Date helper with optional seconds precision
  const formatDate = (dateValue?: string | Date | null, withSeconds: boolean = false) => {
    if (!dateValue) return "-";
    try {
      const d = new Date(dateValue);
      if (isNaN(d.getTime())) return String(dateValue);
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        ...(withSeconds ? { second: "2-digit" } : {}),
      }).format(d);
    } catch {
      return String(dateValue);
    }
  };

  // Helper to extract true submission datetime reference:
  // Khusus data hasil migrasi spreadsheet: data acuan adalah Column 1 pada CSV/XLSX (disimpan di field timestamp),
  // BUKAN berdasarkan timestamp saat proses migrasi dieksekusi (createdAt).
  // Untuk data dari /intake: timestamp adalah waktu submit formulir intake.
  const getReviewSubmissionDate = (review?: any | null): { date: Date | null; sourceLabel: string } => {
    if (!review) return { date: null, sourceLabel: "-" };

    const isMigration = review.source === "MIGRATION" || (!review.source && !!review.migrationBatchId);

    if (isMigration) {
      if (review.timestamp) {
        const d = new Date(review.timestamp);
        if (!isNaN(d.getTime())) {
          return { date: d, sourceLabel: "Kolom 1 CSV/XLSX" };
        }
      }
      if (review.entryDate) {
        const d = new Date(review.entryDate);
        if (!isNaN(d.getTime())) {
          return { date: d, sourceLabel: "Kolom 5 (Tanggal Ulasan)" };
        }
      }
      return { date: null, sourceLabel: "Migrasi" };
    }

    if (review.timestamp) {
      const d = new Date(review.timestamp);
      if (!isNaN(d.getTime())) {
        return { date: d, sourceLabel: "Submit Form Intake" };
      }
    }
    if (review.entryDate) {
      const d = new Date(review.entryDate);
      if (!isNaN(d.getTime())) {
        return { date: d, sourceLabel: "Tanggal Ulasan" };
      }
    }
    return { date: null, sourceLabel: "-" };
  };

  const originalSubmission = getReviewSubmissionDate(originalReview);
  const currentSubmission = getReviewSubmissionDate(currentReview);

  // Resolve Image URL with sanitized path routing
  const getImageUrl = (imagePath?: string | null, id?: string) => {
    if (!imagePath) return "";
    if (imagePath.startsWith("http")) {
      return id ? `/api/evidence/proxy/${id}` : imagePath;
    }
    let cleanPath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
    if (cleanPath.startsWith("uploads/")) {
      cleanPath = cleanPath.slice(8);
    }
    return `/api/uploads/${cleanPath}`;
  };

  // Calculate submission time delta based on Column 1 for migration data
  const calculateTimeDelta = () => {
    if (!originalSubmission.date || !currentSubmission.date) return null;

    const tOriginal = originalSubmission.date.getTime();
    const tCurrent = currentSubmission.date.getTime();
    const diffMs = tCurrent - tOriginal;
    if (isNaN(diffMs)) return null;

    const absDiffMs = Math.abs(diffMs);
    const isAfter = diffMs >= 0;

    const totalSeconds = Math.round(absDiffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    const remainingMinutes = totalMinutes % 60;
    const remainingSeconds = totalSeconds % 60;

    let timeStr = "";
    if (days >= 1) {
      timeStr = `${days} hari ${remainingHours > 0 ? `${remainingHours} jam ` : ""}`;
    } else if (totalHours >= 1) {
      timeStr = `${totalHours} jam ${remainingMinutes > 0 ? `${remainingMinutes} menit ` : ""}`;
    } else if (totalMinutes >= 1) {
      timeStr = `${totalMinutes} menit ${remainingSeconds > 0 ? `${remainingSeconds} detik ` : ""}`;
    } else if (totalSeconds > 0) {
      timeStr = `${totalSeconds} detik `;
    } else {
      return "Dikirim pada waktu yang sama persis";
    }

    if (isAfter) {
      return `${timeStr.trim()} setelah ulasan asli`;
    } else {
      return `${timeStr.trim()} sebelum ulasan asli (urutan anomali)`;
    }
  };

  // Cross-unit detection logic
  const isCrossUnit =
    originalReview?.up3?.name &&
    currentReview.up3?.name &&
    (originalReview.up3.name !== currentReview.up3.name ||
      originalReview.ulp?.name !== currentReview.ulp.name);

  // Cross-account detection logic
  const isDifferentSubmitter =
    originalReview?.originalReviewerName &&
    currentReview.originalReviewerName &&
    originalReview.originalReviewerName.trim().toLowerCase() !==
      currentReview.originalReviewerName.trim().toLowerCase();

  // Action 1: Confirm as Duplicate and REJECT
  const handleConfirmReject = async () => {
    try {
      setIsSubmittingAction(true);
      setActionError(null);

      const originalName = originalReview?.playstoreReviewerName || "ulasan awal";
      const remarksText = `Duplikat eviden terkonfirmasi: identik dengan ulasan ${originalName} (Ref: ${duplicateOfId || "-"})`;

      await submitDecisionMutation.mutateAsync({
        reviewId: currentReview.id,
        decision: "REJECTED",
        remarks: remarksText,
      });

      onActionComplete?.();
      onClose();
    } catch (err: any) {
      setActionError(err.message || "Gagal memproses penolakan duplikat.");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Action 2: Unlink duplicate flag and APPROVE as genuine
  const handleResolveAndApprove = async () => {
    try {
      setIsSubmittingAction(true);
      setActionError(null);

      await updateReviewMutation.mutateAsync({
        id: currentReview.id,
        isDuplicate: false,
        validationStatus: "APPROVED",
        reviewRemarks: "Dinyatakan ulasan sah dan bukan duplikat oleh operator verifikator",
      });

      onActionComplete?.();
      onClose();
    } catch (err: any) {
      setActionError(err.message || "Gagal melepas status duplikasi.");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const originalImageUrl = getImageUrl(originalReview?.evidenceImagePath, originalReview?.id);
  const currentImageUrl = getImageUrl(currentReview.evidenceImagePath, currentReview.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="splitview-modal-title"
    >
      {/* Backdrop with dark blur */}
      <div
        className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Split View Modal Container (Balanced Dimensions, Breathing Margins) */}
      <div className="relative w-full max-w-4xl lg:max-w-5xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] flex flex-col z-10 overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Enterprise Top Banner Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#faf5ff] text-[#7e22ce] flex items-center justify-center border border-[#e9d5ff] shrink-0 shadow-2xs">
              <Columns2 className="w-4 h-4 text-[#7e22ce]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="splitview-modal-title"
                  className="text-sm md:text-base font-bold text-[#0f172a] tracking-tight"
                >
                  Komparasi Duplikasi Ulasan
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#faf5ff] text-[#7e22ce] border border-[#e9d5ff]">
                  <Copy className="w-3.5 h-3.5 text-[#7e22ce]" />
                  <span>Visual Match Terdeteksi</span>
                </span>
                {duplicateReview.evidenceImageHash && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono text-[#64748b] bg-white border border-[#e2e8f0]">
                    pHash: {duplicateReview.evidenceImageHash.slice(0, 10)}...
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748b] mt-0.5 truncate">
                Inspeksi perbandingan eviden visual dan metadata ulasan asli dengan ulasan temuan duplikat.
              </p>
            </div>
          </div>

          {/* View Tab Switcher & Close Button */}
          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 bg-[#f1f5f9] rounded-xl border border-[#cbd5e1]">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer",
                  activeTab === "overview"
                    ? "bg-white text-[#0f172a] shadow-2xs"
                    : "text-[#64748b] hover:text-[#0f172a]"
                )}
                title="Buka perbandingan data ulasan & metadata [1]"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Data & Metadata</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("image-diff")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer",
                  activeTab === "image-diff"
                    ? "bg-white text-[#7e22ce] shadow-2xs"
                    : "text-[#64748b] hover:text-[#7e22ce]"
                )}
                title="Buka studio perbandingan visual gambar [2]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Perbandingan Gambar</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#faf5ff] text-[#7e22ce] border border-[#e9d5ff] text-xs font-mono">
                  Diff
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] flex items-center justify-center transition-colors cursor-pointer focus-utility-ring shadow-2xs shrink-0"
              title="Tutup dialog komparasi [Esc]"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Insight / Anomaly Detection Ribbon */}
        {(isCrossUnit || isDifferentSubmitter) && (
          <div className="shrink-0 bg-[#fffbeb] border-b border-[#fef3c7] px-5 py-2 flex items-center gap-2 text-xs text-[#92400e]">
            <AlertTriangle className="w-3.5 h-3.5 text-[#d97706] shrink-0" />
            <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {isCrossUnit && (
                <span className="font-semibold">
                  Peringatan Duplikasi Lintas Unit: Ulasan asli di unit{" "}
                  <strong className="text-[#78350f]">
                    {originalReview?.up3?.name} ({originalReview?.ulp?.name})
                  </strong>
                  , ulasan ini diajukan di unit{" "}
                  <strong className="text-[#78350f]">
                    {currentReview.up3?.name} ({currentReview.ulp?.name})
                  </strong>
                  .
                </span>
              )}
              {isDifferentSubmitter && (
                <span className="text-[#b45309]">
                  Akun pengirim berbeda: Asli ({originalReview?.originalReviewerName || "-"}) vs Duplikat ({currentReview.originalReviewerName || "-"}).
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Error Banner */}
        {actionError && (
          <div className="shrink-0 bg-[#fef2f2] border-b border-[#fecaca] px-5 py-2 flex items-center gap-2 text-xs text-[#b91c1c]">
            <XCircle className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Multimodal Similarity Verification Bar */}
        <div className="shrink-0 bg-white border-b border-[#e2e8f0] px-4 sm:px-5 py-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <ScanLine className="w-4 h-4 text-[#7e22ce]" />
                <span>Analisis Multimodal:</span>
              </span>

              {/* 1. Visual Similarity Pill */}
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold",
                  visualSimilarity >= 90
                    ? "bg-[#faf5ff] text-[#7e22ce] border-[#e9d5ff]"
                    : "bg-[#f8fafc] text-[#475569] border-[#e2e8f0]"
                )}
                title={`Hamming Distance pHash: ${hammingDistance} dari 64 bit`}
              >
                <span className="text-[#64748b]">Citra Visual:</span>
                <span className="font-mono font-bold">{visualSimilarity}%</span>
                <span className="text-xs text-[#64748b]">
                  {visualSimilarity >= 90 ? "(Identik)" : "(Beda)"}
                </span>
              </div>

              {/* 2. OCR Text Similarity Pill */}
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold",
                  textSimilarity >= 70
                    ? "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]"
                    : "bg-[#ecfdf5] text-[#15803d] border-[#a7f3d0]"
                )}
                title="Kesamaan kata ulasan non-template (Jaccard)"
              >
                <span className="text-[#64748b]">Teks OCR:</span>
                <span className="font-mono font-bold">{textSimilarity}%</span>
                <span>
                  {textSimilarity >= 70 ? "(Konten Mirip)" : "(Konten Unik)"}
                </span>
              </div>

              {/* 3. Reviewer Name Similarity Pill */}
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold",
                  reviewerSimilarity >= 75
                    ? "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]"
                    : "bg-[#ecfdf5] text-[#15803d] border-[#a7f3d0]"
                )}
                title="Kesamaan nama pengulas Play Store (Levenshtein)"
              >
                <span className="text-[#64748b]">Nama Pengulas:</span>
                <span className="font-mono font-bold">{reviewerSimilarity}%</span>
                <span>
                  {reviewerSimilarity >= 75 ? "(Nama Sama)" : "(Pengulas Beda)"}
                </span>
              </div>
            </div>

            {/* Smart Detection Callout */}
            {isLikelyTemplateCollision ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] text-xs text-[#166534] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a] shrink-0" />
                <span>
                  <strong>False-Positive Template Play Store:</strong> Visual identik, namun teks dan pengulas berbeda.
                </span>
              </div>
            ) : visualSimilarity >= 90 && (textSimilarity >= 70 || reviewerSimilarity >= 75) ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs text-[#991b1b] font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-[#dc2626] shrink-0" />
                <span>
                  <strong>Duplikasi Terkonfirmasi:</strong> Citra visual dan isi ulasan identik.
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Modal Scrollable Workspace */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 bg-[#f8fafc]">
          {activeTab === "overview" ? (
            /* TAB 1: OVERVIEW & METADATA DIFF VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* COLUMN 1: Original Master Review (Ulasan Asli Terdaftar) */}
              <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden flex flex-col">
                {/* Column 1 Header */}
                <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
                      <span>Ulasan Asli Terdaftar</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#64748b] truncate">
                      Ref ID: {originalReview?.id ? originalReview.id.slice(0, 8) : (duplicateOfId?.slice(0, 8) || "-")}
                    </span>
                  </div>

                  {originalReview?.validationStatus && (
                    <span
                      className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-md border",
                        originalReview.validationStatus === "APPROVED" &&
                          "bg-[#ecfdf5] text-[#15803d] border-[#a7f3d0]",
                        originalReview.validationStatus === "REJECTED" &&
                          "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
                        originalReview.validationStatus === "PENDING" &&
                          "bg-[#fff7ed] text-[#b45309] border-[#fed7aa]"
                      )}
                    >
                      {originalReview.validationStatus === "APPROVED"
                        ? "Disetujui"
                        : originalReview.validationStatus === "REJECTED"
                        ? "Ditolak"
                        : "Menunggu"}
                    </span>
                  )}
                </div>

                {/* Column 1 Body */}
                <div className="p-3.5 space-y-3">
                  {/* Eviden Canvas Viewport */}
                  <div
                    className="relative w-full h-52 min-h-48 bg-[#0b1120] rounded-xl border border-[#1e293b] overflow-hidden flex items-center justify-center group/view"
                    style={{ height: "210px", minHeight: "190px" }}
                  >
                    {originalReview?.evidenceImagePath ? (
                      <div
                        className="relative w-full h-full flex items-center justify-center transition-transform duration-150 ease-out"
                        style={{ transform: `scale(${zoomLeft})`, width: "100%", height: "100%" }}
                      >
                        <Image
                          src={originalImageUrl}
                          alt={`Eviden Asli: ${originalReview.playstoreReviewerName}`}
                          fill
                          unoptimized
                          priority
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-contain select-none pointer-events-none"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5">
                        <FileText className="w-6 h-6 text-slate-600" />
                        <span className="text-xs">Gambar eviden tidak tersedia</span>
                      </div>
                    )}

                    {/* Canvas HUD Controls Overlay */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-[#0f172a]/85 backdrop-blur-md border border-white/10 rounded-lg p-1 text-white shadow-md">
                      <button
                        type="button"
                        onClick={() => setZoomLeft((prev) => Math.min(prev + 0.25, 3))}
                        className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                        title="Perbesar [Zoom In]"
                      >
                        <ZoomIn className="w-3.5 h-3.5 text-slate-200" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomLeft((prev) => Math.max(prev - 0.25, 0.75))}
                        className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                        title="Perkecil [Zoom Out]"
                      >
                        <ZoomOut className="w-3.5 h-3.5 text-slate-200" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomLeft(1)}
                        className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-200" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("image-diff")}
                        className="p-1 hover:bg-white/10 rounded transition-colors text-[#c084fc] cursor-pointer"
                        title="Buka Mode Komparasi Gambar Diff"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {originalReview && (
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxItem({
                              id: originalReview.id,
                              playstoreReviewerName: originalReview.playstoreReviewerName,
                              originalReviewerName: originalReview.originalReviewerName || null,
                              entryDate: originalReview.entryDate,
                              evidenceImagePath: originalReview.evidenceImagePath,
                              up3: (originalReview.up3 as any) || { name: "-" },
                              ulp: (originalReview.ulp as any) || { name: "-" },
                              appVersion: (originalReview.appVersion as any) || { version: "-" },
                              confidenceScore: originalReview.confidenceScore,
                              ocrStatus: "COMPLETED",
                              validationStatus: originalReview.validationStatus,
                              isDuplicate: false,
                              fieldNotes: null,
                              reviewRemarks: null,
                              extractedOcrText: originalReview.extractedOcrText || null,
                            })
                          }
                          className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                          title="Buka Resolusi Penuh"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-[#38bdf8]" />
                        </button>
                      )}
                    </div>

                    {/* Bottom Image Label */}
                    <div className="absolute bottom-2 left-2 z-10 bg-[#0f172a]/85 backdrop-blur-md px-2 py-0.5 rounded text-xs font-semibold text-white/90 border border-white/10">
                      Eviden Master (Ulasan Pertama)
                    </div>
                  </div>

                  {/* Structured Metadata Diff Card */}
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] divide-y divide-[#e2e8f0] text-xs">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#006877]" />
                        <span>Pengulas Play Store</span>
                      </span>
                      <span className="font-bold text-[#0f172a] text-right truncate max-w-[200px]">
                        {originalReview?.playstoreReviewerName || "-"}
                      </span>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#006877]" />
                        <span>Akun Pengirim Form</span>
                      </span>
                      <span className="font-semibold text-[#334155] text-right truncate max-w-[200px]">
                        {originalReview?.originalReviewerName || "-"}
                      </span>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#006877]" />
                        <span>Waktu & Tanggal Input</span>
                      </span>
                      <div className="text-right">
                        <div className="font-mono text-[#334155] font-semibold">
                          {formatDate(originalSubmission.date, true)}
                        </div>
                        <div className="text-xs text-[#006877] font-medium">
                          {originalSubmission.sourceLabel}
                        </div>
                      </div>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#006877]" />
                        <span>Unit Kerja (UP3 / ULP)</span>
                      </span>
                      <span className="font-semibold text-[#0f172a] text-right truncate max-w-[200px]">
                        {originalReview?.up3?.name || "-"} / {originalReview?.ulp?.name || "-"}
                      </span>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-[#006877]" />
                        <span>Versi Aplikasi</span>
                      </span>
                      <span className="font-mono font-semibold text-[#334155]">
                        {originalReview?.appVersion?.version || "-"}
                      </span>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#006877]" />
                        <span>Skor Keyakinan OCR</span>
                      </span>
                      <span className="font-mono font-bold text-[#15803d]">
                        {originalReview?.confidenceScore != null
                          ? `${originalReview.confidenceScore.toFixed(1)}%`
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Extracted OCR Text Box */}
                  <div>
                    <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                      Teks Ekstraksi OCR (Eviden Asli)
                    </label>
                    <div className="p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs font-mono text-[#334155] max-h-20 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {originalReview?.extractedOcrText ? (
                        originalReview.extractedOcrText
                      ) : isOriginalLoading ? (
                        <span className="italic text-[#94a3b8]">Memuat teks ekstraksi OCR...</span>
                      ) : (
                        <span className="italic text-[#94a3b8]">Tidak ada teks OCR tersimpan pada ulasan asli.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 2: Duplicate Review (Temuan Saat Ini) */}
              <div className="bg-white rounded-2xl border-2 border-[#d8b4fe] shadow-xs overflow-hidden flex flex-col">
                {/* Column 2 Header */}
                <div className="px-3.5 py-2.5 bg-[#faf5ff] border-b border-[#e9d5ff] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#faf5ff] text-[#7e22ce] border border-[#e9d5ff]">
                      <Copy className="w-3.5 h-3.5 text-[#7e22ce]" />
                      <span>Terindikasi Duplikat (Temuan)</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#7e22ce] truncate">
                      ID: {currentReview.id.slice(0, 8)}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded-md border",
                      currentReview.validationStatus === "APPROVED" &&
                        "bg-[#ecfdf5] text-[#15803d] border-[#a7f3d0]",
                      currentReview.validationStatus === "REJECTED" &&
                        "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
                      currentReview.validationStatus === "PENDING" &&
                        "bg-[#fff7ed] text-[#b45309] border-[#fed7aa]"
                    )}
                  >
                    {currentReview.validationStatus === "APPROVED"
                      ? "Disetujui"
                      : currentReview.validationStatus === "REJECTED"
                      ? "Ditolak"
                      : "Menunggu"}
                  </span>
                </div>

                {/* Column 2 Body */}
                <div className="p-3.5 space-y-3">
                  {/* Eviden Canvas Viewport */}
                  <div
                    className="relative w-full h-52 min-h-48 bg-[#0b1120] rounded-xl border border-[#1e293b] overflow-hidden flex items-center justify-center group/view"
                    style={{ height: "210px", minHeight: "190px" }}
                  >
                    {currentReview.evidenceImagePath ? (
                      <div
                        className="relative w-full h-full flex items-center justify-center transition-transform duration-150 ease-out"
                        style={{ transform: `scale(${zoomRight})`, width: "100%", height: "100%" }}
                      >
                        <Image
                          src={currentImageUrl}
                          alt={`Eviden Duplikat: ${currentReview.playstoreReviewerName}`}
                          fill
                          unoptimized
                          priority
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-contain select-none pointer-events-none"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5">
                        <FileText className="w-6 h-6 text-slate-600" />
                        <span className="text-xs">Gambar eviden tidak tersedia</span>
                      </div>
                    )}

                    {/* Canvas HUD Controls Overlay */}
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-[#0f172a]/85 backdrop-blur-md border border-white/10 rounded-lg p-1 text-white shadow-md">
                      <button
                        type="button"
                        onClick={() => setZoomRight((prev) => Math.min(prev + 0.25, 3))}
                        className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                        title="Perbesar [Zoom In]"
                      >
                        <ZoomIn className="w-3.5 h-3.5 text-slate-200" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomRight((prev) => Math.max(prev - 0.25, 0.75))}
                        className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                        title="Perkecil [Zoom Out]"
                      >
                        <ZoomOut className="w-3.5 h-3.5 text-slate-200" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomRight(1)}
                        className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-200" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("image-diff")}
                        className="p-1 hover:bg-white/10 rounded transition-colors text-[#c084fc] cursor-pointer"
                        title="Buka Mode Komparasi Gambar Diff"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightboxItem(currentReview)}
                        className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                        title="Buka Resolusi Penuh"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-[#c084fc]" />
                      </button>
                    </div>

                    {/* Bottom Image Label */}
                    <div className="absolute bottom-2 left-2 z-10 bg-[#7e22ce]/90 backdrop-blur-md px-2 py-0.5 rounded text-xs font-semibold text-white border border-purple-400/30">
                      Eviden Temuan Duplikat
                    </div>
                  </div>

                  {/* Structured Metadata Diff Card */}
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] divide-y divide-[#e2e8f0] text-xs">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#7e22ce]" />
                        <span>Pengulas Play Store</span>
                      </span>
                      <span className="font-bold text-[#0f172a] text-right truncate max-w-[200px]">
                        {currentReview.playstoreReviewerName}
                      </span>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#7e22ce]" />
                        <span>Akun Pengirim Form</span>
                      </span>
                      <span
                        className={cn(
                          "font-semibold text-right truncate max-w-[200px]",
                          isDifferentSubmitter ? "text-[#b45309] font-bold" : "text-[#334155]"
                        )}
                      >
                        {currentReview.originalReviewerName || "-"}
                        {isDifferentSubmitter && " (Berbeda)"}
                      </span>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#7e22ce]" />
                        <span>Waktu Input & Selisih</span>
                      </span>
                      <div className="text-right">
                        <div className="font-mono text-[#334155] font-semibold">
                          {formatDate(currentSubmission.date, true)}
                        </div>
                        <div className="text-xs text-[#7e22ce] font-medium">
                          {currentSubmission.sourceLabel}
                        </div>
                        {calculateTimeDelta() && (
                          <div className="text-xs text-[#7e22ce] font-bold mt-0.5">
                            {calculateTimeDelta()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#7e22ce]" />
                        <span>Unit Kerja (UP3 / ULP)</span>
                      </span>
                      <span
                        className={cn(
                          "font-semibold text-right truncate max-w-[200px]",
                          isCrossUnit ? "text-[#b45309] font-bold" : "text-[#0f172a]"
                        )}
                      >
                        {currentReview.up3?.name || "-"} / {currentReview.ulp?.name || "-"}
                        {isCrossUnit && " (Lintas Unit)"}
                      </span>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-[#7e22ce]" />
                        <span>Versi Aplikasi</span>
                      </span>
                      <span className="font-mono font-semibold text-[#334155]">
                        {currentReview.appVersion?.version || "-"}
                      </span>
                    </div>

                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[#64748b] font-medium flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#7e22ce]" />
                        <span>Skor Keyakinan OCR</span>
                      </span>
                      <span className="font-mono font-bold text-[#15803d]">
                        {currentReview.confidenceScore != null
                          ? `${currentReview.confidenceScore.toFixed(1)}%`
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Extracted OCR Text Box */}
                  <div>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider truncate">
                        Teks Ekstraksi OCR (Eviden Temuan)
                      </label>
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-md border font-mono shrink-0",
                          textSimilarity >= 70
                            ? "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]"
                            : "bg-[#ecfdf5] text-[#15803d] border-[#a7f3d0]"
                        )}
                      >
                        Kemiripan: {textSimilarity}%
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#faf5ff] border border-[#e9d5ff] text-xs font-mono text-[#334155] max-h-20 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {currentReview.extractedOcrText ? (
                        currentReview.extractedOcrText
                      ) : (
                        <span className="italic text-[#94a3b8]">Tidak ada teks OCR tersimpan pada baris ini.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: DEDICATED IMAGE COMPARISON STUDIO */
            <div className="space-y-3.5">
              {/* Studio Control Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-[#e2e8f0] shadow-2xs">
                {/* Comparison Sub-mode Selector */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider mr-1 hidden sm:inline">
                    Mode Komparasi:
                  </span>

                  <button
                    type="button"
                    onClick={() => setImageCompareMode("slider")}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer",
                      imageCompareMode === "slider"
                        ? "bg-[#faf5ff] text-[#7e22ce] border border-[#d8b4fe] shadow-2xs"
                        : "bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]"
                    )}
                  >
                    <Split className="w-3.5 h-3.5 text-[#7e22ce]" />
                    <span>Slider Tirai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageCompareMode("side-by-side")}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer",
                      imageCompareMode === "side-by-side"
                        ? "bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] shadow-2xs"
                        : "bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]"
                    )}
                  >
                    <Columns2 className="w-3.5 h-3.5 text-[#0284c7]" />
                    <span>Berdampingan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageCompareMode("overlay")}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer",
                      imageCompareMode === "overlay"
                        ? "bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0] shadow-2xs"
                        : "bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]"
                    )}
                  >
                    <Layers className="w-3.5 h-3.5 text-[#15803d]" />
                    <span>Transparansi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageCompareMode("difference")}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer",
                      imageCompareMode === "difference"
                        ? "bg-[#fff7ed] text-[#b45309] border border-[#fed7aa] shadow-2xs"
                        : "bg-white text-[#475569] hover:bg-[#f8fafc] border border-[#e2e8f0]"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
                    <span>Selisih Piksel</span>
                  </button>
                </div>

                {/* Studio Zoom Controls */}
                <div className="flex items-center gap-1 bg-[#f8fafc] p-1 rounded-xl border border-[#cbd5e1]">
                  <button
                    type="button"
                    onClick={() => setStudioZoom((prev) => Math.min(prev + 0.25, 3))}
                    className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer text-[#475569]"
                    title="Perbesar Tampilan Studio"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold px-1.5 text-[#0f172a]">
                    {Math.round(studioZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setStudioZoom((prev) => Math.max(prev - 0.25, 0.75))}
                    className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer text-[#475569]"
                    title="Perkecil Tampilan Studio"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioZoom(1)}
                    className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer text-[#64748b]"
                    title="Reset Zoom ke 100%"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Main Image Comparison Studio Canvas */}
              <div
                ref={sliderContainerRef}
                onMouseDown={imageCompareMode === "slider" ? () => setIsDraggingSlider(true) : undefined}
                onTouchMove={
                  imageCompareMode === "slider"
                    ? (e) => {
                        if (e.touches.length > 0) updateSliderFromClientX(e.touches[0].clientX);
                      }
                    : undefined
                }
                className={cn(
                  "relative w-full h-96 min-h-[380px] bg-[#0b1120] rounded-2xl border border-[#1e293b] overflow-hidden flex items-center justify-center select-none shadow-inner",
                  imageCompareMode === "slider" && "cursor-ew-resize"
                )}
                style={{ height: "400px", minHeight: "380px" }}
              >
                {/* Floating Loading Spinner HUD */}
                {(isOriginalImgLoading || isCurrentImgLoading) && !hasOriginalImgError && !hasCurrentImgError && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0b1120]/80 backdrop-blur-xs transition-opacity pointer-events-none">
                    <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#00a2b9] animate-spin mb-2" />
                    <span className="text-xs font-semibold text-slate-200">
                      Mengambil citra eviden ulasan...
                    </span>
                  </div>
                )}

                {/* Floating Error Notification Banner */}
                {(hasOriginalImgError || hasCurrentImgError) && (
                  <div className="absolute top-3 inset-x-3 z-30 bg-[#fef2f2]/95 border border-[#fecaca] rounded-xl p-2.5 text-xs text-[#b91c1c] flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0" />
                      <span>
                        {hasOriginalImgError && hasCurrentImgError
                          ? "Gagal memuat kedua berkas citra eviden."
                          : hasOriginalImgError
                          ? "Gagal memuat berkas citra eviden ulasan asli."
                          : "Gagal memuat berkas citra eviden ulasan temuan."}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOriginalImgLoading(true);
                        setIsCurrentImgLoading(true);
                        setHasOriginalImgError(false);
                        setHasCurrentImgError(false);
                        setImageReloadKey((k) => k + 1);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#fecaca] text-xs font-bold text-[#b91c1c] hover:bg-[#fee2e2] transition-colors cursor-pointer"
                    >
                      Muat Ulang
                    </button>
                  </div>
                )}

                {imageCompareMode === "slider" && (
                  /* 1. SLIDER CURTAIN DIFF MODE */
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    {/* Layer 1: Original Image (Master Underneath) */}
                    <div
                      className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-75"
                      style={{ transform: `scale(${studioZoom})` }}
                    >
                      {originalImageUrl && !hasOriginalImgError ? (
                        <Image
                          key={`orig-slider-${imageReloadKey}`}
                          src={originalImageUrl}
                          alt="Eviden Asli"
                          fill
                          unoptimized
                          priority
                          onLoad={() => setIsOriginalImgLoading(false)}
                          onError={() => {
                            setIsOriginalImgLoading(false);
                            setHasOriginalImgError(true);
                          }}
                          sizes="100vw"
                          className="object-contain pointer-events-none select-none"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5">
                          <FileText className="w-6 h-6 text-slate-600" />
                          <span className="text-xs">Gambar asli tidak tersedia</span>
                        </div>
                      )}
                    </div>

                    {/* Layer 2: Duplicate Image (Clipped from left using sliderPosition%) */}
                    <div
                      className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-75"
                      style={{
                        transform: `scale(${studioZoom})`,
                        clipPath: `inset(0 0 0 ${sliderPosition}%)`,
                      }}
                    >
                      {currentImageUrl && !hasCurrentImgError ? (
                        <Image
                          key={`curr-slider-${imageReloadKey}`}
                          src={currentImageUrl}
                          alt="Eviden Duplikat"
                          fill
                          unoptimized
                          priority
                          onLoad={() => setIsCurrentImgLoading(false)}
                          onError={() => {
                            setIsCurrentImgLoading(false);
                            setHasCurrentImgError(true);
                          }}
                          sizes="100vw"
                          className="object-contain pointer-events-none select-none"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5">
                          <FileText className="w-6 h-6 text-slate-600" />
                          <span className="text-xs">Gambar duplikat tidak tersedia</span>
                        </div>
                      )}
                    </div>

                    {/* Interactive Divider Line & Handle */}
                    <div
                      className="absolute top-0 bottom-0 z-20 pointer-events-none"
                      style={{ left: `${sliderPosition}%` }}
                    >
                      <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
                      <div className="absolute top-1/2 -translate-y-1/2 -left-4 w-8 h-8 rounded-full bg-white text-[#0f172a] shadow-2xl flex items-center justify-center border-2 border-[#7e22ce]">
                        <ChevronsLeftRight className="w-4 h-4 text-[#7e22ce]" />
                      </div>
                    </div>

                    {/* Floating Corner Identifiers */}
                    <div className="absolute bottom-3 left-3 z-10 bg-[#0f172a]/85 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-[#16a34a] border border-[#16a34a]/30 shadow-md">
                      Asli ({sliderPosition}%)
                    </div>
                    <div className="absolute bottom-3 right-3 z-10 bg-[#0f172a]/85 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-[#c084fc] border border-[#a855f7]/30 shadow-md">
                      Duplikat ({100 - sliderPosition}%)
                    </div>
                  </div>
                )}

                {imageCompareMode === "side-by-side" && (
                  /* 2. SIDE BY SIDE DUAL ENLARGED VIEW */
                  <div className="w-full h-full grid grid-cols-2 divide-x divide-[#1e293b]">
                    {/* Left Canvas: Original */}
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                      <div
                        className="relative w-full h-full flex items-center justify-center transition-transform duration-75"
                        style={{ transform: `scale(${studioZoom})`, width: "100%", height: "100%" }}
                      >
                        {originalImageUrl && !hasOriginalImgError ? (
                          <Image
                            key={`orig-side-${imageReloadKey}`}
                            src={originalImageUrl}
                            alt="Eviden Asli"
                            fill
                            unoptimized
                            priority
                            onLoad={() => setIsOriginalImgLoading(false)}
                            onError={() => {
                              setIsOriginalImgLoading(false);
                              setHasOriginalImgError(true);
                            }}
                            className="object-contain pointer-events-none select-none"
                          />
                        ) : (
                          <span className="text-xs text-slate-500">Gambar asli tidak tersedia</span>
                        )}
                      </div>
                      <div className="absolute bottom-2.5 left-2.5 z-10 bg-[#0f172a]/85 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-bold text-[#16a34a] border border-[#16a34a]/30">
                        Ulasan Asli (Master)
                      </div>
                    </div>

                    {/* Right Canvas: Duplicate */}
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                      <div
                        className="relative w-full h-full flex items-center justify-center transition-transform duration-75"
                        style={{ transform: `scale(${studioZoom})`, width: "100%", height: "100%" }}
                      >
                        {currentImageUrl && !hasCurrentImgError ? (
                          <Image
                            key={`curr-side-${imageReloadKey}`}
                            src={currentImageUrl}
                            alt="Eviden Duplikat"
                            fill
                            unoptimized
                            priority
                            onLoad={() => setIsCurrentImgLoading(false)}
                            onError={() => {
                              setIsCurrentImgLoading(false);
                              setHasCurrentImgError(true);
                            }}
                            className="object-contain pointer-events-none select-none"
                          />
                        ) : (
                          <span className="text-xs text-slate-500">Gambar duplikat tidak tersedia</span>
                        )}
                      </div>
                      <div className="absolute bottom-2.5 right-2.5 z-10 bg-[#0f172a]/85 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-bold text-[#c084fc] border border-[#a855f7]/30">
                        Ulasan Duplikat (Temuan)
                      </div>
                    </div>
                  </div>
                )}

                {imageCompareMode === "overlay" && (
                  /* 3. OPACITY CROSS-FADE OVERLAY MODE */
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    {/* Base Layer: Original Image */}
                    <div
                      className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-75"
                      style={{ transform: `scale(${studioZoom})` }}
                    >
                      {originalImageUrl && !hasOriginalImgError && (
                        <Image
                          key={`orig-over-${imageReloadKey}`}
                          src={originalImageUrl}
                          alt="Eviden Asli"
                          fill
                          unoptimized
                          priority
                          onLoad={() => setIsOriginalImgLoading(false)}
                          onError={() => {
                            setIsOriginalImgLoading(false);
                            setHasOriginalImgError(true);
                          }}
                          className="object-contain pointer-events-none select-none"
                        />
                      )}
                    </div>

                    {/* Top Layer: Duplicate Image with dynamic Opacity */}
                    <div
                      className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-75 transition-opacity"
                      style={{
                        transform: `scale(${studioZoom})`,
                        opacity: overlayOpacity / 100,
                      }}
                    >
                      {currentImageUrl && !hasCurrentImgError && (
                        <Image
                          key={`curr-over-${imageReloadKey}`}
                          src={currentImageUrl}
                          alt="Eviden Duplikat"
                          fill
                          unoptimized
                          priority
                          onLoad={() => setIsCurrentImgLoading(false)}
                          onError={() => {
                            setIsCurrentImgLoading(false);
                            setHasCurrentImgError(true);
                          }}
                          className="object-contain pointer-events-none select-none"
                        />
                      )}
                    </div>

                    <div className="absolute bottom-3 left-3 z-10 bg-[#0f172a]/85 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-white border border-white/10 shadow-md">
                      Campuran Transparansi: Asli ({100 - overlayOpacity}%) / Duplikat ({overlayOpacity}%)
                    </div>
                  </div>
                )}

                {imageCompareMode === "difference" && (
                  /* 4. DIFFERENCE BLEND MODE (PIXEL DIFF) */
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <div
                      className="relative w-full h-full flex items-center justify-center transition-transform duration-75"
                      style={{ transform: `scale(${studioZoom})`, width: "100%", height: "100%" }}
                    >
                      {/* Base Image */}
                      {originalImageUrl && !hasOriginalImgError && (
                        <Image
                          key={`orig-diff-${imageReloadKey}`}
                          src={originalImageUrl}
                          alt="Eviden Asli"
                          fill
                          unoptimized
                          priority
                          onLoad={() => setIsOriginalImgLoading(false)}
                          onError={() => {
                            setIsOriginalImgLoading(false);
                            setHasOriginalImgError(true);
                          }}
                          className="object-contain absolute inset-0 pointer-events-none select-none"
                        />
                      )}

                      {/* Inverted Diff Blend */}
                      {currentImageUrl && !hasCurrentImgError && (
                        <Image
                          key={`curr-diff-${imageReloadKey}`}
                          src={currentImageUrl}
                          alt="Eviden Duplikat"
                          fill
                          unoptimized
                          priority
                          onLoad={() => setIsCurrentImgLoading(false)}
                          onError={() => {
                            setIsCurrentImgLoading(false);
                            setHasCurrentImgError(true);
                          }}
                          style={{ mixBlendMode: "difference" }}
                          className="object-contain absolute inset-0 pointer-events-none select-none"
                        />
                      )}
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 z-10 bg-[#0f172a]/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs text-white border border-white/15 flex items-center justify-between">
                      <span className="font-semibold text-emerald-300">
                        Piksel Hitam = 100% Identik.
                      </span>
                      <span className="text-slate-300">
                        Area bercahaya terang menandakan perubahan, pemotongan, atau editan.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-mode Specific Interactive Controller Strip */}
              {imageCompareMode === "slider" && (
                <div className="bg-white p-3 rounded-2xl border border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <span className="font-semibold text-[#16a34a] shrink-0">100% Asli</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sliderPosition}
                      onChange={(e) => setSliderPosition(Number(e.target.value))}
                      className="w-full accent-[#7e22ce] cursor-pointer h-2 bg-slate-200 rounded-lg"
                      aria-label="Posisi Slider Tirai"
                    />
                    <span className="font-semibold text-[#7e22ce] shrink-0">100% Duplikat</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[#64748b]">Preset:</span>
                    <button
                      type="button"
                      onClick={() => setSliderPosition(0)}
                      className="px-2.5 py-1 rounded-lg border border-[#cbd5e1] hover:bg-[#f1f5f9] font-medium transition-colors cursor-pointer"
                    >
                      Asli Penuh
                    </button>
                    <button
                      type="button"
                      onClick={() => setSliderPosition(50)}
                      className="px-2.5 py-1 rounded-lg border border-[#d8b4fe] bg-[#faf5ff] text-[#7e22ce] font-bold transition-colors cursor-pointer"
                    >
                      Bagi Dua (50:50)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSliderPosition(100)}
                      className="px-2.5 py-1 rounded-lg border border-[#cbd5e1] hover:bg-[#f1f5f9] font-medium transition-colors cursor-pointer"
                    >
                      Duplikat Penuh
                    </button>
                  </div>
                </div>
              )}

              {imageCompareMode === "overlay" && (
                <div className="bg-white p-3 rounded-2xl border border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <span className="font-semibold text-[#16a34a] shrink-0">Asli</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={overlayOpacity}
                      onChange={(e) => {
                        setOverlayOpacity(Number(e.target.value));
                        setIsBlinking(false);
                      }}
                      className="w-full accent-[#00a2b9] cursor-pointer h-2 bg-slate-200 rounded-lg"
                      aria-label="Transparansi Tumpuk"
                    />
                    <span className="font-semibold text-[#7e22ce] shrink-0">Duplikat</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBlinking((prev) => !prev)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl border font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer",
                        isBlinking
                          ? "bg-[#faf5ff] text-[#7e22ce] border-[#d8b4fe]"
                          : "bg-white text-[#475569] border-[#cbd5e1] hover:bg-[#f8fafc]"
                      )}
                    >
                      {isBlinking ? (
                        <>
                          <Pause className="w-3.5 h-3.5 text-[#7e22ce]" />
                          <span>Hentikan Kedip</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-[#006877]" />
                          <span>Kedipkan Otomatis (Flicker)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Informational Guidance Box */}
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] p-3 rounded-2xl flex items-center justify-between text-xs text-[#166534]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
                  <span>
                    <strong>Tips Verifikator:</strong> Gunakan slider geser untuk membandingkan posisi teks komentar, bintang rating, dan jam di status bar. Perbedaan pixel sekecil apa pun akan langsung terlihat.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className="font-bold underline text-[#15803d] hover:text-[#14532d] ml-3 shrink-0 cursor-pointer"
                >
                  Kembali ke Data Metadata
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Enterprise Action Controls Footer */}
        <div className="shrink-0 px-5 py-3 bg-[#f8fafc] border-t border-[#e2e8f0] flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left Action: Full Inspection Drawer Navigation */}
          <div>
            {onOpenFullDetail && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullDetail(currentReview);
                }}
                className="min-h-[38px] h-9.5 px-3 rounded-xl text-xs font-bold bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9] hover:border-[#00a2b9] hover:text-[#006877] transition-all inline-flex items-center gap-1.5 focus-utility-ring cursor-pointer shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#006877]" />
                <span>Buka Lembar Inspeksi Lengkap</span>
              </button>
            )}
          </div>

          {/* Right Actions: Reject Duplicate vs Unlink/Approve */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmittingAction}
              className="min-h-[38px] h-9.5 px-3.5 rounded-xl text-xs font-bold bg-white border border-[#cbd5e1] text-[#475569] hover:bg-[#f1f5f9] transition-all focus-utility-ring cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Tutup
            </button>

            {/* Unlink and Approve as Genuine */}
            <button
              type="button"
              disabled={isSubmittingAction}
              onClick={handleResolveAndApprove}
              className="min-h-[38px] h-9.5 px-3.5 rounded-xl text-xs font-bold bg-[#ecfdf5] hover:bg-[#dcfce7] text-[#15803d] border border-[#a7f3d0] transition-all inline-flex items-center gap-1.5 focus-utility-ring cursor-pointer shadow-2xs disabled:opacity-50 active:scale-95"
              title="Lepas status duplikasi dan tetapkan sebagai ulasan valid [A]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
              <span>Bukan Duplikat (Setujui)</span>
              <span className="hidden md:inline px-1 py-0.2 rounded bg-white/80 border border-[#a7f3d0] font-mono text-xs">
                A
              </span>
            </button>

            {/* Confirm Duplicate and REJECT */}
            <button
              type="button"
              disabled={isSubmittingAction}
              onClick={handleConfirmReject}
              className="min-h-[38px] h-9.5 px-3.5 rounded-xl text-xs font-bold bg-[#dc2626] hover:bg-[#b91c1c] text-white transition-all inline-flex items-center gap-1.5 focus-utility-ring cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
              title="Konfirmasi eviden duplikat dan tolak ulasan ini [R]"
            >
              <XCircle className="w-3.5 h-3.5 text-white" />
              <span>Tolak Sebagai Duplikat</span>
              <span className="hidden md:inline px-1 py-0.2 rounded bg-black/20 text-white font-mono text-xs">
                R
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox for zooming full evidence */}
      <EvidenceLightbox
        item={lightboxItem}
        isOpen={!!lightboxItem}
        onClose={() => setLightboxItem(null)}
      />
    </div>
  );
}
