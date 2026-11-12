"use client";

import React from "react";
import { Cpu, HardDrive, Clock, Activity } from "lucide-react";

export interface SystemResourcesData {
  cpuCount: number;
  cpuModel: string;
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemBytes: number;
  memUsagePercent: number;
  processUptimeSeconds: number;
  systemUptimeSeconds: number;
  nodeMemory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  platform: string;
  arch: string;
}

interface SystemResourceGaugeProps {
  resources: SystemResourcesData | null;
}

export function SystemResourceGauge({ resources }: SystemResourceGaugeProps) {
  if (!resources) return null;

  const formatBytes = (bytes: number) => {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatMb = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}h`);
    if (hours > 0) parts.push(`${hours}j`);
    parts.push(`${minutes}m`);
    return parts.join(" ");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Hardware Memory */}
      <div className="p-5 bg-white rounded-2xl border border-[#e2e8f0] shadow-xs flex flex-col justify-between min-w-0">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[#64748b] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-[#0f172a]">
              <HardDrive className="w-4 h-4 text-[#006877]" />
              Memori RAM Host
            </span>
            <span className="text-xs font-mono font-bold text-[#006877]">
              {resources.memUsagePercent}% Terpakai
            </span>
          </div>

          <div className="w-full h-2.5 bg-[#f1f5f9] rounded-full overflow-hidden mt-2 border border-[#e2e8f0]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                resources.memUsagePercent > 85
                  ? "bg-[#dc2626]"
                  : resources.memUsagePercent > 70
                  ? "bg-[#f59e0b]"
                  : "bg-[#00a2b9]"
              }`}
              style={{ width: `${Math.min(resources.memUsagePercent, 100)}%` }}
            />
          </div>

          <div className="mt-3 flex justify-between text-xs text-[#64748b]">
            <span>Terpakai: <strong className="font-mono text-[#0f172a]">{formatBytes(resources.usedMemBytes)}</strong></span>
            <span>Total: <strong className="font-mono text-[#0f172a]">{formatBytes(resources.totalMemBytes)}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Node.js Runtime Memory */}
      <div className="p-5 bg-white rounded-2xl border border-[#e2e8f0] shadow-xs flex flex-col justify-between min-w-0">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[#64748b] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-[#0f172a]">
              <Activity className="w-4 h-4 text-[#006877]" />
              Runtime Node.js
            </span>
            <span className="text-xs font-mono text-[#64748b]">
              {resources.platform} ({resources.arch})
            </span>
          </div>

          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#64748b]">Heap Terpakai:</span>
              <span className="font-mono font-bold text-[#0f172a]">{formatMb(resources.nodeMemory.heapUsed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Resident Set Size (RSS):</span>
              <span className="font-mono font-bold text-[#0f172a]">{formatMb(resources.nodeMemory.rss)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Uptime & CPU Core */}
      <div className="p-5 bg-white rounded-2xl border border-[#e2e8f0] shadow-xs flex flex-col justify-between min-w-0">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[#64748b] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-[#0f172a]">
              <Cpu className="w-4 h-4 text-[#16a34a]" />
              CPU &amp; Waktu Aktif
            </span>
            <span className="text-xs font-mono font-bold text-[#0f172a]">
              {resources.cpuCount} Cores
            </span>
          </div>

          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#64748b] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#64748b]" />
                Uptime Sistem:
              </span>
              <span className="font-mono font-bold text-[#0f172a]">
                {formatDuration(resources.systemUptimeSeconds)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748b]">Uptime Proses Server:</span>
              <span className="font-mono font-bold text-[#0f172a]">
                {formatDuration(resources.processUptimeSeconds)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
