"use client";

import React, { useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import { Building2, MapPin } from "lucide-react";

interface CascadingUnitSelectProps {
  selectedUp3Id: string;
  selectedUlpId: string;
  onUp3Change: (up3Id: string) => void;
  onUlpChange: (ulpId: string) => void;
  disabled?: boolean;
  errors?: {
    up3Id?: string;
    ulpId?: string;
  };
}

export function CascadingUnitSelect({
  selectedUp3Id,
  selectedUlpId,
  onUp3Change,
  onUlpChange,
  disabled,
  errors,
}: CascadingUnitSelectProps) {
  const unitsQuery = trpc.master.getUnits.useQuery();

  const up3List = unitsQuery.data || [];

  // Filter available ULPs based on selected UP3
  const availableUlps = useMemo(() => {
    if (!selectedUp3Id) return [];
    const up3 = up3List.find((u) => u.id === selectedUp3Id);
    return up3?.ulps || [];
  }, [up3List, selectedUp3Id]);

  // If selected UP3 changes and the current ULP is not valid for this UP3, reset ULP
  useEffect(() => {
    if (selectedUlpId && availableUlps.length > 0) {
      const isValid = availableUlps.some((ulp) => ulp.id === selectedUlpId);
      if (!isValid) {
        onUlpChange("");
      }
    }
  }, [selectedUp3Id, availableUlps, selectedUlpId, onUlpChange]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* UP3 Dropdown */}
      <div className="space-y-1.5">
        <Label required htmlFor="up3Select">
          <Building2 className="w-3.5 h-3.5 text-[#006877] mr-1" />
          Unit Pelaksana (UP3)
        </Label>
        <select
          id="up3Select"
          value={selectedUp3Id}
          disabled={disabled || unitsQuery.isLoading}
          onChange={(e) => onUp3Change(e.target.value)}
          className={`flex h-11 min-h-[44px] w-full rounded-xl border bg-[#f8fafc] px-3.5 py-2 text-sm text-[#0f172a] focus-utility-ring transition-colors ${
            errors?.up3Id ? "border-[#ef4444]" : "border-[#cbd5e1] focus:border-[#00a2b9]"
          }`}
        >
          <option value="">-- Pilih UP3 --</option>
          {up3List.map((up3) => (
            <option key={up3.id} value={up3.id}>
              {up3.name}
            </option>
          ))}
        </select>
        {errors?.up3Id && <p className="text-[11px] text-[#b91c1c] font-medium mt-1">{errors.up3Id}</p>}
      </div>

      {/* ULP Dropdown */}
      <div className="space-y-1.5">
        <Label required htmlFor="ulpSelect">
          <MapPin className="w-3.5 h-3.5 text-[#b45309] mr-1" />
          Unit Layanan Pelanggan (ULP)
        </Label>
        <select
          id="ulpSelect"
          value={selectedUlpId}
          disabled={disabled || !selectedUp3Id || availableUlps.length === 0}
          onChange={(e) => onUlpChange(e.target.value)}
          className={`flex h-11 min-h-[44px] w-full rounded-xl border bg-[#f8fafc] px-3.5 py-2 text-sm text-[#0f172a] focus-utility-ring transition-colors ${
            errors?.ulpId ? "border-[#ef4444]" : "border-[#cbd5e1] focus:border-[#00a2b9]"
          } ${!selectedUp3Id ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <option value="">
            {!selectedUp3Id ? "-- Pilih UP3 terlebih dahulu --" : "-- Pilih ULP --"}
          </option>
          {availableUlps.map((ulp) => (
            <option key={ulp.id} value={ulp.id}>
              {ulp.name}
            </option>
          ))}
        </select>
        {errors?.ulpId && <p className="text-[11px] text-[#b91c1c] font-medium mt-1">{errors.ulpId}</p>}
      </div>
    </div>
  );
}
