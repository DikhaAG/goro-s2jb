"use client";

import React from "react";
import { Check, XCircle, Maximize2, AlertTriangle, Calendar, Layers } from "lucide-react";
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
}

export function TriageRow({
  item,
  isActive,
  onSelect,
  onOpenLightbox,
  onApprove,
  onReject,
}: TriageRowProps) {
  const imageUrl = item.evidenceImagePath.startsWith("http")
    ? item.evidenceImagePath
    : item.evidenceImagePath.startsWith("/")
    ? `/api/uploads${item.evidenceImagePath}`
    : `/api/uploads/${item.evidenceImagePath}`;

  const score = item.confidenceScore ?? 0;
  const scoreVariant =
    score >= 90 ? "success" : score >= 70 ? "warning" : "destructive";

  return (
    <div
      onClick={() => onSelect(item.id)}
      className={`group relative grid grid-cols-12 gap-3 p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
        isActive
          ? "bg-slate-900/95 border-cyan-500/80 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-950/20"
          : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-900/90 hover:border-slate-700"
      }`}
    >
      {/* Active Focus Pill Indicator */}
      {isActive && (
        <div className="absolute -left-1 top-3 bottom-3 w-1.5 bg-cyan-400 rounded-r-full shadow-sm" />
      )}

      {/* Pilar 1: Evidence Thumbnail (Col 12 -> Col 2 on md+) */}
      <div className="col-span-12 sm:col-span-3 md:col-span-2 flex items-center justify-center">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenLightbox(item);
          }}
          className="relative w-full h-24 sm:h-28 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 group/img cursor-zoom-in"
          title="Klik untuk membuka Lightbox pratinjau penuh [Space]"
        >
          <img
            src={imageUrl}
            alt={`Bukti ${item.playstoreReviewerName}`}
            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <span className="p-1.5 bg-slate-900/90 text-cyan-300 rounded-md border border-cyan-500/40 text-xs flex items-center gap-1 font-mono">
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Zoom</span>
            </span>
          </div>
          {item.isDuplicate && (
            <div className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 rounded shadow">
              DUP
            </div>
          )}
        </div>
      </div>

      {/* Pilar 2: Reviewer & Unit Metadata (Col 12 -> Col 3 on md+) */}
      <div className="col-span-12 sm:col-span-4 md:col-span-3 flex flex-col justify-center space-y-1.5">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
            Nama Pengulas Target
          </span>
          <span className="text-sm font-bold text-amber-300 font-mono tracking-tight group-hover:text-amber-200 transition-colors">
            {item.playstoreReviewerName}
          </span>
          {item.originalReviewerName && item.originalReviewerName !== item.playstoreReviewerName && (
            <span className="text-[11px] text-slate-400 block truncate">
              Asli: {item.originalReviewerName}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {item.up3?.name || "UP3"}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {item.ulp?.name || "ULP"}
          </Badge>
          {item.appVersion && (
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Layers className="w-2.5 h-2.5 text-slate-500" />
              {item.appVersion.version}
            </span>
          )}
        </div>

        <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
          <Calendar className="w-3 h-3 text-slate-600" />
          <span>{new Date(item.entryDate).toLocaleDateString("id-ID")}</span>
        </div>
      </div>

      {/* Pilar 3: OCR Extracted Text & Highlight (Col 12 -> Col 4 on md+) */}
      <div className="col-span-12 sm:col-span-5 md:col-span-4 flex flex-col justify-center">
        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 h-24 overflow-y-auto">
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block mb-1">
            Hasil Ekstraksi OCR
          </span>
          <OcrTextHighlighter
            ocrText={item.extractedOcrText}
            targetName={item.playstoreReviewerName}
          />
        </div>
      </div>

      {/* Pilar 4: Confidence Score & Quick Actions (Col 12 -> Col 3 on md+) */}
      <div className="col-span-12 md:col-span-3 flex flex-col justify-between items-end border-t md:border-t-0 md:border-l border-slate-800/80 pt-2 md:pt-0 md:pl-3">
        {/* Score & Duplicate Flag */}
        <div className="w-full flex items-center justify-between md:flex-col md:items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Kemiripan:</span>
            <Badge variant={scoreVariant} className="text-xs font-mono font-bold">
              {item.confidenceScore !== null ? `${item.confidenceScore.toFixed(1)}%` : "N/A"}
            </Badge>
          </div>

          {item.isDuplicate && (
            <div className="flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-950/40 border border-red-800/50 px-2 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>Duplikat Visual</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="w-full flex items-center gap-2 mt-2">
          <Button
            variant="default"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onApprove(item.id);
            }}
            className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs font-semibold shadow-sm"
            title="Setujui ulasan ini [A / Enter]"
          >
            <Check className="w-4 h-4" />
            <span>Setujui</span>
            {isActive && <span className="text-[10px] opacity-75 font-mono">[A]</span>}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onReject(item);
            }}
            className="flex-1 h-9 bg-red-600/90 hover:bg-red-500 text-white gap-1 text-xs font-semibold shadow-sm"
            title="Tolak ulasan ini [R]"
          >
            <XCircle className="w-4 h-4" />
            <span>Tolak</span>
            {isActive && <span className="text-[10px] opacity-75 font-mono">[R]</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
