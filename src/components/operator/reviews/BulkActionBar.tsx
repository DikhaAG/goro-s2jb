"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Download,
  X,
} from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onOpenBulkReassign: () => void;
  onBulkRetryOcr: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onBulkExport: () => void;
  isProcessing?: boolean;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onOpenBulkReassign,
  onBulkRetryOcr,
  onBulkApprove,
  onBulkReject,
  onBulkExport,
  isProcessing = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] sm:w-auto transition-all animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-[#0f172a] text-white rounded-2xl px-4 py-2.5 shadow-2xl border border-[#334155] flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
        {/* Selection Count Pill */}
        <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-[#334155]">
          <div className="w-6 h-6 rounded-lg bg-[#00a2b9] text-white flex items-center justify-center font-bold font-mono text-xs shrink-0">
            {selectedCount}
          </div>
          <span className="text-xs font-semibold text-[#f8fafc] whitespace-nowrap hidden sm:inline">
            ulasan terpilih
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto">
          {/* Ubah Unit Massal */}
          <button
            type="button"
            onClick={onOpenBulkReassign}
            disabled={isProcessing}
            className="min-h-[38px] h-9 px-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-slate-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-utility-ring"
            title="Pindahkan unit UP3/ULP ulasan terpilih"
          >
            <Building2 className="w-3.5 h-3.5 text-[#00a2b9]" />
            <span className="hidden md:inline">Ubah Unit</span>
          </button>

          {/* Picu Ulang OCR */}
          <button
            type="button"
            onClick={onBulkRetryOcr}
            disabled={isProcessing}
            className="min-h-[38px] h-9 px-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-slate-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-utility-ring"
            title="Picu ulang OCR untuk ulasan terpilih"
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5 text-sky-400",
                isProcessing && "animate-spin"
              )}
            />
            <span className="hidden md:inline">Picu OCR</span>
          </button>

          {/* Setujui Massal */}
          <button
            type="button"
            onClick={onBulkApprove}
            disabled={isProcessing}
            className="min-h-[38px] h-9 px-3.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-utility-ring shadow-xs"
            title="Setujui ulasan terpilih"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            <span>Setujui</span>
          </button>

          {/* Tolak Massal */}
          <button
            type="button"
            onClick={onBulkReject}
            disabled={isProcessing}
            className="min-h-[38px] h-9 px-3.5 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-utility-ring shadow-xs"
            title="Tolak ulasan terpilih"
          >
            <XCircle className="w-3.5 h-3.5 text-white" />
            <span>Tolak</span>
          </button>

          {/* Ekspor CSV */}
          <button
            type="button"
            onClick={onBulkExport}
            disabled={isProcessing}
            className="min-h-[38px] h-9 px-3 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-slate-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-utility-ring"
            title="Ekspor ulasan terpilih ke CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden lg:inline">Ekspor</span>
          </button>
        </div>

        {/* Clear Selection */}
        <div className="pl-1 sm:pl-2 border-l border-[#334155]">
          <button
            type="button"
            onClick={onClearSelection}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-[#1e293b] flex items-center justify-center transition-colors cursor-pointer"
            title="Batalkan semua pilihan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
