import React from "react";
import { Loader2, TrendingUp } from "lucide-react";

export default function ManagerLoading() {
  return (
    <div className="min-h-screen bg-[#070b13] p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
      {/* Top Header Skeleton */}
      <div className="h-16 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>

      {/* Report Table Skeleton */}
      <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 animate-pulse flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        <div className="text-xs font-mono text-slate-400">
          Mengagregasikan laporan performa unit UID S2JB & target imutabel...
        </div>
      </div>
    </div>
  );
}
