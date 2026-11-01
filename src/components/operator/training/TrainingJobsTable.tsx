"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { OcrTrainingJobStatus } from "@prisma/client";
import {
  Clock,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Loader2,
  X,
  Layers,
} from "lucide-react";

export function TrainingJobsTable() {
  const [selectedJobLogs, setSelectedJobLogs] = useState<any | null>(null);

  const { data: jobs, isLoading } = trpc.ocrTraining.getJobs.useQuery({ limit: 15 });

  const renderStatusBadge = (status: OcrTrainingJobStatus) => {
    switch (status) {
      case OcrTrainingJobStatus.COMPLETED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
            Selesai
          </span>
        );
      case OcrTrainingJobStatus.RUNNING:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]">
            <Loader2 className="w-3.5 h-3.5 text-[#0284c7] animate-spin" />
            Berjalan
          </span>
        );
      case OcrTrainingJobStatus.FAILED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
            <XCircle className="w-3.5 h-3.5 text-[#ef4444]" />
            Gagal / Dibatalkan
          </span>
        );
      case OcrTrainingJobStatus.PENDING:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
            <Clock className="w-3.5 h-3.5 text-[#f59e0b]" />
            Dalam Antrean
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden">
      <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006877]/10 text-[#006877] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              Riwayat Pekerjaan Pelatihan (Training Jobs)
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Log eksekusi komputasi background worker BullMQ beserta durasi dan trigger type.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Job ID & Target Versi</th>
              <th className="py-3 px-4">Tipe Pemicu</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Dataset & Epoch</th>
              <th className="py-3 px-4">Durasi</th>
              <th className="py-3 px-4">Waktu Mulai</th>
              <th className="py-3 px-4 text-right">Log Eksekusi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#334155]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#64748b]">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#00a2b9] mb-2" />
                  Memuat riwayat pekerjaan...
                </td>
              </tr>
            ) : !jobs || jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#64748b]">
                  Belum ada riwayat pekerjaan pelatihan.
                </td>
              </tr>
            ) : (
              jobs.map((job: any) => (
                <tr key={job.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-[#0f172a] text-xs">
                      {job.modelTargetVersion}
                    </div>
                    <div className="text-[10px] font-mono text-[#64748b] truncate max-w-[140px] mt-0.5">
                      {job.id}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="text-[11px] font-bold text-[#475569] bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      {job.triggerType}
                    </span>
                  </td>

                  <td className="py-3 px-4">{renderStatusBadge(job.status)}</td>

                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-[#0f172a]">{job.datasetSize} sampel</span>
                    <span className="text-[10px] text-[#64748b] block mt-0.5">
                      {job.totalEpochs} Total Epochs
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono font-medium text-[#334155]">
                    {job.durationSeconds ? `${job.durationSeconds} detik` : "-"}
                  </td>

                  <td className="py-3 px-4 text-[#334155]">
                    <div>
                      {new Date(job.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-[10px] text-[#64748b] mt-0.5">
                      Oleh: {job.createdBy?.name || "Otomatis (Sistem)"}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedJobLogs(job)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#cbd5e1] text-[#334155] hover:bg-white hover:text-[#0f172a] transition-all inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer focus-utility-ring"
                    >
                      <Terminal className="w-3.5 h-3.5 text-[#006877]" />
                      <span>Lihat Log</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Detail Log Eksekusi */}
      {selectedJobLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-xs"
            onClick={() => setSelectedJobLogs(null)}
          />
          <div className="relative bg-[#0f172a] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#334155] z-10 text-white animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#334155] mb-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#00A3E0]" />
                  Log Pekerjaan: {selectedJobLogs.modelTargetVersion}
                </h4>
                <p className="text-[11px] text-[#94a3b8] mt-0.5">
                  Status: {selectedJobLogs.status} | Trigger: {selectedJobLogs.triggerType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobLogs(null)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-white transition-colors cursor-pointer focus-utility-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedJobLogs.errorMessage && (
              <div className="mb-4 p-3.5 rounded-xl bg-[#fef2f2]/10 border border-[#fecaca]/30 text-xs text-[#fca5a5]">
                <strong className="text-white">Error: </strong> {selectedJobLogs.errorMessage}
              </div>
            )}

            <div className="bg-black/60 p-4 rounded-xl font-mono text-xs text-[#cbd5e1] max-h-72 overflow-y-auto space-y-1.5 border border-[#334155]">
              {Array.isArray(selectedJobLogs.logs) && selectedJobLogs.logs.length > 0 ? (
                selectedJobLogs.logs.map((log: string, idx: number) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-[#64748b] italic">Tidak ada catatan log pada pekerjaan ini.</div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-[#334155] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedJobLogs(null)}
                className="min-h-[44px] px-5 py-2 text-xs font-bold text-[#cbd5e1] hover:text-white bg-[#1e293b] hover:bg-[#334155] rounded-xl transition-all cursor-pointer focus-utility-ring"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

