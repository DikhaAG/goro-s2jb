"use client";

import React from "react";
import { Filter, Keyboard, Sparkles } from "lucide-react";
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
    <div className="space-y-3 bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
      {/* Category Tabs & Hotkey Legend */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 self-start">
          <button
            onClick={() => handleTabChange("NEEDS_REVIEW")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              filters.tab === "NEEDS_REVIEW"
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Perlu Verifikasi (Zona Kuning)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                filters.tab === "NEEDS_REVIEW"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {yellowCount}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("DUPLICATES")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              filters.tab === "DUPLICATES"
                ? "bg-red-500/15 text-red-300 border border-red-500/30 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Terindikasi Duplikat</span>
          </button>

          <button
            onClick={() => handleTabChange("ALL")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              filters.tab === "ALL"
                ? "bg-slate-800 text-slate-100 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Semua Ulasan (Riwayat)
          </button>
        </div>

        {/* Keyboard Shortcut Cheatsheet Badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 font-mono">
          <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-300 font-semibold">[A]</span> Setujui
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-semibold">[R]</span> Tolak
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-semibold">[J/K]</span> Baris
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-semibold">[Space]</span> Foto
        </div>
      </div>

      {/* Filter Row: UP3, ULP, Date Range */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span>Filter:</span>
        </div>

        {/* UP3 Dropdown */}
        <select
          value={filters.up3Id || ""}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              up3Id: e.target.value || undefined,
              ulpId: undefined, // Reset ULP when UP3 changes
            })
          }
          className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
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
          className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
        >
          <option value="">Semua ULP</option>
          {filteredUlps.map((ulp) => (
            <option key={ulp.id} value={ulp.id}>
              {ulp.name}
            </option>
          ))}
        </select>

        {/* Date From */}
        <div className="flex items-center gap-1 text-xs text-slate-400">
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
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Date To */}
        <div className="flex items-center gap-1 text-xs text-slate-400">
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
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500"
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
            className="h-7 text-xs text-slate-400 hover:text-slate-200 px-2"
          >
            Reset Filter
          </Button>
        )}
      </div>
    </div>
  );
}
