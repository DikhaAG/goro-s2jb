"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Role } from "@prisma/client";
import {
  X,
  UserPlus,
  Building,
  Shield,
  KeyRound,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface UserFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserFormDialog({ isOpen, onClose, onSuccess }: UserFormDialogProps) {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("password123");
  const [role, setRole] = useState<Role>(Role.PETUGAS_LAPANGAN);
  const [selectedUp3Id, setSelectedUp3Id] = useState<string>("");
  const [selectedUlpId, setSelectedUlpId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch UP3 & ULP options
  const unitOptionsQuery = trpc.user.getUnitOptions.useQuery(undefined, {
    enabled: isOpen,
  });

  const createUserMutation = trpc.user.createUser.useMutation({
    onSuccess: () => {
      onSuccess();
      resetForm();
      onClose();
    },
    onError: (err) => {
      setFormError(err.message || "Gagal membuat pengguna baru.");
    },
  });

  const up3s = unitOptionsQuery.data?.up3s || [];
  const selectedUp3 = up3s.find((u) => u.id === selectedUp3Id);
  const ulps = selectedUp3?.ulps || [];

  // Reset ULP selection when UP3 changes
  useEffect(() => {
    setSelectedUlpId("");
  }, [selectedUp3Id]);

  const resetForm = () => {
    setUsername("");
    setName("");
    setPassword("password123");
    setRole(Role.PETUGAS_LAPANGAN);
    setSelectedUp3Id("");
    setSelectedUlpId("");
    setFormError(null);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!username.trim() || !name.trim() || !password) {
      setFormError("Seluruh bidang wajib diisi.");
      return;
    }

    if (role === Role.PETUGAS_LAPANGAN && (!selectedUp3Id || !selectedUlpId)) {
      setFormError("Petugas Lapangan wajib ditugaskan ke UP3 dan ULP spesifik.");
      return;
    }

    createUserMutation.mutate({
      username: username.trim(),
      name: name.trim(),
      password,
      role,
      up3Id: selectedUp3Id || null,
      ulpId: selectedUlpId || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-[#e2e8f0] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden relative">
        <div className="h-1 bg-[#00a2b9]" />

        <div className="px-6 py-5 border-b border-[#f1f5f9] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 shadow-xs">
              <UserPlus className="w-5 h-5 text-[#00a2b9]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0f172a]">Tambah Pengguna Baru</h2>
              <p className="text-xs text-[#64748b]">
                Pemberian hak akses dan penugasan wilayah kerja sistem GORO S2JB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#64748b] hover:text-[#0f172a] rounded-xl hover:bg-[#f1f5f9] transition focus-utility-ring cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#ef4444]" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Username / NIP <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="misal: petugas_kenten"
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] text-xs sm:text-sm focus-utility-ring min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Nama Lengkap <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="misal: Bambang Irawan"
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] text-xs sm:text-sm focus-utility-ring min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Peran Pengguna (RBAC) <span className="text-[#ef4444]">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] text-xs sm:text-sm focus-utility-ring min-h-[44px] cursor-pointer"
              >
                <option value={Role.PETUGAS_LAPANGAN}>Petugas Lapangan (/intake)</option>
                <option value={Role.PEGAWAI}>Pegawai Triase (/triage)</option>
                <option value={Role.MANAGER}>Manager Eksekutif (/reports)</option>
                <option value={Role.SUPER_ADMIN}>Super Admin (/admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                Kata Sandi Awal <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] text-xs sm:text-sm focus-utility-ring min-h-[44px]"
              />
            </div>
          </div>

          {/* Unit Assignment (Crucial for Petugas Lapangan) */}
          <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#1e293b]">
              <Building className="w-3.5 h-3.5 text-[#006877]" />
              <span>Penugasan Wilayah Kerja Organisasi</span>
              {role === Role.PETUGAS_LAPANGAN && (
                <span className="text-[10px] text-[#b45309] bg-[#fff7ed] px-2 py-0.5 rounded border border-[#fed7aa] font-semibold">
                  Wajib untuk Petugas Lapangan
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#64748b] font-medium mb-1">
                  Pilih Unit UP3
                </label>
                <select
                  value={selectedUp3Id}
                  onChange={(e) => setSelectedUp3Id(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-[#0f172a] text-xs focus-utility-ring min-h-[40px] cursor-pointer"
                >
                  <option value="">-- Pilih Unit UP3 --</option>
                  {up3s.map((up3) => (
                    <option key={up3.id} value={up3.id}>
                      {up3.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#64748b] font-medium mb-1">
                  Pilih Kantor ULP
                </label>
                <select
                  disabled={!selectedUp3Id}
                  value={selectedUlpId}
                  onChange={(e) => setSelectedUlpId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-[#0f172a] text-xs focus-utility-ring min-h-[40px] cursor-pointer disabled:opacity-40"
                >
                  <option value="">-- Pilih Kantor ULP --</option>
                  {ulps.map((ulp) => (
                    <option key={ulp.id} value={ulp.id}>
                      {ulp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={createUserMutation.isPending}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#cbd5e1] text-[#475569] hover:bg-[#f1f5f9] text-xs font-semibold transition focus-utility-ring cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#00a2b9] hover:bg-[#0097a7] text-white font-semibold text-xs shadow-xs flex items-center gap-2 transition cursor-pointer focus-utility-ring disabled:opacity-50"
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Pengguna</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
