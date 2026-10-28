"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldX, LogOut, Home, ArrowLeft } from "lucide-react";

function UnauthorizedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requiredRole = searchParams.get("required");

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />

      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-rose-400 mb-6 shadow-lg shadow-rose-950/40">
        <ShieldX className="w-10 h-10" />
      </div>

      <div className="inline-block px-3 py-1 rounded-full bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs font-bold tracking-wider uppercase mb-3">
        403 Akses Ditolak
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
        Wewenang Akun Terbatas
      </h1>

      <p className="text-slate-300 text-sm leading-relaxed mb-6">
        Sistem mendeteksi bahwa akun Anda tidak memiliki izin untuk membuka modul ini.
        Sesuai arsitektur keamanan Multi-Peran GORO S2JB, hak akses dipisahkan secara
        ketat antara Petugas Lapangan, Pegawai Verifikator Triase, dan Manager Eksekutif.
      </p>

      {requiredRole && (
        <div className="mb-6 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-center space-x-2">
          <span>Modul ini mewajibkan peran:</span>
          <span className="font-bold text-amber-400 uppercase">{requiredRole}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 border-t border-slate-800/80">
        <Link
          href="/"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold flex items-center justify-center space-x-2 transition"
        >
          <Home className="w-4 h-4" />
          <span>Beranda Sistem</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/20 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar & Ganti Akun</span>
        </button>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />
      <Suspense
        fallback={
          <div className="p-8 text-slate-400 text-sm">
            Memeriksa hak akses...
          </div>
        }
      >
        <UnauthorizedContent />
      </Suspense>
    </div>
  );
}
