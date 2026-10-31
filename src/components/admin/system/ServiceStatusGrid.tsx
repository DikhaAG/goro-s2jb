"use client";

import React from "react";
import { Database, Cpu, Eye, Globe, RefreshCw, Terminal, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        return <Globe className="w-5 h-5 text-[#00A3E0]" />;
      default:
        return <Terminal className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: "UP" | "DOWN" | "DEGRADED") => {
    switch (status) {
      case "UP":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Aktif
          </Badge>
        );
      case "DEGRADED":
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 font-medium">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Terganggu
          </Badge>
        );
      case "DOWN":
        return (
          <Badge className="bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1 font-medium">
            <XCircle className="w-3 h-3 text-rose-600" />
            Terhenti
          </Badge>
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
            className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  {getServiceIcon(svc.serviceType)}
                </div>
                {getStatusBadge(svc.status)}
              </div>

              <h4 className="text-sm font-semibold text-slate-900 tracking-tight">{svc.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">Port TCP: {svc.port}</p>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Process ID:</span>
                  <span className="font-mono font-medium text-slate-800">
                    {svc.pid ? `PID ${svc.pid}` : "Tidak Terdeteksi"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Latensi Respon:</span>
                  <span className="font-medium text-slate-800">
                    {svc.latencyMs !== undefined ? `${svc.latencyMs} ms` : "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              {associatedLog ? (
                <button
                  type="button"
                  onClick={() => onViewLogs(associatedLog)}
                  className="text-xs text-[#00A3E0] hover:text-[#0072A3] font-medium flex items-center gap-1 transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Lihat Log
                </button>
              ) : (
                <span className="text-xs text-slate-400 italic">Sistem Layanan</span>
              )}

              {canRestart && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRestarting}
                  onClick={() => onRestartWorker("python")}
                  className="h-7 text-xs px-2.5 rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${isRestarting ? "animate-spin" : ""}`} />
                  Restart
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
