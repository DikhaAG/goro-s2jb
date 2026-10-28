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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#e2e8f0] gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#006877] text-white flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-[#00a2b9]" />
            </div>
            <h1 className="text-headline-sm sm:text-headline-md text-[#0f172a] font-bold tracking-tight">
              Manajemen Pengguna & Otorisasi RBAC
            </h1>
          </div>
          <p className="text-body-meta text-[#64748b] mt-1">
            Pengelolaan kredensial terenkripsi, status akun, dan penugasan wilayah kerja UP3/ULP
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="min-h-[44px] px-4 py-2 bg-[#00a2b9] hover:bg-[#0097a7] text-white font-semibold rounded-lg text-sm flex items-center justify-center space-x-2 transition cursor-pointer active:scale-98 shadow-xs focus-utility-ring"
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
