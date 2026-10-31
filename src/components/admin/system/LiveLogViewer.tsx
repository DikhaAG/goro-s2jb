"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, RefreshCw, Copy, Check, ArrowDown, FileText } from "lucide-react";
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
  { fileName: "ocr_service.log", label: "Python OCR Service" },
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
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, autoScroll]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="bg-[#0b1329] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[520px]">
      {/* Top Bar: Tabs & Controls */}
      <div className="p-3 bg-[#0f172a] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        {/* Log File Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {AVAILABLE_LOGS.map((item) => (
            <button
              key={item.fileName}
              type="button"
              onClick={() => onSelectFile(item.fileName)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeFile === item.fileName
                  ? "bg-[#00A3E0] text-white shadow-sm"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Line count selector */}
          <select
            value={lineCount}
            onChange={(e) => onChangeLineCount(parseInt(e.target.value, 10))}
            className="text-xs h-7 px-2 rounded-md bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00A3E0]"
          >
            <option value="50">50 Baris</option>
            <option value="100">100 Baris</option>
            <option value="200">200 Baris</option>
            <option value="500">500 Baris</option>
          </select>

          {/* Auto-scroll toggle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`h-7 px-2 text-xs rounded-md ${
              autoScroll ? "text-[#00A3E0] bg-[#00A3E0]/10" : "text-slate-400 hover:text-slate-200"
            }`}
            title="Auto-Scroll ke bagian bawah"
          >
            <ArrowDown className="w-3.5 h-3.5 mr-1" />
            Auto-Scroll
          </Button>

          {/* Copy button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copied ? "Tersalin" : "Salin"}
          </Button>

          {/* Refresh button */}
          <Button
            size="sm"
            variant="ghost"
            disabled={isLoading}
            onClick={onRefresh}
            className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? "animate-spin text-[#00A3E0]" : ""}`} />
            Segarkan
          </Button>
        </div>
      </div>

      {/* Terminal Content Body */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 selection:bg-[#00A3E0]/30 selection:text-white">
        {lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <Terminal className="w-5 h-5 mr-2 opacity-50" />
            Berkas log kosong atau belum ada catatan aktivitas.
          </div>
        ) : (
          lines.map((line, index) => {
            const isError = line.includes("ERROR") || line.includes("Error:") || line.includes("FATAL");
            const isWarn = line.includes("WARN") || line.includes("Warning");
            const isSuccess = line.includes("SUCCESS") || line.includes("✓") || line.includes("completed");

            let textColor = "text-slate-300";
            if (isError) textColor = "text-rose-400 font-medium";
            else if (isWarn) textColor = "text-amber-300";
            else if (isSuccess) textColor = "text-emerald-400";

            return (
              <div key={index} className={`py-0.5 hover:bg-slate-800/40 px-1 rounded ${textColor}`}>
                <span className="text-slate-600 select-none mr-3 w-8 inline-block text-right">
                  {index + 1}
                </span>
                {line}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Footer Bar */}
      <div className="px-4 py-2 bg-[#090e1f] border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>Berkas: <strong className="text-slate-300">{activeFile}</strong></span>
          <span>Ukuran: <strong className="text-slate-300">{formatFileSize(sizeBytes)}</strong></span>
          <span>Total: <strong className="text-slate-300">{totalLines} baris</strong></span>
        </div>
        {lastModified && (
          <div className="text-slate-500">
            Terakhir diubah: {new Date(lastModified).toLocaleTimeString("id-ID")}
          </div>
        )}
      </div>
    </div>
  );
}
