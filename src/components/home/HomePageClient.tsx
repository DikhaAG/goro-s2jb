"use client";

import React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import {
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
  ArrowRight,
  FileUp,
  CheckSquare,
  BarChart3,
  Users,
} from "lucide-react";

export function HomePageClient() {
  const sessionQuery = trpc.auth.getSession.useQuery();
  const isSuperAdmin = sessionQuery.data?.role === "SUPER_ADMIN";

  const healthQuery = trpc.health.ping.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const unitsQuery = trpc.master.getUnits.useQuery();
  const versionsQuery = trpc.master.getVersions.useQuery();

  const isHealthy = healthQuery.data?.status === "HEALTHY";

  return (
    <AppShell pageTitle="Beranda">
      <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header Banner */}
        <div className="rounded-2xl p-6 sm:p-8 bg-white border border-[#e2e8f0] shadow-xs relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral" className="gap-1 font-semibold">
                  <Zap className="w-3.5 h-3.5 text-[#006877]" />
                  <span>PLN UID S2JB</span>
                </Badge>
                <span className="text-xs text-[#64748b]">
                  Sistem Validasi Eviden Rating PLN Mobile 2026
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                <span className="relative flex h-3 w-3">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHealthy ? "bg-[#16a34a]" : "bg-[#f59e0b]"
                      }`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${isHealthy ? "bg-[#16a34a]" : "bg-[#f59e0b]"
                      }`}
                  ></span>
                </span>
                <span className="text-xs font-semibold text-[#0f172a]">
                  {healthQuery.isLoading
                    ? "Memeriksa..."
                    : isHealthy
                      ? "Sistem Aktif Normal"
                      : "Layanan Terdegradasi"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => healthQuery.refetch()}
                className="min-h-[44px] h-11 px-4 rounded-xl bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring"
                title="Muat Ulang Status Infrastruktur"
              >
                <RefreshCw
                  className={`w-4 h-4 text-[#64748b] ${healthQuery.isFetching ? "animate-spin" : ""
                    }`}
                />
                <span>Segarkan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Navigation Cards Hub */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/intake"
            className="group block p-5 rounded-2xl bg-white border border-[#e2e8f0] hover:border-[#00a2b9] hover:shadow-xs transition duration-150 focus-utility-ring"
          >
            <div className="w-10 h-10 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FileUp className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#0f172a] group-hover:text-[#006877] transition-colors flex items-center justify-between">
              <span>Entri Eviden</span>
              <ArrowRight className="w-4 h-4 text-[#94a3b8] group-hover:text-[#00a2b9] group-hover:translate-x-0.5 transition-all" />
            </h2>
            <p className="text-xs text-[#64748b] mt-1 line-clamp-2">
              Formulir cepat pengumpulan bukti tangkapan layar ulasan pelanggan Play Store.
            </p>
          </Link>

          <Link
            href="/triage"
            className="group block p-5 rounded-2xl bg-white border border-[#e2e8f0] hover:border-[#f59e0b] hover:shadow-xs transition duration-150 focus-utility-ring"
          >
            <div className="w-10 h-10 rounded-xl bg-[#fff7ed] text-[#b45309] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#0f172a] group-hover:text-[#b45309] transition-colors flex items-center justify-between">
              <span>Triase Ulasan Kuning</span>
              <ArrowRight className="w-4 h-4 text-[#94a3b8] group-hover:text-[#f59e0b] group-hover:translate-x-0.5 transition-all" />
            </h2>
            <p className="text-xs text-[#64748b] mt-1 line-clamp-2">
              Dasbor verifikasi operator (human in the loop) dengan hotkey keyboard taktis.
            </p>
          </Link>

          <Link
            href="/reports"
            className="group block p-5 rounded-2xl bg-white border border-[#e2e8f0] hover:border-[#0284c7] hover:shadow-xs transition duration-150 focus-utility-ring"
          >
            <div className="w-10 h-10 rounded-xl bg-[#f0f9ff] text-[#0369a1] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#0f172a] group-hover:text-[#0369a1] transition-colors flex items-center justify-between">
              <span>Laporan Eksekutif</span>
              <ArrowRight className="w-4 h-4 text-[#94a3b8] group-hover:text-[#0284c7] group-hover:translate-x-0.5 transition-all" />
            </h2>
            <p className="text-xs text-[#64748b] mt-1 line-clamp-2">
              Agregasi capaian harian, H-1, bulanan, dan ekspor spreadsheet terenkripsi.
            </p>
          </Link>

          {isSuperAdmin && (
            <Link
              href="/users"
              className="group block p-5 rounded-2xl bg-white border border-[#e2e8f0] hover:border-[#16a34a] hover:shadow-xs transition duration-150 focus-utility-ring"
            >
              <div className="w-10 h-10 rounded-xl bg-[#ecfdf5] text-[#15803d] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-[#0f172a] group-hover:text-[#15803d] transition-colors flex items-center justify-between">
                <span>Manajemen Pengguna</span>
                <ArrowRight className="w-4 h-4 text-[#94a3b8] group-hover:text-[#16a34a] group-hover:translate-x-0.5 transition-all" />
              </h2>
              <p className="text-xs text-[#64748b] mt-1 line-clamp-2">
                Kelola akun operasional berjenjang, penugasan unit, dan catatan audit log.
              </p>
            </Link>
          )}
        </div>

        {/* Infrastructure Heartbeat Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Service 1: PostgreSQL */}
          <div className="rounded-2xl bg-white border border-[#e2e8f0] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Basis Data Relasional
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#e7eeff] text-[#006877] flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-lg font-bold text-[#0f172a]">
                PostgreSQL 16
              </div>
              <div className="text-xs text-[#64748b] mt-0.5">
                Latensi:{" "}
                <span className="text-[#15803d] font-semibold">
                  {healthQuery.data?.services?.database?.latencyMs ?? 0} ms
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#15803d] font-medium pt-2 border-t border-[#f1f5f9]">
              <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
              <span>
                {healthQuery.data?.services?.database?.status === "UP"
                  ? "Tersambung (goro_s2jb)"
                  : "Mengecek koneksi..."}
              </span>
            </div>
          </div>

          {/* Service 2: Redis & Queue */}
          <div className="rounded-2xl bg-white border border-[#e2e8f0] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Antrean & Event Bus
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#fff7ed] text-[#c2410c] flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-lg font-bold text-[#0f172a]">
                Redis + BullMQ
              </div>
              <div className="text-xs text-[#64748b] mt-0.5">
                Detak Jantung:{" "}
                <span className="text-[#15803d] font-semibold">
                  {healthQuery.data?.services?.redis?.latencyMs ?? 0} ms
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#15803d] font-medium pt-2 border-t border-[#f1f5f9]">
              <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
              <span>
                {healthQuery.data?.services?.redis?.status === "UP"
                  ? "Siap Memproses Job"
                  : "Mengecek antrean..."}
              </span>
            </div>
          </div>

          {/* Service 3: Local Storage */}
          <div className="rounded-2xl bg-white border border-[#e2e8f0] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Penyimpanan Bukti
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#ecfdf5] text-[#15803d] flex items-center justify-center">
                <FolderGit2 className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-lg font-bold text-[#0f172a]">
                Penyimpanan Lokal
              </div>
              <div className="text-xs text-[#64748b] mt-0.5 truncate font-mono">
                uploads/evidence/YYYY/MM/DD
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#15803d] font-medium pt-2 border-t border-[#f1f5f9]">
              <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
              <span>Proteksi Traversal Aktif</span>
            </div>
          </div>

          {/* Service 4: Python OCR & pHash */}
          <div className="rounded-2xl bg-white border border-[#e2e8f0] p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                Pemrosesan Cerdas
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#f3e8ff] text-[#7e22ce] flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-lg font-bold text-[#0f172a]">
                OCR + pHash 64-bit
              </div>
              <div className="text-xs text-[#64748b] mt-0.5">
                Tesseract + RapidFuzz
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#006877] font-medium pt-2 border-t border-[#f1f5f9]">
              <Radio className="w-4 h-4 text-[#00a2b9]" />
              <span>Subproses Adaptif Aktif</span>
            </div>
          </div>
        </div>

        {/* Master Data Overview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Unit Structure List */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-[#e2e8f0] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#006877]" />
                  <span>Struktur Unit Induk Distribusi S2JB</span>
                </h3>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Daftar UP3 dan ULP operasional yang disinkronkan dari lembar acuan
                </p>
              </div>
              <Badge variant="neutral" className="font-semibold text-xs">
                {unitsQuery.data?.reduce((acc, u) => acc + u.ulps.length, 0) ?? 0} Total ULP
              </Badge>
            </div>

            {unitsQuery.isLoading ? (
              <div className="py-8 text-center text-sm text-[#94a3b8] animate-pulse">
                Memuat data master unit...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unitsQuery.data?.map((up3) => (
                  <div
                    key={up3.id}
                    className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#cbd5e1] transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-[#0f172a]">
                        {up3.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#475569] border border-[#e2e8f0]">
                        {up3.code}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {up3.ulps.map((ulp) => (
                        <span
                          key={ulp.id}
                          className="text-[11px] px-2 py-0.5 rounded bg-white text-[#475569] border border-[#e2e8f0]"
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

          {/* Testing Roles & Versions */}
          <div className="rounded-2xl bg-white border border-[#e2e8f0] p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2 border-b border-[#f1f5f9] pb-3">
                <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
                <span>Akun Uji Coba RBAC</span>
              </h3>
              <div className="space-y-2.5 mt-3 text-xs">
                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0f172a]">petugas_rivai</div>
                    <div className="text-[11px] text-[#64748b]">Petugas Lapangan (ULP Rivai)</div>
                  </div>
                  <Badge variant="info">FIELD</Badge>
                </div>

                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0f172a]">pegawai_operator</div>
                    <div className="text-[11px] text-[#64748b]">Operator Verifikator S2JB</div>
                  </div>
                  <Badge variant="warning">OPERATOR</Badge>
                </div>

                <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0f172a]">manager_s2jb</div>
                    <div className="text-[11px] text-[#64748b]">Executive & Unit Manager</div>
                  </div>
                  <Badge variant="neutral">MANAGER</Badge>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">
                Versi PLN Mobile Terdaftar
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {versionsQuery.data?.map((v) => (
                  <span
                    key={v.id}
                    className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#e7eeff] text-[#006877] font-medium border border-[#cfdaf2]"
                  >
                    {v.version}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
