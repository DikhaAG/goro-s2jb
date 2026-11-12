"use client";

import React from "react";
import { trpc } from "@/lib/trpc";
import {
  FileSpreadsheet,
  Layers,
  Cpu,
  Globe,
  Eye,
  ShieldCheck,
  Database,
  ArrowRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export function PipelineFlowVisualizer() {
  const { data: workerStatus, isFetching } = trpc.migration.getDetailedWorkerStatus.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );

  const importQueue = workerStatus?.queues?.import;
  const ocrQueue = workerStatus?.queues?.ocr;
  const dbData = workerStatus?.database;

  const importThroughput = importQueue?.throughput?.jobsPerMinute || 0;
  const ocrThroughput = ocrQueue?.throughput?.jobsPerMinute || 0;
  const isOcrStalled = ocrQueue?.stallDetection?.isStalled || false;
  const isImportStalled = importQueue?.stallDetection?.isStalled || false;

  const nodes = [
    {
      id: "ingest",
      title: "1. Ingesti Berkas",
      subtitle: "Streaming CSV / XLSX",
      icon: FileSpreadsheet,
      status: "UP" as const,
      metricLabel: "Status Parser",
      metricValue: "Streaming Aktif",
      colorClass: "from-blue-500/10 to-indigo-500/10 border-indigo-200 text-indigo-700",
      iconColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
    },
    {
      id: "import_queue",
      title: "2. importQueue",
      subtitle: "BullMQ Impor Batch",
      icon: Layers,
      status: isImportStalled ? ("DEGRADED" as const) : ("UP" as const),
      metricLabel: "Menunggu / Aktif",
      metricValue: `${importQueue?.counts?.waiting || 0} / ${importQueue?.counts?.active || 0}`,
      subMetric: `${importThroughput} batch/menit`,
      colorClass: isImportStalled
        ? "from-amber-500/10 to-orange-500/10 border-amber-300 text-amber-800"
        : "from-cyan-500/10 to-sky-500/10 border-cyan-200 text-cyan-800",
      iconColor: isImportStalled
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-cyan-600 bg-cyan-50 border-cyan-200",
    },
    {
      id: "ocr_queue",
      title: "3. ocrQueue",
      subtitle: "BullMQ Ekstraksi",
      icon: Cpu,
      status: isOcrStalled ? ("DEGRADED" as const) : ("UP" as const),
      metricLabel: "Menunggu / Aktif",
      metricValue: `${ocrQueue?.counts?.waiting || 0} / ${ocrQueue?.counts?.active || 0}`,
      subMetric: `${ocrThroughput} ulasan/menit`,
      colorClass: isOcrStalled
        ? "from-rose-500/10 to-amber-500/10 border-rose-300 text-rose-800"
        : "from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-800",
      iconColor: isOcrStalled
        ? "text-rose-600 bg-rose-50 border-rose-200"
        : "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    {
      id: "cdn_fetch",
      title: "4. CDN & GDrive",
      subtitle: "Zero-Storage Stream",
      icon: Globe,
      status: "UP" as const,
      metricLabel: "Failover Jaringan",
      metricValue: "3 Endpoint",
      subMetric: "Memory Buffer",
      colorClass: "from-sky-500/10 to-blue-500/10 border-sky-200 text-sky-800",
      iconColor: "text-sky-600 bg-sky-50 border-sky-200",
    },
    {
      id: "rust_ocr",
      title: "5. Rust Vision Core",
      subtitle: "goro-engine (Axum & Tesseract)",
      icon: Eye,
      status: "UP" as const,
      metricLabel: "Fuzzy Triase",
      metricValue: "Native Multi-Pass",
      subMetric: "Port 8001 / CLI",
      colorClass: "from-teal-500/10 to-emerald-500/10 border-teal-200 text-teal-800",
      iconColor: "text-teal-600 bg-teal-50 border-teal-200",
    },
    {
      id: "anti_fraud",
      title: "6. Anti-Fraud",
      subtitle: "pHash & Hamming",
      icon: ShieldCheck,
      status: "UP" as const,
      metricLabel: "Deteksi Duplikat",
      metricValue: "64-bit Hash",
      subMetric: "Ambang Jarak <= 10",
      colorClass: "from-purple-500/10 to-pink-500/10 border-purple-200 text-purple-800",
      iconColor: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      id: "database",
      title: "7. PostgreSQL",
      subtitle: "Penyimpanan Ulasan",
      icon: Database,
      status: "UP" as const,
      metricLabel: "Total Ulasan",
      metricValue: `${dbData?.totalReviews || 0} baris`,
      subMetric: `${dbData?.approvedReviews || 0} Approved`,
      colorClass: "from-slate-500/10 to-zinc-500/10 border-slate-200 text-slate-800",
      iconColor: "text-slate-700 bg-slate-100 border-slate-200",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs space-y-4">
      {/* Visualizer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#006877]/10 flex items-center justify-center text-[#006877]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              Pipeline Flow Visualizer: Alur Proses Hulu ke Hilir
            </h3>
            <p className="text-xs text-[#64748b]">
              Pemantauan topologi data dari unggahan berkas hingga penyimpanan database terverifikasi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748b]">
            <span className={`w-2 h-2 rounded-full ${isFetching ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
            <span>{isFetching ? "Menyinkronkan..." : "Sinkronisasi Real-Time"}</span>
          </div>
        </div>
      </div>

      {/* Interactive 7-Node Flow Chain */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-3">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          return (
            <div key={node.id} className="relative flex flex-col min-w-0">
              <div
                className={`p-3.5 rounded-2xl border bg-gradient-to-b ${node.colorClass} shadow-xs flex flex-col justify-between h-full transition-all hover:shadow-sm`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center ${node.iconColor}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {node.status === "UP" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        UP
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        STALL
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-[#0f172a]">{node.title}</h4>
                  <p className="text-xs text-[#64748b] leading-tight mt-0.5">{node.subtitle}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-black/5 text-xs">
                  <div className="text-xs text-[#64748b]">{node.metricLabel}</div>
                  <div className="font-mono font-bold text-[#0f172a] text-xs truncate">
                    {node.metricValue}
                  </div>
                  {node.subMetric && (
                    <div className="text-xs font-mono text-[#006877] font-semibold mt-0.5 truncate">
                      {node.subMetric}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
