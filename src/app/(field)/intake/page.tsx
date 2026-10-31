import React from "react";
import Link from "next/link";
import { IntakeForm } from "@/components/forms/IntakeForm";
import { Zap, Smartphone, CheckCircle2, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Entri Eviden | GORO S2JB 2026",
  description: "Formulir cepat pengumpulan bukti rating pelanggan PLN Mobile untuk Petugas Lapangan",
};

export default function IntakePage() {
  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Enterprise Header Banner */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {/* Brand Badges Bar */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#006877]/10 text-[#006877] text-xs font-bold">
              <Zap className="w-3.5 h-3.5 fill-[#006877]" />
              PLN UID S2JB
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-semibold">
              <Smartphone className="w-3.5 h-3.5 text-[#64748b]" />
              Field Intake Module
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Petugas Lapangan Siap
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 border border-[#bae6fd]">
              <Smartphone className="w-5 h-5 text-[#006877]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight">
                Entri Eviden Rating Pelanggan
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
                Catat ulasan Play Store pelanggan dan unggah bukti tangkapan layar untuk verifikasi otomatis OCR.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <Link
            href="/"
            className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 focus-utility-ring"
          >
            <ArrowLeft className="w-4 h-4 text-[#64748b]" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </div>

      {/* Form Component */}
      <IntakeForm />
    </div>
  );
}
