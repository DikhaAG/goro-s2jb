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
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-cyan-950/70 border border-cyan-800/60 text-cyan-400">
            Petugas Lapangan
          </span>
        );
      case Role.PEGAWAI:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-950/70 border border-amber-800/60 text-amber-400">
            Pegawai Triase
          </span>
        );
      case Role.MANAGER:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-950/70 border border-indigo-800/60 text-indigo-400">
            Manager Eksekutif
          </span>
        );
      case Role.SUPER_ADMIN:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">
            Super Admin
          </span>
        );
    }
  };

  const users = usersQuery.data?.users || [];

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama atau username..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Peran:</span>
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as any)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>

          <button
            onClick={() => usersQuery.refetch()}
            disabled={usersQuery.isFetching}
            className="p-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Peran (RBAC)</th>
                <th className="py-3 px-4">Penugasan Unit Kerja</th>
                <th className="py-3 px-4">Status Akun</th>
                <th className="py-3 px-4">Terdaftar</th>
                <th className="py-3 px-4 text-right">Tindakan Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Memuat daftar pengguna sistem...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Tidak ada akun pengguna yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{u.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                    </td>
                    <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                    <td className="py-3 px-4">
                      {u.ulp ? (
                        <div>
                          <div className="font-medium text-slate-200">{u.ulp.name}</div>
                          <div className="text-[11px] text-slate-400">{u.up3?.name}</div>
                        </div>
                      ) : u.up3 ? (
                        <div className="font-medium text-slate-200">{u.up3.name}</div>
                      ) : (
                        <span className="text-slate-400 italic">UID S2JB (Wilayah)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>AKTIF</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          <span>NONAKTIF</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Reset Password Button */}
                        <button
                          onClick={() => {
                            if (confirm(`Reset kata sandi akun @${u.username}?`)) {
                              resetPasswordMutation.mutate({ id: u.id });
                            }
                          }}
                          disabled={resetPasswordMutation.isPending}
                          className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1 transition"
                          title="Reset Password Pengguna"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          <span>Reset Sandi</span>
                        </button>

                        {/* Toggle Status Button */}
                        <button
                          onClick={() => {
                            const newStatus = !u.isActive;
                            const actionLabel = newStatus ? "mengaktifkan" : "menonaktifkan";
                            if (confirm(`Yakin ingin ${actionLabel} akun @${u.username}?`)) {
                              toggleStatusMutation.mutate({ id: u.id, isActive: newStatus });
                            }
                          }}
                          disabled={toggleStatusMutation.isPending}
                          className={`px-2.5 py-1 rounded-lg text-xs flex items-center space-x-1 border transition ${
                            u.isActive
                              ? "border-rose-900/60 bg-rose-950/40 hover:bg-rose-950/70 text-rose-300"
                              : "border-emerald-900/60 bg-emerald-950/40 hover:bg-emerald-950/70 text-emerald-300"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              Kata Sandi Baru Dihasilkan
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Kata sandi sementara untuk akun{" "}
              <span className="font-semibold text-slate-200">
                @{tempPasswordModal.username}
              </span>
              :
            </p>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 mb-5">
              <span className="font-mono text-sm font-bold text-amber-400 select-all">
                {tempPasswordModal.tempPass}
              </span>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Salin Kata Sandi"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTempPasswordModal(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition"
            >
              Tutup & Bagikan ke Pengguna
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
