import React, { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Zap, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Masuk Sistem | GORO S2JB Command Center",
  description:
    "Portal Otentikasi Terpadu Multi-Peran Gerakan Operasi Rating & Review PLN UID S2JB",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col justify-center items-center px-4 py-12 relative text-[#0f172a]">
      {/* Corporate Brand Header */}
      <div className="text-center mb-8 max-w-md mx-auto">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#006877] text-white shadow-xs mb-4">
          <Zap className="w-7 h-7 text-[#f97316] fill-[#f97316]" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Badge variant="neutral" className="gap-1.5 font-semibold text-xs py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#006877]" />
            <span>PLN UID S2JB</span>
          </Badge>
          <span className="text-xs font-mono text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            2026
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a]">
          Masuk ke Portal Operasional
        </h1>
        <p className="text-xs sm:text-sm text-[#64748b] mt-1.5 leading-relaxed">
          Sistem Pengawalan Rating & Ulasan Aplikasi PLN Mobile
        </p>
      </div>

      {/* Form with Suspense Boundary */}
      <div className="w-full max-w-md mx-auto">
        <Suspense
          fallback={
            <div className="w-full p-8 bg-white rounded-2xl border border-[#e2e8f0] text-center text-[#64748b] text-sm shadow-xs">
              Memuat formulir autentikasi...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>

      {/* Footer copyright */}
      <footer className="mt-10 text-center text-xs text-[#94a3b8]">
        &copy; {new Date().getFullYear()} PT PLN (Persero) UID Sumatera Selatan, Jambi, dan Bengkulu.
      </footer>
    </div>
  );
}
