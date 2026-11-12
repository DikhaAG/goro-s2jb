"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Terminal, RefreshCw, Copy, Check, ArrowDown, FileText, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveLogViewerProps {
  activeFile: string;
  onSelectFile: (fileName: string) => void;
  lines: string[];
  totalLines: number;
  sizeBytes: number;
  lastModified?: string;
  isLoading?: boolean;
  onRefresh: () => void;
  lineCount: number;
  onChangeLineCount: (count: number) => void;
}

const AVAILABLE_LOGS = [
  { fileName: "worker_import.log", label: "Worker Impor" },
  { fileName: "worker_ocr.log", label: "Worker OCR" },
  { fileName: "ocr_service.log", label: "Rust Vision Core (goro-engine)" },
  { fileName: "system_runtime.log", label: "Runtime Sistem" },
];

export function LiveLogViewer({
  activeFile,
  onSelectFile,
  lines,
  totalLines,
  sizeBytes,
  lastModified,
  isLoading = false,
  onRefresh,
  lineCount,
  onChangeLineCount,
}: LiveLogViewerProps) {
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return lines;
    const q = searchQuery.toLowerCase();
    return lines.filter((l) => l.toLowerCase().includes(q));
  }, [lines, searchQuery]);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredLines, autoScroll]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(filteredLines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleDownload = () => {
    try {
      const content = lines.join("\n");
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = activeFile;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // ignore download error
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="bg-[#0b1329] rounded-2xl border border-[#1e293b] shadow-2xl overflow-hidden flex flex-col h-[460px] sm:h-[560px] min-w-0">
      {/* Top Bar: Tabs & Controls */}
      <div className="p-3 bg-[#0f172a] border-b border-[#1e293b] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Log File Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 lg:pb-0">
          {AVAILABLE_LOGS.map((item) => (
            <button
              key={item.fileName}
              type="button"
              onClick={() => onSelectFile(item.fileName)}
              className={`text-xs px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 min-h-[44px] shrink-0 whitespace-nowrap focus-utility-ring cursor-pointer ${
                activeFile === item.fileName
                  ? "bg-[#00a2b9] text-white shadow-xs"
                  : "bg-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#334155]"
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Real-time search filter */}
          <div className="relative flex items-center flex-1 min-w-[160px] sm:flex-none">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              aria-label="Cari baris di dalam log"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari dalam log..."
              className="text-xs h-11 min-h-[44px] pl-8 pr-7 rounded-xl bg-[#1e293b] border border-[#334155] text-slate-200 placeholder:text-slate-500 font-medium focus-utility-ring w-full sm:w-44"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Hapus pencarian log"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 text-slate-400 hover:text-white p-1.5"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Line count selector */}
          <select
            aria-label="Jumlah baris log"
            value={lineCount}
            onChange={(e) => onChangeLineCount(parseInt(e.target.value, 10))}
            className="text-xs h-11 min-h-[44px] px-2.5 rounded-xl bg-[#1e293b] border border-[#334155] text-slate-200 font-bold focus-utility-ring"
          >
            <option value="50">50 Baris</option>
            <option value="100">100 Baris</option>
            <option value="200">200 Baris</option>
            <option value="500">500 Baris</option>
          </select>

          {/* Auto-scroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1 focus-utility-ring cursor-pointer ${
              autoScroll ? "text-[#5eead4] bg-[#00a2b9]/20 border border-[#00a2b9]/40" : "text-slate-400 hover:text-slate-200 bg-[#1e293b]"
            }`}
            title="Auto-Scroll ke bagian bawah"
          >
            <ArrowDown className="w-3.5 h-3.5 shrink-0" />
            <span>Auto-Scroll</span>
          </button>

          {/* Download raw log */}
          <button
            type="button"
            onClick={handleDownload}
            className="min-h-[44px] px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-[#1e293b] hover:bg-[#334155] rounded-xl transition-all flex items-center gap-1 focus-utility-ring cursor-pointer"
            title="Unduh berkas log mentah"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Unduh</span>
          </button>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[44px] px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-[#1e293b] hover:bg-[#334155] rounded-xl transition-all flex items-center gap-1 focus-utility-ring cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
            <span>{copied ? "Tersalin" : "Salin"}</span>
          </button>

          {/* Refresh button */}
          <button
            type="button"
            disabled={isLoading}
            onClick={onRefresh}
            className="min-h-[44px] px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-[#1e293b] hover:bg-[#334155] rounded-xl transition-all flex items-center gap-1 focus-utility-ring cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isLoading ? "animate-spin text-[#00a2b9]" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Terminal Content Body */}
      <div className="flex-1 min-h-0 p-3 sm:p-4 overflow-auto font-mono text-xs leading-relaxed text-slate-300 selection:bg-[#00a2b9]/40 selection:text-white">
        {filteredLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-center px-4">
            <Terminal className="w-5 h-5 mr-2 opacity-50 shrink-0" />
            <span>
              {searchQuery
                ? `Tidak ada baris yang cocok dengan kata kunci "${searchQuery}".`
                : "Berkas log kosong atau belum ada catatan aktivitas."}
            </span>
          </div>
        ) : (
          filteredLines.map((line, index) => {
            const isError = line.includes("ERROR") || line.includes("Error:") || line.includes("FATAL");
            const isWarn = line.includes("WARN") || line.includes("Warning");
            const isSuccess = line.includes("SUCCESS") || line.includes("✓") || line.includes("completed");

            let textColor = "text-slate-300";
            if (isError) textColor = "text-rose-400 font-medium";
            else if (isWarn) textColor = "text-amber-300";
            else if (isSuccess) textColor = "text-emerald-400";

            return (
              <div key={index} className={`py-0.5 hover:bg-slate-800/40 px-1 rounded break-words ${textColor}`}>
                <span className="text-slate-600 select-none mr-3 w-8 inline-block text-right">
                  {index + 1}
                </span>
                <span className="whitespace-pre-wrap break-all sm:break-words">{line}</span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Footer Bar */}
      <div className="px-4 py-2.5 bg-[#090e1f] border-t border-[#1e293b] text-xs font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span>Berkas: <strong className="text-slate-200">{activeFile}</strong></span>
          <span>Ukuran: <strong className="text-slate-200">{formatFileSize(sizeBytes)}</strong></span>
          <span>
            {searchQuery ? (
              <span className="text-cyan-400 font-semibold">
                Tampil: {filteredLines.length} / {lines.length} baris
              </span>
            ) : (
              <span>Total: <strong className="text-slate-200">{totalLines} baris</strong></span>
            )}
          </span>
        </div>
        {lastModified && (
          <div className="text-slate-400">
            Terakhir diubah: {new Date(lastModified).toLocaleTimeString("id-ID")}
          </div>
        )}
      </div>
    </div>
  );
}
