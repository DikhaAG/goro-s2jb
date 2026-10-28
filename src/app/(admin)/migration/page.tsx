"use client";

import React from "react";
import { BulkDropzone } from "@/components/admin/BulkDropzone";
import { trpc } from "@/lib/trpc";
import {
  Database,
  History,
  FileSpreadsheet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MigrationPage() {
  const batchesQuery = trpc.migration.listBatches.useQuery(undefined, {
    refetchInterval: 5000,
  });

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-[#e2e8f0]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#006877] text-white flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-[#00a2b9]" />
          </div>
          <h1 className="text-headline-sm sm:text-headline-md text-[#0f172a] font-bold tracking-tight">
            Migrasi Massal Rekam Data Historis
          </h1>
        </div>
        <p className="text-body-meta text-[#64748b] mt-1">
          Muat rekam data masif Google Form (143.000+ baris) dan riwayat laporan acuan ke dalam basis data PostgreSQL menggunakan streaming parser berkinerja tinggi.
        </p>
      </div>

      {/* Dropzone Component */}
      <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0] card-floating-sm">
        <BulkDropzone />
      </div>

      {/* Recent Batch History */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 sm:p-6 space-y-4 card-floating-sm">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
          <h3 className="font-semibold text-base text-[#0f172a] flex items-center space-x-2">
            <History className="w-4 h-4 text-[#00a2b9]" />
            <span>Riwayat Batch Migrasi Terakhir</span>
          </h3>
          <span className="text-xs text-[#64748b]">
            Auto-refresh setiap 5 detik
          </span>
        </div>

        {batchesQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-[#64748b] animate-pulse">
            Memuat riwayat migrasi...
          </div>
        ) : !batchesQuery.data || batchesQuery.data.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#64748b]">
            Belum ada batch migrasi yang dieksekusi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-semibold">
                <tr>
                  <th className="py-2.5 px-3">WAKTU</th>
                  <th className="py-2.5 px-3">BERKAS</th>
                  <th className="py-2.5 px-3">TARGET</th>
                  <th className="py-2.5 px-3">BARIS BERHASIL</th>
                  <th className="py-2.5 px-3">BARIS GAGAL</th>
                  <th className="py-2.5 px-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-[#1e293b]">
                {batchesQuery.data.map((b) => (
                  <tr key={b.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="py-3 px-3 text-[#64748b]">
                      {new Date(b.createdAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#0f172a] flex items-center space-x-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-[#15803d] shrink-0" />
                      <span className="truncate max-w-[200px]">{b.fileName}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-[#006877]">
                      {b.targetType}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#15803d]">
                      {b.processedRows.toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 px-3 text-[#b91c1c]">
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
    </div>
  );
}
