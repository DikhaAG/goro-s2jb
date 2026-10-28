"use client";

import React, { useState } from "react";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { UserFormDialog } from "@/components/admin/UserFormDialog";
import { Users, UserPlus, Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminUsersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-[#0c121e]/90 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Kembali ke Beranda"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>Manajemen Pengguna & Otorisasi RBAC</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Pengelolaan kredensial terenkripsi, status akun, dan penugasan wilayah kerja UP3/ULP
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 font-bold rounded-xl text-xs sm:text-sm shadow-lg shadow-cyan-500/20 flex items-center space-x-2 transition cursor-pointer active:scale-95"
        >
          <UserPlus className="w-4 h-4 font-bold" />
          <span>Tambah Pengguna</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <UserManagementTable onRefreshTrigger={refreshTrigger} />
      </main>

      {/* User Create Modal */}
      <UserFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />
    </div>
  );
}
