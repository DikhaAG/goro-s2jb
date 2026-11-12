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
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]">Worker Impor</span>;
      case "OCR_WORKER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#faf5ff] text-[#7e22ce] border border-[#e9d5ff]">Worker OCR</span>;
      case "RUST_OCR":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#ecfdf5] text-[#15803d] border border-[#a7f3d0]">Rust Vision Core</span>;
      case "PYTHON_OCR":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#fefce8] text-[#854d0e] border border-[#fef08a]">Python OCR (Fallback)</span>;
      case "WEB_SERVER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#f0fdfa] text-[#006877] border border-[#99f6e4]">Web Next.js</span>;
      case "REDIS":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">Redis Daemon</span>;
      case "POSTGRES":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">PostgreSQL</span>;
      case "CLI_TASK":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#fff7ed] text-[#b45309] border border-[#fed7aa]">CLI Runner</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Proses</span>;
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

  const renderProcessAction = (proc: ManagedProcessItem) =>
    proc.isSafeToKill ? (
      <button
        type="button"
        onClick={() => onSelectProcessToKill(proc)}
        className="min-h-[44px] text-xs px-3.5 py-2 rounded-xl border border-[#fecaca] text-[#b91c1c] bg-[#fef2f2] hover:bg-[#fee2e2] font-bold transition-all focus-utility-ring cursor-pointer inline-flex items-center justify-center gap-1.5"
      >
        <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
        <span>Hentikan</span>
      </button>
    ) : (
      <span className="inline-flex items-center justify-center gap-1 text-xs text-[#64748b] font-bold px-2.5 py-1.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
        <Shield className="w-3.5 h-3.5 text-[#64748b] shrink-0" />
        <span>Dilindungi</span>
      </span>
    );

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[#0f172a] tracking-tight flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#006877] shrink-0" />
            <span>Daftar Proses Sistem Operasi Lokal</span>
          </h3>
          <p className="text-xs text-[#64748b] mt-0.5">
            Menampilkan seluruh proses aktif yang terafiliasi dengan ekosistem GORO S2JB.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Category Filter */}
          <select
            aria-label="Filter kategori layanan proses"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs h-11 min-h-[44px] px-3.5 rounded-xl border border-[#cbd5e1] bg-white text-[#0f172a] font-bold focus-utility-ring transition-all w-full sm:w-auto"
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
              aria-label="Cari PID atau perintah proses"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari PID atau perintah..."
              className="w-full pl-9 pr-3 h-11 min-h-[44px] text-xs rounded-xl border border-[#cbd5e1] bg-white text-[#0f172a] placeholder:text-[#94a3b8] focus-utility-ring transition-all"
            />
          </div>
        </div>
      </div>

      {/* Mobile Reflow Cards (< 768px) */}
      <div className="md:hidden divide-y divide-[#f1f5f9]">
        {isLoading ? (
          <div className="py-10 px-4 text-center text-xs text-[#64748b] animate-pulse">
            Memindai proses sistem lokal...
          </div>
        ) : filteredProcesses.length === 0 ? (
          <div className="py-10 px-4 text-center text-xs text-[#64748b]">
            Tidak ada proses aktif yang sesuai dengan filter pencarian.
          </div>
        ) : (
          filteredProcesses.map((proc) => (
            <div key={proc.pid} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {getServiceBadge(proc.serviceType)}
                    <span className="font-mono text-xs font-bold text-[#0f172a]">
                      PID {proc.pid}
                    </span>
                    <span className="font-mono text-xs text-[#64748b]">
                      PPID {proc.ppid}
                    </span>
                  </div>
                </div>
                <div className="shrink-0">{renderProcessAction(proc)}</div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs">
                <div>
                  <div className="text-[#64748b]">CPU</div>
                  <div className={`font-mono font-bold ${proc.cpuPercent > 50 ? "text-[#b91c1c]" : "text-[#0f172a]"}`}>
                    {proc.cpuPercent.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[#64748b]">RAM</div>
                  <div className="font-mono font-bold text-[#0f172a]">{formatRss(proc.rssKb)}</div>
                </div>
                <div>
                  <div className="text-[#64748b]">Aktif</div>
                  <div className="font-mono font-bold text-[#475569]">{proc.elapsedTime}</div>
                </div>
              </div>

              <div className="font-mono text-xs text-[#334155] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-2 break-all">
                {proc.command}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Process Table (>= 768px) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-xs font-bold text-[#64748b] uppercase tracking-wider">
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
                    <div className="text-xs text-[#64748b]">PPID: {proc.ppid}</div>
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
                  <td className="py-3.5 px-4 text-center">{renderProcessAction(proc)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
