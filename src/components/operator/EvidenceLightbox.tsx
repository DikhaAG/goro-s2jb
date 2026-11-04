"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Check,
  XCircle,
  Copy,
  CheckCheck,
  SplitSquareVertical,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OcrTextHighlighter } from "./OcrTextHighlighter";

export interface LightboxReviewItem {
  id: string;
  playstoreReviewerName: string;
  originalReviewerName?: string | null;
  evidenceImagePath: string;
  confidenceScore: number | null;
  validationStatus: string;
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
}

interface EvidenceLightboxProps {
  item: LightboxReviewItem | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function EvidenceLightbox({
  item,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: EvidenceLightboxProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [showSplitView, setShowSplitView] = useState<boolean>(true);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    setImageLoadError(false);
    setReloadKey(0);
  }, [item?.id]);

  if (!isOpen || !item) return null;

  const imageUrl = item.evidenceImagePath.startsWith("http")
    ? `/api/evidence/proxy/${item.id}`
    : item.evidenceImagePath.startsWith("/")
    ? `/api/uploads${item.evidenceImagePath}`
    : `/api/uploads/${item.evidenceImagePath}`;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3.0));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 0.5));
  };

  const handleReset = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleCopyOcr = () => {
    if (item.extractedOcrText) {
      navigator.clipboard.writeText(item.extractedOcrText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Lightbox Container */}
      <div className="relative flex flex-col w-[96vw] h-[94vh] bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden shadow-2xl">
        {/* Top Command Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>Eviden Bukti:</span>
              <span className="text-cyan-400 font-mono">{item.playstoreReviewerName}</span>
            </h2>
            <Badge variant="outline" className="text-xs">
              {item.up3?.name || "UP3"} • {item.ulp?.name || "ULP"}
            </Badge>
            {item.appVersion && (
              <Badge variant="secondary" className="text-xs">
                {item.appVersion.version}
              </Badge>
            )}
            {item.isDuplicate && (
              <Badge variant="destructive" className="animate-pulse">
                DUPLIKAT VISUAL
              </Badge>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700 text-xs">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-slate-300 hover:text-white"
                onClick={handleZoomIn}
                title="Perbesar (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <span className="px-2 font-mono text-slate-400 select-none">
                {Math.round(zoomLevel * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-slate-300 hover:text-white"
                onClick={handleZoomOut}
                title="Perkecil (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-slate-300 hover:text-white"
                onClick={handleRotate}
                title="Putar 90 Derajat"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-slate-300 hover:text-white"
                onClick={handleReset}
                title="Reset Zoom & Rotasi"
              >
                Reset
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className={`h-8 gap-1.5 text-xs ${showSplitView ? "bg-slate-800 border-cyan-500/40 text-cyan-300" : ""}`}
              onClick={() => setShowSplitView(!showSplitView)}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Split Panel OCR</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              onClick={onClose}
              title="Tutup (Esc / Space)"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Main Body (Split View) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Canvas: Evidence Image */}
          <div className="flex-1 relative flex items-center justify-center bg-slate-950 p-4 overflow-auto cursor-grab active:cursor-grabbing">
            {imageLoadError ? (
              <div className="flex flex-col items-center justify-center p-8 text-center max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-100 mb-1.5">
                  {item.evidenceImagePath.includes("drive.google.com") || item.evidenceImagePath.includes("googleusercontent.com")
                    ? "Tautan Google Drive Terkendala"
                    : "Gagal Mengalirkan Gambar Eviden"}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {item.evidenceImagePath.includes("drive.google.com") || item.evidenceImagePath.includes("googleusercontent.com")
                    ? "Berkas pada Google Drive kemungkinan disetel privat, dibatasi oleh pengulas, atau kuota akses publik terlampaui."
                    : "Server tidak dapat mengalirkan citra bukti dari CDN atau penyedia eksternal saat ini."}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isReloading}
                    onClick={() => {
                      setIsReloading(true);
                      setImageLoadError(false);
                      setReloadKey((prev) => prev + 1);
                      setTimeout(() => setIsReloading(false), 500);
                    }}
                    className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? "animate-spin" : ""}`} />
                    <span>Coba Muat Ulang Gambar</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="transition-transform duration-100 ease-out flex items-center justify-center max-w-full max-h-full"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <img
                  key={`${imageUrl}-${reloadKey}`}
                  src={`${imageUrl}${imageUrl.includes("?") ? "&" : "?"}_retry=${reloadKey}`}
                  alt={`Eviden ${item.playstoreReviewerName}`}
                  className="max-h-[80vh] max-w-full object-contain rounded border border-slate-800 shadow-2xl select-none pointer-events-none"
                  loading="eager"
                  onError={() => setImageLoadError(true)}
                />
              </div>
            )}
          </div>

          {/* Right Sidepanel: OCR Details & Comparison */}
          {showSplitView && (
            <div className="w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Hasil Ekstraksi OCR
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-semibold text-slate-200">
                      Skor Kemiripan:
                    </span>
                    <Badge
                      variant={
                        (item.confidenceScore ?? 0) >= 90
                          ? "success"
                          : (item.confidenceScore ?? 0) >= 70
                          ? "warning"
                          : "destructive"
                      }
                      className="text-xs font-mono"
                    >
                      {item.confidenceScore !== null
                        ? `${item.confidenceScore.toFixed(1)}%`
                        : "N/A"}
                    </Badge>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200"
                  onClick={handleCopyOcr}
                  title="Salin Teks OCR"
                >
                  {copiedText ? (
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>

              {/* Target Reviewer Name Banner */}
              <div className="p-3 bg-slate-950/60 border-b border-slate-800/80">
                <span className="text-[11px] uppercase text-slate-500 font-semibold tracking-wider block">
                  Nama Target Verifikasi
                </span>
                <span className="text-sm font-bold text-amber-300 font-mono">
                  {item.playstoreReviewerName}
                </span>
                {item.originalReviewerName && item.originalReviewerName !== item.playstoreReviewerName && (
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Nama Asli: {item.originalReviewerName}
                  </span>
                )}
              </div>

              {/* OCR Text Area with Highlighting */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                <span className="text-[11px] uppercase text-slate-500 font-semibold tracking-wider block">
                  Cuplikan Teks Terbaca
                </span>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                  <OcrTextHighlighter
                    ocrText={item.extractedOcrText}
                    targetName={item.playstoreReviewerName}
                  />
                </div>

                {item.isDuplicate && item.duplicateOf && (
                  <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-lg text-xs space-y-1">
                    <span className="font-semibold text-red-300 flex items-center gap-1.5">
                      ⚠️ Terindikasi Duplikasi Visual
                    </span>
                    <p className="text-slate-400 text-[11px]">
                      Sama dengan ulasan pertama oleh{" "}
                      <span className="text-slate-200 font-medium">
                        {item.duplicateOf.playstoreReviewerName}
                      </span>{" "}
                      pada{" "}
                      {new Date(item.duplicateOf.entryDate).toLocaleDateString("id-ID")}.
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Quick Decision Action inside Lightbox */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-2">
                <Button
                  variant="default"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 h-10"
                  onClick={() => {
                    onApprove?.(item.id);
                    onClose();
                  }}
                >
                  <Check className="w-4 h-4" />
                  <span>Setujui [A]</span>
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white gap-1.5 h-10"
                  onClick={() => {
                    onReject?.(item.id);
                    onClose();
                  }}
                >
                  <XCircle className="w-4 h-4" />
                  <span>Tolak [R]</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
