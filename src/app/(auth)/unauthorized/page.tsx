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
    <div className="w-full max-w-lg mx-auto bg-white border border-[#e2e8f0] rounded-2xl p-8 shadow-xs text-center space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#fef2f2] border border-[#fecaca] text-[#ef4444] mx-auto shadow-xs">
        <ShieldX className="w-8 h-8" />
      </div>

      <div>
        <span className="inline-block px-3 py-1 rounded-full bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-[11px] font-bold tracking-wider uppercase mb-3">
          403 Akses Terbatas
        </span>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
          Wewenang Akun Terbatas
        </h1>

        <p className="text-xs sm:text-sm text-[#475569] leading-relaxed mt-2">
          Sistem mendeteksi bahwa akun Anda tidak memiliki izin untuk membuka modul ini.
          Sesuai arsitektur keamanan Multi-Peran GORO S2JB, hak akses dipisahkan secara
          ketat antara Petugas Lapangan, Pegawai Verifikator Triase, dan Manager Eksekutif.
        </p>
      </div>

      {requiredRole && (
        <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#64748b] flex items-center justify-center gap-2">
          <span>Modul ini mewajibkan peran:</span>
          <span className="font-bold text-[#b45309] uppercase">{requiredRole}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-[#f1f5f9]">
        <Link
          href="/"
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold flex items-center justify-center gap-2 transition focus-utility-ring"
        >
          <Home className="w-4 h-4" />
          <span>Beranda Sistem</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer focus-utility-ring"
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
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col justify-center items-center px-4 py-12 text-[#0f172a]">
      <Suspense
        fallback={
          <div className="p-8 text-[#64748b] text-sm animate-pulse">
            Memeriksa hak akses...
          </div>
        }
      >
        <UnauthorizedContent />
      </Suspense>
    </div>
  );
}
