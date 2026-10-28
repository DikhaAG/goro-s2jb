"use client";

import React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Database,
  Server,
  ShieldCheck,
  Layers,
  Cpu,
  CheckCircle2,
  RefreshCw,
  FolderGit2,
  Radio,
  Zap,
} from "lucide-react";

export default function HomePage() {
  const healthQuery = trpc.health.ping.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const unitsQuery = trpc.master.getUnits.useQuery();
  const versionsQuery = trpc.master.getVersions.useQuery();

  const isHealthy = healthQuery.data?.status === "HEALTHY";

  return (
    <main className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col">
      {/* Tactical Top Bar */}
      <header className="border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                GORO S2JB <span className="text-cyan-400">2026</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded">
                PLN UID S2JB
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Command Center & Sistem Validasi Eviden Rating PLN Mobile
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/intake"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/40 text-xs font-semibold transition"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Form Entri Eviden</span>
          </Link>

          <Link
            href="/migration"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/40 text-xs font-semibold transition"
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>Migrasi Data</span>
          </Link>

          <div className="flex items-center space-x-2 text-xs pl-2 border-l border-slate-800">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isHealthy ? "bg-emerald-400" : "bg-amber-400"
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isHealthy ? "bg-emerald-500" : "bg-amber-500"
                }`}
              ></span>
            </span>
            <span className="text-slate-300 font-mono hidden sm:inline">
              {healthQuery.isLoading
                ? "MEMERIKSA..."
                : isHealthy
                ? "SISTEM AKTIF"
                : "STATUS TERDEGRADASI"}
            </span>
          </div>

          <button
            onClick={() => healthQuery.refetch()}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 transition-colors border border-slate-700/60"
            title="Muat Ulang Status"
          >
            <RefreshCw
              className={`w-4 h-4 ${healthQuery.isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner / Stage Announcement */}
        <div className="rounded-xl p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-[#0e1726] border border-cyan-500/20 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-96 bg-cyan-500/5 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Fase 1: Lapisan Teknis Global
                </span>
                <span className="text-xs text-slate-400">
                  Ready for Full-Stack Operations
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Pondasi Taktis & Pipeline Eviden Terintegrasi
              </h2>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Skema relasional 13-kolom PostgreSQL, bus antrean BullMQ + Redis,
                lapisan tRPC v11 type-safe, serta microservice OCR & Perceptual Hashing
                siap mengawal target rating PLN Mobile 2026.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-xs text-slate-400">Total Unit Terdaftar</div>
                <div className="text-xl font-bold text-cyan-400 font-mono">
                  {unitsQuery.data ? `${unitsQuery.data.length} UP3` : "..."}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Infrastructure Heartbeat Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Service 1: PostgreSQL */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Database
              </span>
              <Database className="w-5 h-5 text-sky-400" />
            </div>
            <div className="my-3">
              <div className="text-xl font-bold font-mono text-white">
                PostgreSQL 16
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Latency:{" "}
                <span className="text-emerald-400 font-mono font-medium">
                  {healthQuery.data?.services?.database?.latencyMs ?? 0} ms
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {healthQuery.data?.services?.database?.status === "UP"
                  ? "Tersambung (goro_s2jb)"
                  : "Mengecek..."}
              </span>
            </div>
          </div>

          {/* Service 2: Redis & Queue */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Event Bus & Queue
              </span>
              <Server className="w-5 h-5 text-amber-400" />
            </div>
            <div className="my-3">
              <div className="text-xl font-bold font-mono text-white">
                Redis + BullMQ
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Heartbeat:{" "}
                <span className="text-emerald-400 font-mono font-medium">
                  {healthQuery.data?.services?.redis?.latencyMs ?? 0} ms
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {healthQuery.data?.services?.redis?.status === "UP"
                  ? "Siap Menerima Job"
                  : "Mengecek..."}
              </span>
            </div>
          </div>

          {/* Service 3: Local Storage */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Evidence Engine
              </span>
              <FolderGit2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="my-3">
              <div className="text-xl font-bold font-mono text-white">
                Local Storage
              </div>
              <div className="text-xs text-slate-400 mt-0.5 font-mono">
                uploads/evidence/YYYY/MM/DD
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Anti Path-Traversal Aktif</span>
            </div>
          </div>

          {/* Service 4: Python OCR & pHash */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                AI Vision Core
              </span>
              <Cpu className="w-5 h-5 text-purple-400" />
            </div>
            <div className="my-3">
              <div className="text-xl font-bold font-mono text-white">
                OCR + pHash
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Tesseract + RapidFuzz 64-bit
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-cyan-400">
              <Radio className="w-4 h-4" />
              <span>Subprocess Adapter Siap</span>
            </div>
          </div>
        </div>

        {/* Master Data Overview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Unit Structure List */}
          <div className="lg:col-span-2 rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Struktur Unit Induk Distribusi S2JB</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daftar UP3 dan ULP operasional yang disinkronisasi dari data acuan
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-1 rounded">
                {unitsQuery.data?.reduce((acc, u) => acc + u.ulps.length, 0) ?? 0} Total ULP
              </span>
            </div>

            {unitsQuery.isLoading ? (
              <div className="py-8 text-center text-sm text-slate-500 animate-pulse">
                Memuat data master unit...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unitsQuery.data?.map((up3) => (
                  <div
                    key={up3.id}
                    className="p-4 rounded-lg bg-slate-950/50 border border-slate-800/80 hover:border-slate-700/80 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-white tracking-wide">
                        {up3.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {up3.code}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {up3.ulps.map((ulp) => (
                        <span
                          key={ulp.id}
                          className="text-[11px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800"
                        >
                          {ulp.name.replace("ULP ", "")}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PLN Mobile Versions & Testing Roles */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Akun Uji Coba RBAC</span>
              </h3>
              <div className="space-y-2.5 mt-3 text-xs">
                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200">petugas_rivai</div>
                    <div className="text-[10px] text-slate-400">Petugas Lapangan (ULP Rivai)</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800/50">
                    FIELD
                  </span>
                </div>

                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200">pegawai_operator</div>
                    <div className="text-[10px] text-slate-400">Operator Verifikator S2JB</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/50">
                    OPERATOR
                  </span>
                </div>

                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200">manager_s2jb</div>
                    <div className="text-[10px] text-slate-400">Executive & Unit Manager</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800/50">
                    MANAGER
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Versi PLN Mobile Aktif
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {versionsQuery.data?.map((v) => (
                  <span
                    key={v.id}
                    className="text-xs font-mono px-2 py-1 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-800/30"
                  >
                    {v.version}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#060a11] px-6 py-4 text-center text-xs text-slate-500">
        PLN UID S2JB Gotong Royong System (GORO) &copy; 2026. All rights reserved.
      </footer>
    </main>
  );
}
