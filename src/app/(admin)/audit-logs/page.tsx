"use client";

import React from "react";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { ShieldAlert } from "lucide-react";

export default function AuditLogsPage() {
  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0]">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#006877] text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-[#f97316]" />
            </div>
            <h1 className="text-headline-sm sm:text-headline-md text-[#0f172a] font-bold tracking-tight">
              Catatan Jejak Audit Keamanan
            </h1>
          </div>
          <p className="text-body-meta text-[#64748b] mt-1">
            Rekaman aktivitas autentikasi, keputusan triase ulasan, dan tata kelola akun terenkripsi se-UID S2JB
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <AuditLogTable />
    </div>
  );
}
