"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Filter, RotateCcw, Copy, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterState {
  search: string;
  validationStatus: string;
  ocrStatus: string;
  validationZone: string;
  up3Id: string;
  ulpId: string;
  isDuplicate?: boolean;
  startDate?: string;
  endDate?: string;
}

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

interface ReviewsFilterBarProps {
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onResetFilters: () => void;
  up3s: Up3Option[];
  ulps: UlpOption[];
  isSearching?: boolean;
}

export function ReviewsFilterBar({
  filters,
  onFilterChange,
  onResetFilters,
  up3s,
  ulps,
  isSearching = false,
}: ReviewsFilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilterChange({ search: searchInput });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput, filters.search, onFilterChange]);

  // Sync external reset
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Filter available ULPs based on selected UP3
  const filteredUlps = filters.up3Id
    ? ulps.filter((u) => u.up3Id === filters.up3Id)
    : ulps;

  const hasActiveFilters =
    Boolean(filters.search) ||
    (filters.validationStatus !== "ALL" && Boolean(filters.validationStatus)) ||
    (filters.ocrStatus !== "ALL" && Boolean(filters.ocrStatus)) ||
    (filters.validationZone !== "ALL" && Boolean(filters.validationZone)) ||
    Boolean(filters.up3Id) ||
    Boolean(filters.ulpId) ||
    filters.isDuplicate !== undefined;

  return (
    <div className="space-y-3 bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-xs">
      {/* Top Row: Search and Quick Filter Capsule (Matching TriageFilterBar) */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8] pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama pengulas Play Store, akun Form, teks OCR, atau catatan..."
            className="w-full min-h-[40px] pl-10 pr-9 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs sm:text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:bg-white focus-utility-ring transition-all font-medium"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                onFilterChange({ search: "" });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#94a3b8] hover:text-[#0f172a] rounded-md transition-colors cursor-pointer"
              title="Hapus kata kunci pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Duplicate Toggle & Reset */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              onFilterChange({
                isDuplicate: filters.isDuplicate ? undefined : true,
              })
            }
            className={cn(
              "min-h-[40px] h-10 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer focus-utility-ring shadow-xs",
              filters.isDuplicate
                ? "bg-[#faf5ff] text-[#7e22ce] border-[#e9d5ff] ring-2 ring-[#9333ea]/20"
                : "bg-white text-[#334155] border-[#cbd5e1] hover:bg-[#f8fafc]"
            )}
          >
            <Copy className="w-3.5 h-3.5 text-[#9333ea]" />
            <span>Hanya Duplikat</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                onResetFilters();
              }}
              className="min-h-[40px] h-10 px-3.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2] text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer focus-utility-ring shadow-xs"
              title="Atur ulang semua filter"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: Detailed Dropdown Filters */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#f1f5f9]">
        <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
          <Filter className="w-3.5 h-3.5 text-[#64748b]" />
          <span className="font-semibold">Filter:</span>
        </div>

        {/* 1. Status Validasi */}
        <select
          value={filters.validationStatus}
          onChange={(e) => onFilterChange({ validationStatus: e.target.value })}
          className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-3 py-2 min-h-[38px] focus-utility-ring font-medium"
        >
          <option value="ALL">Semua Status Validasi</option>
          <option value="PENDING">Menunggu Triase (PENDING)</option>
          <option value="APPROVED">Lolos Validasi (APPROVED)</option>
          <option value="REJECTED">Ditolak (REJECTED)</option>
        </select>

        {/* 2. Status Pemrosesan OCR */}
        <select
          value={filters.ocrStatus}
          onChange={(e) => onFilterChange({ ocrStatus: e.target.value })}
          className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-3 py-2 min-h-[38px] focus-utility-ring font-medium"
        >
          <option value="ALL">Semua Status OCR</option>
          <option value="COMPLETED">Selesai (COMPLETED)</option>
          <option value="PROCESSING">Sedang Diproses (PROCESSING)</option>
          <option value="DOWNLOADING">Mengunduh Eviden</option>
          <option value="QUEUED">Dalam Antrean (QUEUED)</option>
          <option value="FAILED">Gagal Ekstraksi (FAILED)</option>
        </select>

        {/* 3. Zona Validasi Konfiden */}
        <select
          value={filters.validationZone}
          onChange={(e) => onFilterChange({ validationZone: e.target.value })}
          className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-3 py-2 min-h-[38px] focus-utility-ring font-medium"
        >
          <option value="ALL">Semua Zona Konfiden</option>
          <option value="GREEN">Zona Hijau (&gt;= 90%)</option>
          <option value="YELLOW">Zona Kuning (70% - 89.9%)</option>
          <option value="RED">Zona Merah (&lt; 70%)</option>
        </select>

        {/* 4. Unit UP3 (Cascading) */}
        <select
          value={filters.up3Id}
          onChange={(e) => {
            onFilterChange({
              up3Id: e.target.value,
              ulpId: "",
            });
          }}
          className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-3 py-2 min-h-[38px] focus-utility-ring font-medium"
        >
          <option value="">Semua UP3</option>
          {up3s.map((up3) => (
            <option key={up3.id} value={up3.id}>
              {up3.name}
            </option>
          ))}
        </select>

        {/* 5. Unit ULP (Cascading) */}
        <select
          value={filters.ulpId}
          onChange={(e) => onFilterChange({ ulpId: e.target.value })}
          disabled={!filters.up3Id && filteredUlps.length > 20}
          className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-3 py-2 min-h-[38px] focus-utility-ring font-medium disabled:opacity-50 disabled:bg-[#f1f5f9]"
        >
          <option value="">
            {!filters.up3Id ? "Pilih UP3 terlebih dahulu" : "Semua ULP"}
          </option>
          {filteredUlps.map((ulp) => (
            <option key={ulp.id} value={ulp.id}>
              {ulp.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
