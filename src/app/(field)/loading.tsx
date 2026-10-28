import React from "react";
import { Loader2 } from "lucide-react";

export default function FieldLoading() {
  return (
    <div className="min-h-screen bg-[#070b13] p-4 sm:p-6 lg:p-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur animate-pulse space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-slate-800 rounded w-1/3" />
            <div className="h-3 bg-slate-850 rounded w-1/2" />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-12 bg-slate-800/80 rounded-xl" />
            <div className="h-12 bg-slate-800/80 rounded-xl" />
          </div>
          <div className="h-12 bg-slate-800/80 rounded-xl" />
          <div className="h-48 bg-slate-950/70 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mb-2" />
            <span className="text-xs text-slate-400 font-mono">
              Memuat formulir entri data ulasan lapangan...
            </span>
          </div>
          <div className="h-12 bg-cyan-500/20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
