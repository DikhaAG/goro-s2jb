"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Activity,
  Globe,
  FileCode,
  AlertTriangle,
} from "lucide-react";

export function AuditLogTable() {
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const auditQuery = trpc.user.getAuditLogs.useQuery(
    {
      action: selectedAction || undefined,
      limit: 50,
      offset: 0,
    },
    { refetchInterval: 10000 }
  );

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("SUCCESS") || action.includes("APPROVE")) return "success";
    if (action.includes("FAILED") || action.includes("REJECT") || action.includes("LOCKOUT")) return "destructive";
    if (action.includes("RESET") || action.includes("TOGGLE")) return "warning";
    return "default";
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "AUTH_LOGIN_SUCCESS":
        return "Login Berhasil";
      case "AUTH_LOGIN_FAILED":
        return "Login Gagal";
      case "AUTH_LOGOUT":
        return "Sesi Berakhir";
      case "TRIAGE_APPROVE":
        return "Triase Disetujui";
      case "TRIAGE_REJECT":
        return "Triase Ditolak";
      case "USER_CREATE":
        return "Buat Pengguna";
      case "USER_STATUS_TOGGLE":
        return "Status Akun Diubah";
      case "USER_PASSWORD_RESET":
        return "Reset Password";
      case "REPORT_EXPORT_EXCEL":
        return "Ekspor Excel";
      default:
        return action;
    }
  };

  const formatDate = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const logs = auditQuery.data?.logs || [];
  const filteredLogs = logs.filter((log: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const username = log.user?.username?.toLowerCase() || "";
    const name = log.user?.name?.toLowerCase() || "";
    const ip = log.ipAddress?.toLowerCase() || "";
    const action = log.action?.toLowerCase() || "";
    return username.includes(term) || name.includes(term) || ip.includes(term) || action.includes(term);
  });

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar & Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e2e8f0] card-floating-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Cari user, IP, atau aksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-4 h-4 text-[#64748b]" />
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs sm:text-sm text-[#0f172a] focus-utility-ring"
            >
              <option value="">Semua Tindakan</option>
              <option value="AUTH_LOGIN_SUCCESS">Login Berhasil</option>
              <option value="AUTH_LOGIN_FAILED">Login Gagal</option>
              <option value="TRIAGE_APPROVE">Triase Disetujui</option>
              <option value="TRIAGE_REJECT">Triase Ditolak</option>
              <option value="USER_CREATE">Buat Pengguna</option>
              <option value="USER_STATUS_TOGGLE">Ubah Status Akun</option>
              <option value="USER_PASSWORD_RESET">Reset Password</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => auditQuery.refetch()}
          disabled={auditQuery.isFetching}
          className="h-10 px-3.5 rounded-lg border border-[#cbd5e1] bg-white text-[#1e293b] hover:bg-[#f8fafc] text-xs font-semibold flex items-center justify-center gap-2 focus-utility-ring transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${auditQuery.isFetching ? "animate-spin" : ""}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* 2. Audit Table Content */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden card-floating-sm">
        {/* Loading State */}
        {auditQuery.isLoading && (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#00a2b9] border-t-transparent animate-spin mx-auto" />
            <p className="text-body-meta text-[#64748b]">Memuat catatan audit keamanan...</p>
          </div>
        )}

        {/* Error State */}
        {auditQuery.isError && (
          <div className="p-8 text-center space-y-2 bg-[#fef2f2]">
            <AlertTriangle className="w-6 h-6 text-[#ef4444] mx-auto" />
            <h4 className="text-sm font-semibold text-[#b91c1c]">Gagal Memuat Catatan Audit</h4>
            <p className="text-body-meta text-[#64748b]">{auditQuery.error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!auditQuery.isLoading && !auditQuery.isError && filteredLogs.length === 0 && (
          <div className="p-12 text-center space-y-2">
            <ShieldAlert className="w-8 h-8 text-[#94a3b8] mx-auto" />
            <h4 className="text-sm font-semibold text-[#1e293b]">Tidak Ada Catatan Jejak Audit</h4>
            <p className="text-body-meta text-[#64748b]">
              Belum ada aktivitas yang terekam sesuai filter yang dipilih.
            </p>
          </div>
        )}

        {/* Data Table */}
        {!auditQuery.isLoading && !auditQuery.isError && filteredLogs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3.5">Waktu Kejadian</th>
                  <th scope="col" className="px-4 py-3.5">Pengguna & Peran</th>
                  <th scope="col" className="px-4 py-3.5">Tindakan / Aksi</th>
                  <th scope="col" className="px-4 py-3.5">Alamat IP</th>
                  <th scope="col" className="px-4 py-3.5">Entitas Terkait</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-[#1e293b]">
                {filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#f8fafc] transition-colors">
                    {/* Timestamp */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-[#64748b]">
                      <div className="flex items-center gap-1.5 font-medium text-[#0f172a]">
                        <Clock className="w-3.5 h-3.5 text-[#94a3b8]" />
                        <span>{formatDate(log.createdAt)}</span>
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {log.user ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#e7eeff] text-[#006877] font-bold text-xs flex items-center justify-center shrink-0">
                            {log.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-[#0f172a] leading-tight">
                              {log.user.name}
                            </span>
                            <span className="text-[11px] text-[#64748b]">
                              @{log.user.username} • {log.user.role}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#94a3b8] italic">Anonim / Sistem</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {getActionLabel(log.action)}
                      </Badge>
                    </td>

                    {/* IP Address */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-[#475569] font-mono">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-[#94a3b8]" />
                        <span>{log.ipAddress || "127.0.0.1"}</span>
                      </div>
                    </td>

                    {/* Entity */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-[#64748b]">
                      <span className="font-semibold text-[#0f172a]">{log.entityType}</span>
                      {log.entityId && (
                        <span className="text-[11px] text-[#94a3b8] block font-mono">
                          ID: {log.entityId.slice(0, 10)}...
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
