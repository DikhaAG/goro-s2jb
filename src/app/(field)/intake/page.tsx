import React from "react";
import Link from "next/link";
import { IntakeForm } from "@/components/forms/IntakeForm";
import { ArrowLeft, Shield, Zap } from "lucide-react";

export const metadata = {
  title: "Entri Eviden Lapangan | GORO S2JB 2026",
  description: "Formulir cepat pengumpulan bukti rating pelanggan PLN Mobile untuk Petugas Lapangan",
};

export default function IntakePage() {
  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide text-white">
                GORO S2JB <span className="text-cyan-400">2026</span>
              </span>
              <span className="text-xs text-slate-400 ml-2 font-mono">/ Field Intake</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Modul Petugas Lapangan</span>
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 my-auto">
        <IntakeForm />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#060a11] px-4 py-3 text-center text-[11px] text-slate-500">
        PLN UID S2JB Field Intake Engine &copy; 2026. Data terenkripsi dan diverifikasi otomatis.
      </footer>
    </div>
  );
}
