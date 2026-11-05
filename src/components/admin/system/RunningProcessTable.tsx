"use client";

import React, { useState } from "react";
import { Search, Shield, AlertOctagon, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]">Worker Impor</span>;
      case "OCR_WORKER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#faf5ff] text-[#7e22ce] border border-[#e9d5ff]">Worker OCR</span>;
      case "RUST_OCR":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">Rust Vision Core</span>;
      case "PYTHON_OCR":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#fefce8] text-[#854d0e] border border-[#fef08a]">Python OCR (Fallback)</span>;
      case "WEB_SERVER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#f0fdfa] text-[#006877] border border-[#99f6e4]">Web Next.js</span>;
      case "REDIS":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">Redis Daemon</span>;
      case "POSTGRES":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">PostgreSQL</span>;
      case "CLI_TASK":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">CLI Runner</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Proses</span>;
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
      (selectedType === "VISION" && (p.serviceType === "RUST_OCR" || p.serviceType === "PYTHON_OCR")) ||
      (selectedType === "PYTHON" && (p.serviceType === "RUST_OCR" || p.serviceType === "PYTHON_OCR")) ||
      (selectedType === "DATABASE" && (p.serviceType === "POSTGRES" || p.serviceType === "REDIS")) ||
      (selectedType === "WEB" && p.serviceType === "WEB_SERVER");

    return matchesSearch && matchesType;
  });

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#0f172a] tracking-tight flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#006877]" />
            <span>Daftar Proses Sistem Operasi Lokal</span>
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Menampilkan seluruh proses aktif yang terafiliasi dengan ekosistem GORO S2JB.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Category Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs h-10 min-h-[38px] px-3.5 rounded-xl border border-[#cbd5e1] bg-white text-[#0f172a] font-bold focus-utility-ring transition-all"
          >
            <option value="ALL">Semua Layanan</option>
            <option value="WORKER">Worker BullMQ</option>
            <option value="VISION">Rust Vision Engine</option>
            <option value="WEB">Server Web</option>
            <option value="DATABASE">Database &amp; Redis</option>
          </select>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari PID atau perintah..."
              className="w-full pl-9 pr-3 h-10 min-h-[38px] text-xs rounded-xl border border-[#cbd5e1] bg-white text-[#0f172a] placeholder:text-[#94a3b8] focus-utility-ring transition-all"
            />
          </div>
        </div>
      </div>

      {/* Process Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
              <th className="py-3 px-4 w-28">PID / PPID</th>
              <th className="py-3 px-4 w-36">Layanan</th>
              <th className="py-3 px-4">Perintah (Command)</th>
              <th className="py-3 px-4 w-20 text-right">CPU</th>
              <th className="py-3 px-4 w-24 text-right">RAM (RSS)</th>
              <th className="py-3 px-4 w-24 text-center">Waktu Aktif</th>
              <th className="py-3 px-4 w-28 text-center">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#64748b] animate-pulse">
                  Memindai proses sistem lokal...
                </td>
              </tr>
            ) : filteredProcesses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#64748b]">
                  Tidak ada proses aktif yang sesuai dengan filter pencarian.
                </td>
              </tr>
            ) : (
              filteredProcesses.map((proc) => (
                <tr key={proc.pid} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0f172a]">
                    <div>{proc.pid}</div>
                    <div className="text-[10px] text-[#64748b]">PPID: {proc.ppid}</div>
                  </td>
                  <td className="py-3.5 px-4">{getServiceBadge(proc.serviceType)}</td>
                  <td className="py-3.5 px-4 font-mono text-[#0f172a] max-w-xs md:max-w-md truncate" title={proc.command}>
                    {proc.command}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold">
                    <span className={proc.cpuPercent > 50 ? "text-[#b91c1c]" : "text-[#0f172a]"}>
                      {proc.cpuPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0f172a]">
                    {formatRss(proc.rssKb)}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-[#64748b]">
                    {proc.elapsedTime}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {proc.isSafeToKill ? (
                      <button
                        type="button"
                        onClick={() => onSelectProcessToKill(proc)}
                        className="min-h-[36px] text-xs px-3 py-1.5 rounded-xl border border-[#fecaca] text-[#b91c1c] bg-[#fef2f2] hover:bg-[#fee2e2] font-bold transition-all focus-utility-ring cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" />
                        <span>Hentikan</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#64748b] font-bold px-2.5 py-1 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                        <Shield className="w-3 h-3 text-[#64748b]" />
                        <span>Dilindungi</span>
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
