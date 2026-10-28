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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500" />

        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Tambah Pengguna Baru</h2>
              <p className="text-xs text-slate-400">
                Pemberian hak akses & penugasan wilayah kerja sistem GORO
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username / NIP <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="misal: petugas_kenten"
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nama Lengkap <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="misal: Bambang Irawan"
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Peran Pengguna (RBAC) <span className="text-rose-400">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value={Role.PETUGAS_LAPANGAN}>Petugas Lapangan (/intake)</option>
                <option value={Role.PEGAWAI}>Pegawai Triase (/triage)</option>
                <option value={Role.MANAGER}>Manager Eksekutif (/reports)</option>
                <option value={Role.SUPER_ADMIN}>Super Admin (/admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Kata Sandi Awal <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Unit Assignment (Crucial for Petugas Lapangan) */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
              <Building className="w-3.5 h-3.5 text-cyan-400" />
              <span>Penugasan Wilayah Kerja Organisasi</span>
              {role === Role.PETUGAS_LAPANGAN && (
                <span className="text-[10px] text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/50">
                  Wajib untuk Petugas Lapangan
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Pilih Unit UP3
                </label>
                <select
                  value={selectedUp3Id}
                  onChange={(e) => setSelectedUp3Id(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                <label className="block text-[11px] text-slate-400 mb-1">
                  Pilih Kantor ULP
                </label>
                <select
                  disabled={!selectedUp3Id}
                  value={selectedUlpId}
                  onChange={(e) => setSelectedUlpId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-40"
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

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={createUserMutation.isPending}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-sm hover:bg-slate-800 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 flex items-center space-x-2 transition cursor-pointer"
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
