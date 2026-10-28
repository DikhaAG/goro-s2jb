import React from "react";
import { Loader2, ShieldCheck } from "lucide-react";

export default function OperatorLoading() {
  return (
    <div className="min-h-screen bg-[#f9f9ff] p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
      {/* Top Header Skeleton */}
      <div className="h-16 bg-white border border-[#e2e8f0] rounded-2xl animate-pulse" />

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Table Skeleton */}
        <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-2xl p-6 animate-pulse space-y-4">
          <div className="h-8 bg-[#e2e8f0] rounded w-1/4" />
          <div className="h-12 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl" />
          <div className="space-y-3 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-[#f8fafc] border border-[#f1f5f9] rounded-xl" />
            ))}
          </div>
        </div>

        {/* Evidence Inspector Skeleton */}
        <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-2xl p-6 animate-pulse flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#f59e0b] animate-spin" />
          <div className="text-xs text-[#64748b]">
            Memuat antrean triase Zona Kuning & inspektur eviden...
          </div>
        </div>
      </div>
    </div>
  );
}
