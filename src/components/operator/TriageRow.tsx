"use client";

import React from "react";
import {
  Check,
  XCircle,
  Maximize2,
  AlertTriangle,
  Calendar,
  Layers,
  Clock,
  CloudDownload,
  Sparkles,
  CheckCircle2,
  Loader2,
  RotateCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OcrTextHighlighter } from "./OcrTextHighlighter";

export interface TriageRowData {
  id: string;
  playstoreReviewerName: string;
  originalReviewerName?: string | null;
  evidenceImagePath: string;
  confidenceScore: number | null;
  validationStatus: string;
  ocrStatus?: "QUEUED" | "DOWNLOADING" | "PROCESSING" | "COMPLETED" | "FAILED" | string;
  reviewRemarks?: string | null;
  extractedOcrText: string | null;
  isDuplicate: boolean;
  duplicateOfId?: string | null;
  duplicateOf?: {
    id: string;
    playstoreReviewerName: string;
    entryDate: Date | string;
    evidenceImagePath: string;
  } | null;
  up3?: { name: string } | null;
  ulp?: { name: string } | null;
  appVersion?: { version: string } | null;
  entryDate: Date | string;
  timestamp: Date | string;
}

interface TriageRowProps {
  item: TriageRowData;
  isActive: boolean;
  onSelect: (id: string) => void;
  onOpenLightbox: (item: TriageRowData) => void;
  onApprove: (id: string) => void;
  onReject: (item: TriageRowData) => void;
  onRetryOcr?: (id: string) => void;
}

export function TriageRow({
  item,
  isActive,
  onSelect,
  onOpenLightbox,
  onApprove,
  onReject,
  onRetryOcr,
}: TriageRowProps) {
  const imageUrl = item.evidenceImagePath.startsWith("http")
    ? `/api/evidence/proxy/${item.id}`
    : item.evidenceImagePath.startsWith("/")
    ? `/api/uploads${item.evidenceImagePath}`
    : `/api/uploads/${item.evidenceImagePath}`;

  const score = item.confidenceScore ?? 0;
  const scoreVariant =
    score >= 90 ? "success" : score >= 70 ? "warning" : "destructive";

  // Derive effective OCR progress state
  const effectiveOcrStatus =
    item.ocrStatus ||
    (item.confidenceScore !== null
      ? "COMPLETED"
      : item.validationStatus === "NEEDS_REVIEW" && item.reviewRemarks?.includes("OCR Gagal")
      ? "FAILED"
      : "QUEUED");

  const isOcrPending =
    effectiveOcrStatus === "QUEUED" ||
    effectiveOcrStatus === "DOWNLOADING" ||
    effectiveOcrStatus === "PROCESSING";

  return (
    <div
      onClick={() => onSelect(item.id)}
      className={`group relative grid grid-cols-12 gap-3 p-4 rounded-2xl border transition-all duration-150 cursor-pointer ${
        isActive
          ? "bg-[#f0f9ff] border-[#00a2b9] ring-2 ring-[#00a2b9]/20 shadow-xs"
          : "bg-white border-[#e2e8f0] hover:bg-[#f8fafc] hover:border-[#cbd5e1]"
      }`}
    >
      {/* Active Focus Pill Indicator */}
      {isActive && (
        <div className="absolute -left-1 top-4 bottom-4 w-1.5 bg-[#00a2b9] rounded-r-full shadow-xs" />
      )}

      {/* Pillar 1: Evidence Thumbnail */}
      <div className="col-span-12 sm:col-span-3 md:col-span-2 flex items-center justify-center">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenLightbox(item);
          }}
          className="relative w-full h-24 sm:h-28 bg-[#f8fafc] rounded-xl overflow-hidden border border-[#cbd5e1] group/img cursor-zoom-in"
          title="Klik untuk membuka Lightbox pratinjau penuh [Spasi]"
        >
          <img
            src={imageUrl}
            alt={`Bukti ${item.playstoreReviewerName}`}
            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-[#0f172a]/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <span className="p-1.5 bg-white text-[#006877] rounded-lg border border-[#e2e8f0] text-xs flex items-center gap-1 font-semibold shadow-xs">
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Zoom</span>
            </span>
          </div>
          {item.isDuplicate && (
            <div className="absolute top-1.5 right-1.5 bg-[#dc2626] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
              DUPLIKAT
            </div>
          )}
          {isOcrPending && (
            <div className="absolute bottom-1 left-1 bg-[#0f172a]/80 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
              <Loader2 className="w-2.5 h-2.5 animate-spin text-[#00a2b9]" />
              <span>OCR ASINKRON</span>
            </div>
          )}
        </div>
      </div>

      {/* Pillar 2: Reviewer & Unit Metadata */}
      <div className="col-span-12 sm:col-span-4 md:col-span-3 flex flex-col justify-center space-y-1.5">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider block">
            Nama Pengulas Play Store
          </span>
          <span className="text-sm font-bold text-[#0f172a] font-mono tracking-tight group-hover:text-[#006877] transition-colors">
            {item.playstoreReviewerName}
          </span>
          {item.originalReviewerName && item.originalReviewerName !== item.playstoreReviewerName && (
            <span className="text-[11px] text-[#64748b] block truncate">
              Asli: {item.originalReviewerName}
            </span>
          )}
        </div>

        {/* Real-time OCR & Image Proxy Progress Pill */}
        <div className="pt-0.5">
          {effectiveOcrStatus === "QUEUED" && (
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-medium gap-1 flex items-center w-fit">
              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Antrean OCR (Menunggu Giliran)</span>
            </Badge>
          )}

          {effectiveOcrStatus === "DOWNLOADING" && (
            <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-300 text-[10px] font-medium gap-1 flex items-center w-fit animate-pulse">
              <CloudDownload className="w-3 h-3 text-sky-600 shrink-0" />
              <span>Mengunduh Bukti Google Drive...</span>
            </Badge>
          )}

          {effectiveOcrStatus === "PROCESSING" && (
            <Badge variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-300 text-[10px] font-medium gap-1 flex items-center w-fit animate-pulse">
              <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
              <span>Mengekstrak Teks & OCR...</span>
            </Badge>
          )}

          {effectiveOcrStatus === "COMPLETED" && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-medium gap-1 flex items-center w-fit">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>OCR Selesai ({item.confidenceScore !== null ? `${item.confidenceScore.toFixed(1)}%` : "100%"})</span>
            </Badge>
          )}

          {effectiveOcrStatus === "FAILED" && (
            <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-200 text-[10px] font-medium gap-1 flex items-center w-fit">
              <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
              <span>Gagal OCR / Unduh Bukti</span>
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
            {item.up3?.name || "UP3"}
          </Badge>
          <Badge variant="neutral" className="text-[10px] px-2 py-0.5">
            {item.ulp?.name || "ULP"}
          </Badge>
          {item.appVersion && (
            <span className="text-[10px] font-mono text-[#64748b] flex items-center gap-1">
              <Layers className="w-3 h-3 text-[#94a3b8]" />
              {item.appVersion.version}
            </span>
          )}
        </div>

        <div className="text-[10px] text-[#64748b] flex items-center gap-1 font-mono">
          <Calendar className="w-3 h-3 text-[#94a3b8]" />
          <span>{new Date(item.entryDate).toLocaleDateString("id-ID")}</span>
        </div>
      </div>

      {/* Pillar 3: OCR Extracted Text & Highlight OR Real-time Progress Card */}
      <div className="col-span-12 sm:col-span-5 md:col-span-4 flex flex-col justify-center">
        {effectiveOcrStatus === "QUEUED" && (
          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 h-24 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>Menunggu Giliran Ekstraksi OCR</span>
            </div>
            <p className="text-[11px] text-amber-700/90 mt-1 line-clamp-2">
              Metadata baris telah tersimpan di PostgreSQL. Pekerjaan OCR berada dalam antrean BullMQ latar belakang.
            </p>
          </div>
        )}

        {effectiveOcrStatus === "DOWNLOADING" && (
          <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200 h-24 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-800">
              <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin" />
              <span>Mengunduh Citra Bukti...</span>
            </div>
            <p className="text-[11px] text-sky-700/90 mt-1 line-clamp-2">
              Smart Image Streaming Proxy sedang mengunduh bukti beresolusi tinggi dari Google Drive.
            </p>
          </div>
        )}

        {effectiveOcrStatus === "PROCESSING" && (
          <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 h-24 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800">
              <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
              <span>Vision Core OCR & Validasi Aktif...</span>
            </div>
            <p className="text-[11px] text-indigo-700/90 mt-1 line-clamp-2">
              Mengekstrak teks ulasan Play Store dan menghitung pHash 64-bit anti-fraud.
            </p>
          </div>
        )}

        {effectiveOcrStatus === "FAILED" && (
          <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 h-24 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Gagal Memproses OCR / Eviden</span>
            </div>
            <p className="text-[11px] text-rose-700/90 mt-1 line-clamp-2">
              {item.reviewRemarks || "Tautan gambar tidak dapat diakses atau format citra tidak valid"}
            </p>
            {onRetryOcr && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetryOcr(item.id);
                }}
                className="mt-1 text-[10px] text-[#006877] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCw className="w-3 h-3" />
                <span>Coba Ulang Pemindaian OCR</span>
              </button>
            )}
          </div>
        )}

        {effectiveOcrStatus === "COMPLETED" && (
          <div className="bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0] h-24 overflow-y-auto">
            <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider block mb-1">
              Hasil Ekstraksi OCR
            </span>
            <OcrTextHighlighter
              ocrText={item.extractedOcrText}
              targetName={item.playstoreReviewerName}
            />
          </div>
        )}
      </div>

      {/* Pillar 4: Confidence Score & Quick Actions */}
      <div className="col-span-12 md:col-span-3 flex flex-col justify-between items-end border-t md:border-t-0 md:border-l border-[#f1f5f9] pt-2 md:pt-0 md:pl-4">
        {/* Score & Duplicate Flag */}
        <div className="w-full flex items-center justify-between md:flex-col md:items-end gap-1">
          {effectiveOcrStatus === "COMPLETED" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#64748b] font-medium">Kemiripan:</span>
              <Badge variant={scoreVariant} className="text-xs font-mono font-bold">
                {item.confidenceScore !== null ? `${item.confidenceScore.toFixed(1)}%` : "N/A"}
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#64748b] font-medium">Status Pekerjaan:</span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono font-semibold ${
                  effectiveOcrStatus === "FAILED"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                }`}
              >
                {effectiveOcrStatus === "FAILED" ? "GAGAL" : "PROSES ASINKRON"}
              </Badge>
            </div>
          )}

          {item.isDuplicate && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] px-2 py-0.5 rounded-lg">
              <AlertTriangle className="w-3 h-3 text-[#b91c1c]" />
              <span>Duplikat Visual</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="w-full flex items-center gap-2 mt-2">
          <Button
            variant="default"
            size="sm"
            disabled={isOcrPending}
            onClick={(e) => {
              e.stopPropagation();
              onApprove(item.id);
            }}
            className={`flex-1 h-9 min-h-[38px] bg-[#16a34a] hover:bg-[#15803d] text-white gap-1 text-xs font-semibold rounded-xl shadow-xs ${
              isOcrPending ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title={
              isOcrPending
                ? "Menunggu OCR selesai memproses data sebelum verifikasi"
                : "Setujui ulasan ini [A / Enter]"
            }
          >
            <Check className="w-4 h-4" />
            <span>{isOcrPending ? "Menunggu" : "Setujui"}</span>
            {isActive && !isOcrPending && <span className="text-[10px] opacity-75 font-mono">[A]</span>}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            disabled={isOcrPending}
            onClick={(e) => {
              e.stopPropagation();
              onReject(item);
            }}
            className={`flex-1 h-9 min-h-[38px] bg-[#dc2626] hover:bg-[#b91c1c] text-white gap-1 text-xs font-semibold rounded-xl shadow-xs ${
              isOcrPending ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title={
              isOcrPending
                ? "Menunggu OCR selesai memproses data sebelum verifikasi"
                : "Tolak ulasan ini [R]"
            }
          >
            <XCircle className="w-4 h-4" />
            <span>Tolak</span>
            {isActive && !isOcrPending && <span className="text-[10px] opacity-75 font-mono">[R]</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}

