"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Database,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  Copy,
  Clock,
} from "lucide-react";

export interface ReviewsKpiData {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  activeOcr: number;
  duplicates: number;
}

interface ReviewsKpiRibbonProps {
  kpi?: ReviewsKpiData;
  isLoading?: boolean;
  selectedValidationStatus?: string;
  selectedOcrStatus?: string;
  selectedDuplicateOnly?: boolean;
  onSelectQuickFilter: (filter: {
    validationStatus?: string;
    ocrStatus?: string;
    isDuplicate?: boolean;
  }) => void;
}

export function ReviewsKpiRibbon({
  kpi,
  isLoading = false,
  selectedValidationStatus,
  selectedOcrStatus,
  selectedDuplicateOnly,
  onSelectQuickFilter,
}: ReviewsKpiRibbonProps) {
  const cards = [
    {
      id: "all",
      label: "Total Ulasan",
      sublabel: "seluruh data",
      count: kpi?.total ?? 0,
      icon: Database,
      bgClass: "bg-[#f8fafc] border-[#e2e8f0]",
      textTitleClass: "text-[#475569]",
      textCountClass: "text-[#0f172a]",
      iconBoxClass: "bg-white border-[#e2e8f0] text-[#006877]",
      isActive:
        (!selectedValidationStatus || selectedValidationStatus === "ALL") &&
        (!selectedOcrStatus || selectedOcrStatus === "ALL") &&
        !selectedDuplicateOnly,
      onClick: () =>
        onSelectQuickFilter({
          validationStatus: "ALL",
          ocrStatus: "ALL",
          isDuplicate: undefined,
        }),
    },
    {
      id: "approved",
      label: "Lolos Validasi",
      sublabel: "disetujui sah",
      count: kpi?.approved ?? 0,
      icon: CheckCircle2,
      bgClass: "bg-[#ecfdf5] border-[#a7f3d0]",
      textTitleClass: "text-[#15803d]",
      textCountClass: "text-[#166534]",
      iconBoxClass: "bg-white border-[#a7f3d0] text-[#16a34a]",
      isActive: selectedValidationStatus === "APPROVED",
      onClick: () =>
        onSelectQuickFilter({
          validationStatus:
            selectedValidationStatus === "APPROVED" ? "ALL" : "APPROVED",
        }),
    },
    {
      id: "rejected",
      label: "Ditolak / Batal",
      sublabel: "tidak valid",
      count: kpi?.rejected ?? 0,
      icon: XCircle,
      bgClass: "bg-[#fef2f2] border-[#fecaca]",
      textTitleClass: "text-[#b91c1c]",
      textCountClass: "text-[#991b1b]",
      iconBoxClass: "bg-white border-[#fecaca] text-[#dc2626]",
      isActive: selectedValidationStatus === "REJECTED",
      onClick: () =>
        onSelectQuickFilter({
          validationStatus:
            selectedValidationStatus === "REJECTED" ? "ALL" : "REJECTED",
        }),
    },
    {
      id: "pending",
      label: "Menunggu Triase",
      sublabel: "perlu tindakan",
      count: kpi?.pending ?? 0,
      icon: Clock,
      bgClass: "bg-[#fff7ed] border-[#fed7aa]",
      textTitleClass: "text-[#b45309]",
      textCountClass: "text-[#9a3412]",
      iconBoxClass: "bg-white border-[#fed7aa] text-[#b45309]",
      isActive: selectedValidationStatus === "PENDING",
      onClick: () =>
        onSelectQuickFilter({
          validationStatus:
            selectedValidationStatus === "PENDING" ? "ALL" : "PENDING",
        }),
    },
    {
      id: "activeOcr",
      label: "Antrean OCR",
      sublabel: "asinkron worker",
      count: kpi?.activeOcr ?? 0,
      icon: Activity,
      bgClass: "bg-[#f0f9ff] border-[#bae6fd]",
      textTitleClass: "text-[#0369a1]",
      textCountClass: "text-[#075985]",
      iconBoxClass: "bg-white border-[#bae6fd] text-[#0284c7]",
      isActive: selectedOcrStatus === "PROCESSING",
      onClick: () =>
        onSelectQuickFilter({
          ocrStatus: selectedOcrStatus === "PROCESSING" ? "ALL" : "PROCESSING",
        }),
    },
    {
      id: "duplicates",
      label: "Terindikasi Duplikat",
      sublabel: "pHash identik",
      count: kpi?.duplicates ?? 0,
      icon: Copy,
      bgClass: "bg-[#faf5ff] border-[#e9d5ff]",
      textTitleClass: "text-[#7e22ce]",
      textCountClass: "text-[#6b21a8]",
      iconBoxClass: "bg-white border-[#e9d5ff] text-[#9333ea]",
      isActive: !!selectedDuplicateOnly,
      onClick: () =>
        onSelectQuickFilter({
          isDuplicate: !selectedDuplicateOnly,
        }),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className={cn(
              "group relative flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer shadow-xs focus-utility-ring",
              card.bgClass,
              card.isActive
                ? "ring-2 ring-[#00a2b9] shadow-sm scale-[1.01]"
                : "hover:shadow-sm hover:scale-[1.01]"
            )}
            title={`Klik untuk filter: ${card.label}`}
          >
            <div className="min-w-0 pr-2">
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider block truncate",
                  card.textTitleClass
                )}
              >
                {card.label}
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                {isLoading ? (
                  <div className="h-7 w-14 bg-white/70 animate-pulse rounded-md" />
                ) : (
                  <span
                    className={cn(
                      "text-2xl font-bold font-mono tracking-tight",
                      card.textCountClass
                    )}
                  >
                    {card.count.toLocaleString("id-ID")}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#64748b] block mt-0.5 truncate">
                {card.sublabel}
              </span>
            </div>

            <div
              className={cn(
                "p-2.5 rounded-xl border shrink-0 transition-transform group-hover:scale-105 shadow-xs",
                card.iconBoxClass
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
