"use client";

import React from "react";
import Link from "next/link";
import { BulkDropzone } from "@/components/admin/BulkDropzone";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Database,
  History,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MigrationPage() {
  const batchesQuery = trpc.migration.listBatches.useQuery(undefined, {
    refetchInterval: 5000,
  });

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <Database className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide text-white">
                GORO S2JB <span className="text-cyan-400">2026</span>
              </span>
              <span className="text-xs text-slate-400 ml-2 font-mono">/ Admin Data Migration</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="warning" className="gap-1.5 py-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Panel Operator & Administrator</span>
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-8">
        {/* Banner */}
        <div className="p-6 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-[#121c2e] border border-amber-500/30 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Modul 4.1 PRD: Bulk Data Migration Engine
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Migrasi Massal Rekam Data Historis
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Muat rekam data masif Google Form (*143.000+ baris*) dan riwayat laporan acuan ke dalam basis data PostgreSQL
                menggunakan streaming parser dengan konsumsi memori terisolasi (&lt; 512 MB).
              </p>
            </div>
          </div>
        </div>

        {/* Dropzone Component */}
        <BulkDropzone />

        {/* Recent Batch History */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-base text-white flex items-center space-x-2">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Riwayat Batch Migrasi Terakhir</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Auto-refresh setiap 5s
            </span>
          </div>

          {batchesQuery.isLoading ? (
            <div className="py-6 text-center text-sm text-slate-500 animate-pulse">
              Memuat riwayat migrasi...
            </div>
          ) : !batchesQuery.data || batchesQuery.data.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Belum ada batch migrasi yang dieksekusi.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2.5 px-3">WAKTU</th>
                    <th className="py-2.5 px-3">BERKAS</th>
                    <th className="py-2.5 px-3">TARGET</th>
                    <th className="py-2.5 px-3">BARIS BERHASIL</th>
                    <th className="py-2.5 px-3">BARIS GAGAL</th>
                    <th className="py-2.5 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {batchesQuery.data.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {new Date(b.createdAt).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-3 px-3 font-medium text-white flex items-center space-x-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{b.fileName}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-cyan-400">
                        {b.targetType}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                        {b.processedRows.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-3 font-mono text-red-400">
                        {b.failedRows.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            b.status === "COMPLETED"
                              ? "success"
                              : b.status === "FAILED"
                              ? "destructive"
                              : "warning"
                          }
                        >
                          {b.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#060a11] px-6 py-4 text-center text-xs text-slate-500">
        PLN UID S2JB Bulk Migration Subsystem &copy; 2026. Memory-Safe Streaming Engine.
      </footer>
    </div>
  );
}
