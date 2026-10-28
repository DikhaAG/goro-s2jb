import React from "react";
import { Loader2 } from "lucide-react";

export default function FieldLoading() {
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
            <span className="text-xs text-[#64748b]">
              Menyiapkan formulir entri data ulasan lapangan...
            </span>
          </div>
          <div className="h-11 bg-[#e7eeff] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
