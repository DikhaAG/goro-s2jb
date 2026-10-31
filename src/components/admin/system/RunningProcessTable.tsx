"use client";

import React, { useState } from "react";
import { Search, Shield, AlertOctagon, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface ManagedProcessItem {
  pid: number;
  ppid: number;
  cpuPercent: number;
  memPercent: number;
  rssKb: number;
  status: string;
  elapsedTime: string;
  command: string;
  serviceType: string;
  isSafeToKill: boolean;
}

interface RunningProcessTableProps {
  processes: ManagedProcessItem[];
  onSelectProcessToKill: (proc: ManagedProcessItem) => void;
  isLoading?: boolean;
}

export function RunningProcessTable({
  processes,
  onSelectProcessToKill,
  isLoading = false,
}: RunningProcessTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  const formatRss = (kb: number) => {
    if (kb >= 1024 * 1024) {
      return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
    }
    if (kb >= 1024) {
      return `${(kb / 1024).toFixed(1)} MB`;
    }
    return `${kb} KB`;
  };

  const getServiceBadge = (type: string) => {
    switch (type) {
      case "IMPORT_WORKER":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Worker Impor</Badge>;
      case "OCR_WORKER":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Worker OCR</Badge>;
      case "PYTHON_OCR":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Python OCR</Badge>;
      case "WEB_SERVER":
        return <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200">Web Next.js</Badge>;
      case "REDIS":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Redis Daemon</Badge>;
      case "POSTGRES":
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">PostgreSQL</Badge>;
      case "CLI_TASK":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">CLI Runner</Badge>;
      default:
        return <Badge className="bg-slate-50 text-slate-700 border-slate-200">Proses</Badge>;
    }
  };

  const filteredProcesses = processes.filter((p) => {
    const matchesSearch =
      String(p.pid).includes(searchTerm) ||
      p.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.serviceType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      selectedType === "ALL" ||
      (selectedType === "WORKER" && (p.serviceType === "IMPORT_WORKER" || p.serviceType === "OCR_WORKER")) ||
      (selectedType === "PYTHON" && p.serviceType === "PYTHON_OCR") ||
      (selectedType === "DATABASE" && (p.serviceType === "POSTGRES" || p.serviceType === "REDIS")) ||
      (selectedType === "WEB" && p.serviceType === "WEB_SERVER");

    return matchesSearch && matchesType;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#00A3E0]" />
            Daftar Proses Sistem Operasi Lokal
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Menampilkan seluruh proses aktif yang terafiliasi dengan ekosistem GORO S2JB.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Category Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#00A3E0]/30"
          >
            <option value="ALL">Semua Layanan</option>
            <option value="WORKER">Worker BullMQ</option>
            <option value="PYTHON">Python OCR</option>
            <option value="WEB">Server Web</option>
            <option value="DATABASE">Database & Redis</option>
          </select>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari PID atau perintah..."
              className="pl-8.5 h-9 text-xs rounded-xl border-slate-200 focus-visible:ring-[#00A3E0]/30"
            />
          </div>
        </div>
      </div>

      {/* Process Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-medium">
              <th className="py-3 px-4 w-28">PID / PPID</th>
              <th className="py-3 px-4 w-36">Layanan</th>
              <th className="py-3 px-4">Perintah (*Command*)</th>
              <th className="py-3 px-4 w-20 text-right">CPU</th>
              <th className="py-3 px-4 w-24 text-right">RAM (RSS)</th>
              <th className="py-3 px-4 w-24 text-center">Waktu Aktif</th>
              <th className="py-3 px-4 w-28 text-center">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[#00A3E0] border-t-transparent mr-2 align-middle" />
                  Memindai proses sistem lokal...
                </td>
              </tr>
            ) : filteredProcesses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  Tidak ada proses aktif yang sesuai dengan filter pencarian.
                </td>
              </tr>
            ) : (
              filteredProcesses.map((proc) => (
                <tr key={proc.pid} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">
                    <div>{proc.pid}</div>
                    <div className="text-[10px] text-slate-400">PPID: {proc.ppid}</div>
                  </td>
                  <td className="py-3 px-4">{getServiceBadge(proc.serviceType)}</td>
                  <td className="py-3 px-4 font-mono text-slate-700 max-w-xs md:max-w-md truncate" title={proc.command}>
                    {proc.command}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium">
                    <span className={proc.cpuPercent > 50 ? "text-rose-600 font-bold" : "text-slate-700"}>
                      {proc.cpuPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatRss(proc.rssKb)}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-500">
                    {proc.elapsedTime}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {proc.isSafeToKill ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectProcessToKill(proc)}
                        className="h-7 text-xs px-2.5 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-medium transition-colors"
                      >
                        <AlertOctagon className="w-3 h-3 mr-1" />
                        Hentikan
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100">
                        <Shield className="w-2.5 h-2.5 text-slate-400" />
                        Dilindungi
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
