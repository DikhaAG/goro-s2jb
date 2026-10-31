"use client";

import React from "react";
import Link from "next/link";
import { BulkDropzone } from "@/components/admin/BulkDropzone";
import { trpc } from "@/lib/trpc";
import {
  Database,
  History,
  FileSpreadsheet,
  Activity,
  ArrowRight,
  Zap,
  RotateCw,
  Layers,
  Server,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MigrationPage() {
  const batchesQuery = trpc.migration.listBatches.useQuery(undefined, {
    refetchInterval: 5000,
  });

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Enterprise Command Header Banner (Harmonized with Design Source of Truth) */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Brand Badges Bar */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#006877]/10 text-[#006877] text-xs font-bold">
              <Zap className="w-3.5 h-3.5 fill-[#006877]" />
              PLN UID S2JB
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-semibold">
              <Layers className="w-3.5 h-3.5 text-[#64748b]" />
              High-Throughput Streaming Parser
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              BullMQ Worker Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 border border-[#bae6fd]">
              <Database className="w-5 h-5 text-[#006877]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight">
                Migrasi Massal Rekam Data Historis
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
                Muat rekam data masif Google Form (143.000+ baris) dan riwayat laporan acuan ke dalam basis data PostgreSQL menggunakan streaming parser berkinerja tinggi.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => batchesQuery.refetch()}
            className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 focus-utility-ring cursor-pointer"
            title="Segarkan riwayat migrasi"
          >
            <RotateCw className={`w-3.5 h-3.5 ${batchesQuery.isRefetching ? "animate-spin text-[#006877]" : "text-[#64748b]"}`} />
            <span>Segarkan</span>
          </button>

          <Link
            href="/migration/monitor"
            className="min-h-[44px] px-4 py-2 bg-[#00a2b9] hover:bg-[#008c9f] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 focus-utility-ring"
          >
            <Activity className="w-4 h-4 text-white" />
            <span>Pusat Pemantauan Worker</span>
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </Link>
        </div>
      </div>

      {/* 2. Dropzone Component */}
      <BulkDropzone />

      {/* 3. Recent Batch History Table Card */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white border border-[#e2e8f0] flex items-center justify-center text-[#006877]">
              <History className="w-4 h-4 text-[#006877]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0f172a]">
                Riwayat Batch Migrasi Terakhir
              </h3>
              <p className="text-[11px] text-[#64748b]">
                Pembaruan otomatis setiap 5 detik melalui streaming polling
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-[#64748b] bg-white border border-[#e2e8f0] px-2.5 py-1 rounded-lg self-start sm:self-auto">
            {batchesQuery.data ? `${batchesQuery.data.length} Batch Tercatat` : "Memuat..."}
          </span>
        </div>

        {batchesQuery.isLoading ? (
          <div className="py-12 text-center text-xs text-[#64748b] animate-pulse">
            Memuat riwayat migrasi berkas...
          </div>
        ) : !batchesQuery.data || batchesQuery.data.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#64748b] space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center mx-auto text-[#94a3b8]">
              <FileSpreadsheet className="w-6 h-6 text-[#94a3b8]" />
            </div>
            <p className="font-semibold text-sm text-[#0f172a]">Belum Ada Batch Migrasi</p>
            <p className="text-xs text-[#64748b]">
              Gunakan formulir dropzone di atas untuk mengunggah berkas CSV atau Excel historis.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Berkas</th>
                  <th className="py-3 px-4">Target Skema</th>
                  <th className="py-3 px-4 text-right">Baris Berhasil</th>
                  <th className="py-3 px-4 text-right">Baris Gagal</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
                {batchesQuery.data.map((b) => (
                  <tr key={b.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="py-3.5 px-4 text-[#64748b] font-mono whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#0f172a]">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-[#15803d] shrink-0" />
                        <span className="truncate max-w-[220px]" title={b.fileName}>
                          {b.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#006877]">
                      {b.targetType}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-right text-[#15803d]">
                      {b.processedRows.toLocaleString("id-ID")}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-right text-[#b91c1c]">
                      {b.failedRows.toLocaleString("id-ID")}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          b.status === "COMPLETED"
                            ? "bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]"
                            : b.status === "FAILED"
                            ? "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]"
                            : b.status === "PROCESSING"
                            ? "bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd] animate-pulse"
                            : "bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            b.status === "COMPLETED"
                              ? "bg-[#16a34a]"
                              : b.status === "FAILED"
                              ? "bg-[#ef4444]"
                              : b.status === "PROCESSING"
                              ? "bg-[#0284c7]"
                              : "bg-[#f59e0b]"
                          }`}
                        />
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
