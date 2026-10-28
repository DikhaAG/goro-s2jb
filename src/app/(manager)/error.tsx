"use client";

import React, { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Manager Module Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center px-4 py-12 text-slate-100">
      <div className="w-full max-w-md bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
            KESALAHAN MODUL EKSEKUTIF
          </span>
          <h2 className="text-xl font-bold text-white mt-2">
            Gagal Memuat Laporan Eksekutif
          </h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {error.message || "Terjadi kesalahan saat menghitung agregasi metrik harian/bulanan."}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-500/20 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kalkulasi Ulang</span>
          </button>
          <Link
            href="/"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Beranda</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
