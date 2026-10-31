import React from "react";
import { Loader2 } from "lucide-react";

export interface ModuleLoadingSkeletonProps {
  label: string;
  variant?: "form" | "grid" | "dashboard";
}

/**
 * Standardized loading skeleton for application operational modules.
 * Ensures visual consistency and eliminates boilerplate across loading.tsx files.
 */
export function ModuleLoadingSkeleton({
  label,
  variant = "dashboard",
}: ModuleLoadingSkeletonProps) {
  if (variant === "form") {
    return (
      <div className="min-h-screen bg-[#f9f9ff] p-4 sm:p-6 lg:p-8 flex flex-col justify-center items-center">
        <div className="w-full max-w-2xl bg-white border border-[#e2e8f0] rounded-2xl p-8 shadow-xs animate-pulse space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e7eeff]" />
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-[#e2e8f0] rounded w-1/3" />
              <div className="h-3 bg-[#f1f5f9] rounded w-1/2" />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#f1f5f9]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-12 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl" />
              <div className="h-12 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl" />
            </div>
            <div className="h-12 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl" />
            <div className="h-44 bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-2xl flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#006877] animate-spin mb-2" />
              <span className="text-xs text-[#64748b]">{label}</span>
            </div>
            <div className="h-11 bg-[#e7eeff] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div className="min-h-screen bg-[#f9f9ff] p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
        <div className="h-16 bg-white border border-[#e2e8f0] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-2xl p-6 animate-pulse space-y-4">
            <div className="h-8 bg-[#e2e8f0] rounded w-1/4" />
            <div className="h-12 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl" />
            <div className="space-y-3 pt-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 bg-[#f8fafc] border border-[#f1f5f9] rounded-xl"
                />
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-2xl p-6 animate-pulse flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#006877] animate-spin" />
            <div className="text-xs text-[#64748b]">{label}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9ff] p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
      <div className="h-16 bg-white border border-[#e2e8f0] rounded-2xl animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-28 bg-white border border-[#e2e8f0] rounded-2xl animate-pulse"
          />
        ))}
      </div>
      <div className="flex-1 bg-white border border-[#e2e8f0] rounded-2xl p-6 animate-pulse flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[#006877] animate-spin" />
        <div className="text-xs text-[#64748b]">{label}</div>
      </div>
    </div>
  );
}

