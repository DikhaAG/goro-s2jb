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
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-700">
              <HardDrive className="w-4 h-4 text-[#00A3E0]" />
              Memori RAM Host
            </span>
            <span className="text-xs font-mono font-medium text-slate-800">
              {resources.memUsagePercent}% Terpakai
            </span>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                resources.memUsagePercent > 85
                  ? "bg-rose-500"
                  : resources.memUsagePercent > 70
                  ? "bg-amber-500"
                  : "bg-[#00A3E0]"
              }`}
              style={{ width: `${Math.min(resources.memUsagePercent, 100)}%` }}
            />
          </div>

          <div className="mt-3 flex justify-between text-xs text-slate-500">
            <span>Terpakai: <strong className="text-slate-800">{formatBytes(resources.usedMemBytes)}</strong></span>
            <span>Total: <strong className="text-slate-800">{formatBytes(resources.totalMemBytes)}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Node.js Runtime Memory */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-700">
              <Activity className="w-4 h-4 text-purple-600" />
              Runtime Node.js
            </span>
            <span className="text-xs font-mono text-slate-500">
              {resources.platform} ({resources.arch})
            </span>
          </div>

          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Heap Terpakai:</span>
              <span className="font-mono font-medium text-slate-800">{formatMb(resources.nodeMemory.heapUsed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Resident Set Size (RSS):</span>
              <span className="font-mono font-medium text-slate-800">{formatMb(resources.nodeMemory.rss)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Uptime & CPU Core */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-700">
              <Cpu className="w-4 h-4 text-emerald-600" />
              CPU & Waktu Aktif
            </span>
            <span className="text-xs font-mono text-slate-500">
              {resources.cpuCount} Cores
            </span>
          </div>

          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Uptime Sistem:
              </span>
              <span className="font-mono font-medium text-slate-800">
                {formatDuration(resources.systemUptimeSeconds)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Uptime Proses Server:</span>
              <span className="font-mono font-medium text-slate-800">
                {formatDuration(resources.processUptimeSeconds)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
