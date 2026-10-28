import React, { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Zap, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Masuk Sistem | GORO S2JB Command Center",
  description:
    "Portal Otentikasi Terpadu Multi-Peran Gerakan Operasi Rating & Review PLN UID S2JB",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden text-slate-100">
      {/* Background Ambience Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Corporate Brand Header */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-emerald-400 p-0.5 shadow-xl shadow-cyan-500/20 mb-4">
          <div className="w-full h-full bg-[#090d16] rounded-[14px] flex items-center justify-center">
            <Zap className="w-7 h-7 text-cyan-400" />
          </div>
        </div>

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 text-xs font-semibold mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>PLN UID S2JB COMMAND CENTER</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          GORO S2JB <span className="text-cyan-400">2026</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
          Sistem Pengawalan Rating & Ulasan Aplikasi PLN Mobile Berbasis AI OCR & Matriks RBAC
        </p>
      </div>

      {/* Form with Suspense Boundary */}
      <div className="w-full relative z-10">
        <Suspense
          fallback={
            <div className="w-full max-w-md mx-auto p-8 bg-slate-900/60 rounded-2xl border border-slate-800 text-center text-slate-400 text-sm">
              Memuat formulir autentikasi...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>

      {/* Footer copyright */}
      <footer className="mt-12 text-center text-xs text-slate-500 relative z-10">
        &copy; {new Date().getFullYear()} PT PLN (Persero) UID Sumatera Selatan, Jambi, dan Bengkulu.
      </footer>
    </div>
  );
}
