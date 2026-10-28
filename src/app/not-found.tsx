import React from "react";
import Link from "next/link";
import { Compass, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center px-4 py-12 text-slate-100 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur text-center relative z-10 space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center mx-auto text-cyan-400 shadow-lg shadow-cyan-500/10">
          <Compass className="w-10 h-10 animate-pulse" />
        </div>

        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
            404 HALAMAN TIDAK DITEMUKAN
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-3">
            Rute Tidak Dikenali
          </h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Halaman atau tautan yang Anda tuju tidak terdaftar di sistem komando GORO S2JB.
            Periksa kembali URL yang Anda masukkan atau kembali ke beranda.
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800">
          <Link
            href="/"
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-cyan-500/20"
          >
            <Home className="w-4 h-4 font-bold" />
            <span>Kembali ke Beranda Sistem</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
