"use client";

import React from "react";
import { Database, Cpu, Eye, Globe, RefreshCw, Terminal, CheckCircle2, AlertTriangle, XCircle, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ServiceItem {
  name: string;
  port: number;
  serviceType: string;
  status: "UP" | "DOWN" | "DEGRADED";
  latencyMs?: number;
  pid?: number;
  processCommand?: string;
}

interface ServiceStatusGridProps {
  services: ServiceItem[];
  onRestartWorker: (workerType: "import" | "ocr" | "python") => void;
  onViewLogs: (logFileName: string) => void;
  isRestarting?: boolean;
}

export function ServiceStatusGrid({
  services,
  onRestartWorker,
  onViewLogs,
  isRestarting = false,
}: ServiceStatusGridProps) {
  const getServiceIcon = (type: string) => {
    switch (type) {
      case "POSTGRES":
        return <Database className="w-5 h-5 text-indigo-600" />;
      case "REDIS":
        return <Cpu className="w-5 h-5 text-rose-500" />;
      case "PYTHON_OCR":
        return <Eye className="w-5 h-5 text-emerald-600" />;
      case "WEB_SERVER":
        return <Globe className="w-5 h-5 text-[#006877]" />;
      default:
        return <Terminal className="w-5 h-5 text-[#64748b]" />;
    }
  };

  const getStatusBadge = (status: "UP" | "DOWN" | "DEGRADED") => {
    switch (status) {
      case "UP":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
            Aktif
          </span>
        );
      case "DEGRADED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            Terganggu
          </span>
        );
      case "DOWN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            Terhenti
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {services.map((svc) => {
        const canRestart = svc.serviceType === "PYTHON_OCR";
        const associatedLog =
          svc.serviceType === "PYTHON_OCR"
            ? "ocr_service.log"
            : svc.serviceType === "WEB_SERVER"
            ? "system_runtime.log"
            : null;

        return (
          <div
            key={`${svc.serviceType}-${svc.port}`}
            className="p-5 bg-white rounded-2xl border border-[#e2e8f0] shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center shrink-0">
                  {getServiceIcon(svc.serviceType)}
                </div>
                {getStatusBadge(svc.status)}
              </div>

              <h4 className="text-sm font-bold text-[#0f172a] tracking-tight">{svc.name}</h4>
              <p className="text-xs font-mono text-[#64748b] mt-0.5">Port TCP: {svc.port}</p>

              <div className="mt-4 pt-3 border-t border-[#f1f5f9] space-y-1.5 text-xs text-[#475569]">
                <div className="flex justify-between items-center">
                  <span className="text-[#64748b]">Process ID:</span>
                  <span className="font-mono font-bold text-[#0f172a]">
                    {svc.pid ? `PID ${svc.pid}` : "Tidak Terdeteksi"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748b]">Latensi Respon:</span>
                  <span className="font-mono font-bold text-[#006877]">
                    {svc.latencyMs !== undefined ? `${svc.latencyMs} ms` : "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center justify-between gap-2">
              {associatedLog ? (
                <button
                  type="button"
                  onClick={() => onViewLogs(associatedLog)}
                  className="text-xs text-[#006877] hover:text-[#00a2b9] font-bold flex items-center gap-1.5 transition-colors focus-utility-ring rounded px-1.5 py-1 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Lihat Log</span>
                </button>
              ) : (
                <span className="text-xs text-[#94a3b8] italic">Layanan Daemon</span>
              )}

              {canRestart && (
                <button
                  type="button"
                  disabled={isRestarting}
                  onClick={() => onRestartWorker("python")}
                  className="min-h-[36px] text-xs px-3 py-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#334155] font-bold transition-all focus-utility-ring flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRestarting ? "animate-spin text-[#006877]" : "text-[#64748b]"}`} />
                  <span>Restart</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
