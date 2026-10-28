"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Role } from "@prisma/client";
import {
  Search,
  Filter,
  UserCheck,
  UserX,
  KeyRound,
  Shield,
  Building,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";

interface UserManagementTableProps {
  onRefreshTrigger?: number;
}

export function UserManagementTable({ onRefreshTrigger }: UserManagementTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | "ALL">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Temporary password reset feedback modal
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    username: string;
    tempPass: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Queries & Mutations
  const utils = trpc.useUtils();
  const usersQuery = trpc.user.listUsers.useQuery({
    search: searchTerm || undefined,
    role: selectedRole === "ALL" ? undefined : selectedRole,
    isActive: selectedStatus === "ALL" ? undefined : selectedStatus === "ACTIVE",
    limit: 50,
  });

  const toggleStatusMutation = trpc.user.toggleStatus.useMutation({
    onSuccess: () => {
      utils.user.listUsers.invalidate();
    },
    onError: (err) => {
      alert(err.message || "Gagal mengubah status pengguna.");
    },
  });

  const resetPasswordMutation = trpc.user.resetPassword.useMutation({
    onSuccess: (res, vars) => {
      const targetUser = usersQuery.data?.users.find((u) => u.id === vars.id);
      setTempPasswordModal({
        username: targetUser?.username || "pengguna",
        tempPass: res.temporaryPassword,
      });
      setCopied(false);
    },
    onError: (err) => {
      alert(err.message || "Gagal me-reset kata sandi.");
    },
  });

  const handleCopyPassword = () => {
    if (tempPasswordModal?.tempPass) {
      navigator.clipboard.writeText(tempPasswordModal.tempPass);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case Role.PETUGAS_LAPANGAN:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#e0f2fe] border border-[#bae6fd] text-[#0369a1]">
            Petugas Lapangan
          </span>
        );
      case Role.PEGAWAI:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#fff7ed] border border-[#fed7aa] text-[#b45309]">
            Pegawai Triase
          </span>
        );
      case Role.MANAGER:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8]">
            Manager Eksekutif
          </span>
        );
      case Role.SUPER_ADMIN:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#ecfdf5] border border-[#a7f3d0] text-[#15803d]">
            Super Admin
          </span>
        );
    }
  };

  const users = usersQuery.data?.users || [];

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-xs">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748b]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama atau username..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] placeholder-[#94a3b8] text-xs sm:text-sm focus-utility-ring min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-medium">Peran:</span>
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as any)}
            className="px-3 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] text-xs focus-utility-ring min-h-[44px] cursor-pointer"
          >
            <option value="ALL">Semua Peran</option>
            <option value={Role.PETUGAS_LAPANGAN}>Petugas Lapangan</option>
            <option value={Role.PEGAWAI}>Pegawai Triase</option>
            <option value={Role.MANAGER}>Manager</option>
            <option value={Role.SUPER_ADMIN}>Super Admin</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-3 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] text-xs focus-utility-ring min-h-[44px] cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>

          <button
            type="button"
            onClick={() => usersQuery.refetch()}
            disabled={usersQuery.isFetching}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#475569] hover:text-[#0f172a] transition disabled:opacity-50 flex items-center justify-center focus-utility-ring cursor-pointer"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Pengguna</th>
                <th className="py-3.5 px-4">Peran (RBAC)</th>
                <th className="py-3.5 px-4">Penugasan Unit Kerja</th>
                <th className="py-3.5 px-4">Status Akun</th>
                <th className="py-3.5 px-4">Terdaftar</th>
                <th className="py-3.5 px-4 text-right">Tindakan Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#64748b] animate-pulse">
                    Memuat daftar pengguna sistem...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#64748b]">
                    Tidak ada akun pengguna yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f8fafc]/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#0f172a]">{u.name}</div>
                      <div className="text-[11px] text-[#64748b] font-mono">@{u.username}</div>
                    </td>
                    <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>
                    <td className="py-3.5 px-4">
                      {u.ulp ? (
                        <div>
                          <div className="font-medium text-[#1e293b]">{u.ulp.name}</div>
                          <div className="text-[11px] text-[#64748b]">{u.up3?.name}</div>
                        </div>
                      ) : u.up3 ? (
                        <div className="font-medium text-[#1e293b]">{u.up3.name}</div>
                      ) : (
                        <span className="text-[#64748b] italic">UID S2JB (Wilayah)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                          <span>AKTIF</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                          <span>NONAKTIF</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#64748b] text-xs">
                      {new Date(u.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Reset Password Button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Reset kata sandi akun @${u.username}?`)) {
                              resetPasswordMutation.mutate({ id: u.id });
                            }
                          }}
                          disabled={resetPasswordMutation.isPending}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#334155] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer focus-utility-ring"
                          title="Reset Password Pengguna"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#b45309]" />
                          <span>Reset Sandi</span>
                        </button>

                        {/* Toggle Status Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const newStatus = !u.isActive;
                            const actionLabel = newStatus ? "mengaktifkan" : "menonaktifkan";
                            if (confirm(`Yakin ingin ${actionLabel} akun @${u.username}?`)) {
                              toggleStatusMutation.mutate({ id: u.id, isActive: newStatus });
                            }
                          }}
                          disabled={toggleStatusMutation.isPending}
                          className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer focus-utility-ring ${
                            u.isActive
                              ? "border-[#fecaca] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#b91c1c]"
                              : "border-[#bbf7d0] bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#15803d]"
                          }`}
                        >
                          {u.isActive ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Nonaktifkan</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Aktifkan</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Temporary Password Success Dialog */}
      {tempPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl w-full max-w-sm p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#fff7ed] border border-[#fed7aa] text-[#b45309] flex items-center justify-center mx-auto shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#0f172a]">
                Kata Sandi Baru Dihasilkan
              </h3>
              <p className="text-xs text-[#64748b] mt-1">
                Kata sandi sementara untuk akun{" "}
                <span className="font-semibold text-[#0f172a]">
                  @{tempPasswordModal.username}
                </span>
                :
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="font-mono text-sm font-bold text-[#006877] select-all">
                {tempPasswordModal.tempPass}
              </span>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="min-h-[40px] px-2.5 py-1.5 rounded-lg border border-[#cbd5e1] hover:bg-[#f1f5f9] text-[#334155] text-xs font-semibold flex items-center gap-1 transition focus-utility-ring cursor-pointer"
                title="Salin Kata Sandi"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-[#16a34a]" />
                    <span className="text-[#15803d]">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTempPasswordModal(null)}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#00a2b9] hover:bg-[#008b9e] text-white font-semibold text-xs transition focus-utility-ring cursor-pointer shadow-xs"
            >
              Tutup & Bagikan ke Pengguna
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
