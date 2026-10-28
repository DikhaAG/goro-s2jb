"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage("Username dan kata sandi wajib diisi.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.locked) {
          setIsLocked(true);
        }
        setErrorMessage(data.error || "Gagal masuk ke sistem.");
        setIsLoading(false);
        return;
      }

      setSuccessInfo(`Selamat datang, ${data.user.name}! Mengalihkan...`);

      // Determine redirect destination
      const targetUrl = redirectParam || data.redirectUrl || "/";

      // Refresh and navigate
      router.refresh();
      setTimeout(() => {
        router.push(targetUrl);
      }, 600);
    } catch {
      setErrorMessage("Koneksi gagal. Periksa jaringan Anda dan coba lagi.");
      setIsLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Tactical Status Alerts */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-5 p-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] text-xs flex items-start space-x-3 shadow-xs"
        >
          {isLocked ? (
            <ShieldAlert className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-bold block mb-0.5 text-sm">
              {isLocked ? "Akses Terkunci Sementara" : "Autentikasi Gagal"}
            </span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {successInfo && (
        <div className="mb-5 p-4 rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46] text-xs flex items-center space-x-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-[#16a34a] shrink-0" />
          <span className="font-semibold text-sm">{successInfo}</span>
        </div>
      )}

      {/* Main Login Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#e2e8f0] rounded-2xl p-7 shadow-xs relative overflow-hidden"
      >
        <div className="space-y-4">
          {/* Username Input */}
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-bold text-[#0f172a] mb-1.5"
            >
              Username / Akun Petugas
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
                <User className="w-4 h-4" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                disabled={isLoading || isLocked}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="misal: petugas_rivai"
                className="w-full pl-10 pr-4 py-2.5 min-h-[44px] h-11 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] placeholder-[#94a3b8] text-sm focus-utility-ring disabled:opacity-50 transition"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-bold text-[#0f172a]"
              >
                Kata Sandi
              </label>
              <span className="text-[11px] text-[#64748b] font-mono">
                Salted PBKDF2
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94a3b8]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                disabled={isLoading || isLocked}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-11 py-2.5 min-h-[44px] h-11 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] placeholder-[#94a3b8] text-sm focus-utility-ring disabled:opacity-50 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#64748b] hover:text-[#0f172a] transition cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || isLocked}
            className="w-full min-h-[44px] h-11 bg-[#00a2b9] hover:bg-[#008b9e] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi Kredensial...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>

        {/* Quick Demo Role Selector */}
        <div className="mt-6 pt-5 border-t border-[#f1f5f9]">
          <p className="text-[11px] uppercase tracking-wider text-[#64748b] font-bold mb-2.5 text-center">
            Pilih Cepat Akun Simulasi:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickFill("petugas_rivai", "password123")}
              className="p-2.5 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] text-left transition cursor-pointer min-h-[44px]"
            >
              <div className="font-bold text-[#006877]">Petugas Lapangan</div>
              <div className="text-[11px] text-[#64748b] font-mono truncate">petugas_rivai</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("pegawai_operator", "password123")}
              className="p-2.5 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] text-left transition cursor-pointer min-h-[44px]"
            >
              <div className="font-bold text-[#b45309]">Pegawai Triase</div>
              <div className="text-[11px] text-[#64748b] font-mono truncate">pegawai_operator</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("manager_s2jb", "password123")}
              className="p-2.5 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] text-left transition cursor-pointer min-h-[44px]"
            >
              <div className="font-bold text-[#0369a1]">Manager S2JB</div>
              <div className="text-[11px] text-[#64748b] font-mono truncate">manager_s2jb</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("superadmin", "password123")}
              className="p-2.5 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] text-left transition cursor-pointer min-h-[44px]"
            >
              <div className="font-bold text-[#15803d]">Super Admin</div>
              <div className="text-[11px] text-[#64748b] font-mono truncate">superadmin</div>
            </button>
          </div>
        </div>
      </form>

      {/* Security Footer Notice */}
      <div className="mt-5 flex items-center justify-center space-x-2 text-xs text-[#64748b]">
        <ShieldCheck className="w-4 h-4 text-[#00a2b9]" />
        <span>Sesi terenkripsi HTTP-Only & Proteksi Brute-Force Redis</span>
      </div>
    </div>
  );
}
