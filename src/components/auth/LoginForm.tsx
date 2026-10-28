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
    } catch (err: any) {
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
          className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-200 text-sm flex items-start space-x-3 shadow-lg backdrop-blur"
        >
          {isLocked ? (
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">
              {isLocked ? "Akses Terkunci Sementara" : "Autentikasi Gagal"}
            </span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {successInfo && (
        <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-200 text-sm flex items-center space-x-3 shadow-lg backdrop-blur">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-medium">{successInfo}</span>
        </div>
      )}

      {/* Main Login Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400" />

        <div className="space-y-5">
          {/* Username Input */}
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              Username / NIP Petugas
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
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
                className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 transition"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Kata Sandi
              </label>
              <span className="text-[11px] text-slate-400">
                Salted Bcrypt / PBKDF2
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
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
                className="w-full pl-10 pr-11 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
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
          <button
            type="submit"
            disabled={isLoading || isLocked}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi Kredensial...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Command Center</span>
                <ArrowRight className="w-4 h-4 font-bold" />
              </>
            )}
          </button>
        </div>

        {/* Quick Demo Role Selector */}
        <div className="mt-7 pt-5 border-t border-slate-800">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2.5 text-center">
            Akun Default Lingkungan S2JB:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickFill("petugas_rivai", "password123")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 text-left transition"
            >
              <div className="font-bold text-cyan-400">Petugas Lapangan</div>
              <div className="text-[10px] text-slate-400 truncate">petugas_rivai</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("pegawai_operator", "password123")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 text-left transition"
            >
              <div className="font-bold text-amber-400">Pegawai Triase</div>
              <div className="text-[10px] text-slate-400 truncate">pegawai_operator</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("manager_s2jb", "password123")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 text-left transition"
            >
              <div className="font-bold text-indigo-400">Manager S2JB</div>
              <div className="text-[10px] text-slate-400 truncate">manager_s2jb</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("superadmin", "password123")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 text-left transition"
            >
              <div className="font-bold text-emerald-400">Super Admin</div>
              <div className="text-[10px] text-slate-400 truncate">superadmin</div>
            </button>
          </div>
        </div>
      </form>

      {/* Security Footer Notice */}
      <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-cyan-500" />
        <span>Sesi terenkripsi HTTP-Only & Anti Brute-Force Redis aktif</span>
      </div>
    </div>
  );
}
