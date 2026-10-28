import React from "react";
import { Loader2, ShieldCheck } from "lucide-react";

export default function OperatorLoading() {
  return (
    <div className="min-h-screen bg-[#070b13] p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
      {/* Top Header Skeleton */}
      <div className="h-16 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Table Skeleton */}
        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-1/4" />
          <div className="h-12 bg-slate-800/60 rounded-xl" />
          <div className="space-y-3 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-950/70 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Evidence Inspector Skeleton */}
        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 animate-pulse flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <div className="text-xs font-mono text-slate-400">
            Memuat antrean triase Zona Kuning & inspektur eviden...
          </div>
        </div>
      </div>
    </div>
  );
}
