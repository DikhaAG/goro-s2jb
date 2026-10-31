"use client";

import React, { useState } from "react";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { UserFormDialog } from "@/components/admin/UserFormDialog";
import { Users, UserPlus } from "lucide-react";

export default function AdminUsersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00A3E0]/10 text-[#00A3E0] flex items-center justify-center shrink-0 border border-[#00A3E0]/20">
              <Users className="w-4 h-4 text-[#00A3E0]" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Manajemen Pengguna & Otorisasi RBAC
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan kredensial terenkripsi, status akun, dan penugasan wilayah kerja UP3/ULP se-UID S2JB
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="h-9 min-h-[44px] px-4 py-2 bg-[#00A3E0] hover:bg-[#0072A3] text-white font-medium rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer active:scale-[0.98] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00A3E0]/30"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {/* Main Content Area */}
      <UserManagementTable onRefreshTrigger={refreshTrigger} />

      {/* User Create Modal */}
      <UserFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />
    </div>
  );
}
