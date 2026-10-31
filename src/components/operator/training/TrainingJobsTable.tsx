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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Selesai
          </span>
        );
      case OcrTrainingJobStatus.RUNNING:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Loader2 className="w-3 h-3 text-sky-600 animate-spin" />
            Berjalan
          </span>
        );
      case OcrTrainingJobStatus.FAILED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Gagal / Dibatalkan
          </span>
        );
      case OcrTrainingJobStatus.PENDING:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Dalam Antrean
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-600" />
            Riwayat Pekerjaan Pelatihan (Training Jobs)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Log eksekusi komputasi background worker BullMQ beserta durasi dan trigger type.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
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
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
                  Memuat riwayat pekerjaan...
                </td>
              </tr>
            ) : !jobs || jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  Belum ada riwayat pekerjaan pelatihan.
                </td>
              </tr>
            ) : (
              jobs.map((job: any) => (
                <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 text-xs">
                      {job.modelTargetVersion}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                      {job.id}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {job.triggerType}
                    </span>
                  </td>

                  <td className="py-3 px-4">{renderStatusBadge(job.status)}</td>

                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800">{job.datasetSize} sampel</span>
                    <span className="text-[10px] text-slate-400 block">
                      {job.totalEpochs} Total Epochs
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-700">
                    {job.durationSeconds ? `${job.durationSeconds} detik` : "-"}
                  </td>

                  <td className="py-3 px-4 text-slate-600">
                    <div>
                      {new Date(job.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Oleh: {job.createdBy?.name || "Otomatis (Sistem)"}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedJobLogs(job)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors inline-flex items-center gap-1 text-[11px]"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      Lihat Log
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
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setSelectedJobLogs(null)}
          />
          <div className="relative bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-800 z-10 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Log Pekerjaan: {selectedJobLogs.modelTargetVersion}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Status: {selectedJobLogs.status} | Trigger: {selectedJobLogs.triggerType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJobLogs(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedJobLogs.errorMessage && (
              <div className="mb-3 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300">
                <strong>Error: </strong> {selectedJobLogs.errorMessage}
              </div>
            )}

            <div className="bg-black/60 p-4 rounded-xl font-mono text-xs text-slate-300 max-h-72 overflow-y-auto space-y-1">
              {Array.isArray(selectedJobLogs.logs) && selectedJobLogs.logs.length > 0 ? (
                selectedJobLogs.logs.map((log: string, idx: number) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic">Tidak ada catatan log pada pekerjaan ini.</div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedJobLogs(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
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

