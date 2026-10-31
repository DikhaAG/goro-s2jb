"use client";

import React from "react";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { ShieldAlert } from "lucide-react";

export default function AuditLogsPage() {
  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00A3E0]/10 text-[#00A3E0] flex items-center justify-center shrink-0 border border-[#00A3E0]/20">
              <ShieldAlert className="w-4 h-4 text-[#00A3E0]" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Catatan Jejak Audit Keamanan
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rekaman aktivitas autentikasi, keputusan triase ulasan, dan tata kelola akun terenkripsi se-UID S2JB
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <AuditLogTable />
    </div>
  );
}
