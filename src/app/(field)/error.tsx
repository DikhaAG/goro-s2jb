"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function FieldError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Field Module Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col justify-center items-center px-4 py-12 text-[#0f172a]">
      <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl p-8 shadow-xs text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#fef2f2] border border-[#fecaca] flex items-center justify-center mx-auto text-[#ef4444] shadow-xs">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
            KESALAHAN SISTEM LAPANGAN
          </span>
          <h2 className="text-xl font-bold text-[#0f172a] mt-2">
            Gagal Memuat Formulir Entri
          </h2>
          <p className="text-xs text-[#64748b] mt-2 leading-relaxed">
            {error.message || "Terjadi kendala saat menghubungkan modul entri eviden ke server."}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2 border-t border-[#f1f5f9]">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#00a2b9] hover:bg-[#008b9e] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer focus-utility-ring"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </button>
          <Link
            href="/"
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold flex items-center gap-1.5 transition focus-utility-ring"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Beranda</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
