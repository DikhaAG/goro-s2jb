"use client";

import React from "react";
import { Filter, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TriageTab = "NEEDS_REVIEW" | "ALL" | "DUPLICATES";

export interface TriageFilters {
  tab: TriageTab;
  up3Id?: string;
  ulpId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface TriageFilterBarProps {
  filters: TriageFilters;
  onFilterChange: (filters: TriageFilters) => void;
  yellowCount: number;
  up3List: Array<{ id: string; name: string }>;
  ulpList: Array<{ id: string; name: string; up3Id: string }>;
}

export function TriageFilterBar({
  filters,
  onFilterChange,
  yellowCount,
  up3List,
  ulpList,
}: TriageFilterBarProps) {
  const filteredUlps = filters.up3Id
    ? ulpList.filter((u) => u.up3Id === filters.up3Id)
    : ulpList;

  const handleTabChange = (newTab: TriageTab) => {
    onFilterChange({ ...filters, tab: newTab });
  };

  return (
    <div className="space-y-3 bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-xs">
      {/* Category Tabs & Hotkey Legend */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] self-start">
          <button
            type="button"
            onClick={() => handleTabChange("NEEDS_REVIEW")}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 cursor-pointer focus-utility-ring ${
              filters.tab === "NEEDS_REVIEW"
                ? "bg-[#fff7ed] text-[#b45309] border border-[#fed7aa] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <span>Perlu Verifikasi (Zona Kuning)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                filters.tab === "NEEDS_REVIEW"
                  ? "bg-[#b45309] text-white font-bold"
                  : "bg-[#e2e8f0] text-[#475569]"
              }`}
            >
              {yellowCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("DUPLICATES")}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer focus-utility-ring ${
              filters.tab === "DUPLICATES"
                ? "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <span>Terindikasi Duplikat</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("ALL")}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer focus-utility-ring ${
              filters.tab === "ALL"
                ? "bg-[#e7eeff] text-[#006877] border border-[#cfdaf2] font-semibold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            Semua Ulasan (Riwayat)
          </button>
        </div>

        {/* Keyboard Shortcut Cheatsheet Badge */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-[#64748b] bg-[#f8fafc] px-3.5 py-2 rounded-xl border border-[#e2e8f0] font-mono">
          <Keyboard className="w-3.5 h-3.5 text-[#006877]" />
          <span className="text-[#0f172a] font-semibold">[A]</span> Setujui
          <span className="text-[#cbd5e1]">|</span>
          <span className="text-[#0f172a] font-semibold">[R]</span> Tolak
          <span className="text-[#cbd5e1]">|</span>
          <span className="text-[#0f172a] font-semibold">[J/K]</span> Navigasi Baris
          <span className="text-[#cbd5e1]">|</span>
          <span className="text-[#0f172a] font-semibold">[Spasi]</span> Pratinjau Foto
        </div>
      </div>

      {/* Filter Row: UP3, ULP, Date Range */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#f1f5f9]">
        <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
          <Filter className="w-3.5 h-3.5 text-[#64748b]" />
          <span className="font-semibold">Filter:</span>
        </div>

        {/* UP3 Dropdown */}
        <select
          value={filters.up3Id || ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              up3Id: e.target.value || undefined,
              ulpId: undefined,
            })
          }
          className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-3 py-2 min-h-[38px] focus-utility-ring"
        >
          <option value="">Semua UP3</option>
          {up3List.map((up3) => (
            <option key={up3.id} value={up3.id}>
              {up3.name}
            </option>
          ))}
        </select>

        {/* ULP Dropdown */}
        <select
          value={filters.ulpId || ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              ulpId: e.target.value || undefined,
            })
          }
          disabled={!filters.up3Id && filteredUlps.length > 20}
          className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-3 py-2 min-h-[38px] focus-utility-ring disabled:opacity-50"
        >
          <option value="">Semua ULP</option>
          {filteredUlps.map((ulp) => (
            <option key={ulp.id} value={ulp.id}>
              {ulp.name}
            </option>
          ))}
        </select>

        {/* Date From */}
        <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
          <span>Dari:</span>
          <input
            type="date"
            value={filters.dateFrom || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                dateFrom: e.target.value || undefined,
              })
            }
            className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-2.5 py-1.5 min-h-[38px] focus-utility-ring"
          />
        </div>

        {/* Date To */}
        <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
          <span>Sampai:</span>
          <input
            type="date"
            value={filters.dateTo || ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                dateTo: e.target.value || undefined,
              })
            }
            className="bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-2.5 py-1.5 min-h-[38px] focus-utility-ring"
          />
        </div>

        {/* Reset Filters Button */}
        {(filters.up3Id || filters.ulpId || filters.dateFrom || filters.dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onFilterChange({
                tab: filters.tab,
              })
            }
            className="h-9 min-h-[36px] text-xs text-[#64748b] hover:text-[#0f172a] px-3"
          >
            Reset Filter
          </Button>
        )}
      </div>
    </div>
  );
}
