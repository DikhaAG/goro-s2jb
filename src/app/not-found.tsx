import React from "react";
import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col justify-center items-center px-4 py-12 text-[#0f172a] relative">
      <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl p-8 shadow-xs text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#e7eeff] border border-[#cfdaf2] flex items-center justify-center mx-auto text-[#006877] shadow-xs">
          <Compass className="w-8 h-8" />
        </div>

        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e7eeff] text-[#006877] border border-[#cfdaf2]">
            404 HALAMAN TIDAK DITEMUKAN
          </span>
          <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight mt-3">
            Rute Tidak Dikenali
          </h1>
          <p className="text-xs text-[#64748b] mt-2 leading-relaxed">
            Halaman atau tautan yang Anda tuju tidak terdaftar di sistem komando GORO S2JB.
            Periksa kembali URL yang Anda masukkan atau kembali ke beranda.
          </p>
        </div>

        <div className="pt-2 border-t border-[#f1f5f9]">
          <Link href="/">
            <Button className="w-full min-h-[44px] h-11 bg-[#00a2b9] hover:bg-[#008b9e] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer">
              <Home className="w-4 h-4" />
              <span>Kembali ke Beranda Sistem</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
