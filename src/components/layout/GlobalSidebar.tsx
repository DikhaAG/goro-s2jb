"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileUp,
  CheckSquare,
  BarChart3,
  Users,
  Database,
  ShieldAlert,
  LogOut,
  LogIn,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GlobalSidebarProps {
  onClose?: () => void;
  className?: string;
}

interface NavMenuItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const NAV_ITEMS: NavMenuItem[] = [
  {
    label: "Beranda Komando",
    href: "/",
    icon: LayoutDashboard,
    roles: ["PETUGAS_LAPANGAN", "PEGAWAI", "MANAGER", "SUPER_ADMIN"],
  },
  {
    label: "Entri Eviden Lapangan",
    href: "/intake",
    icon: FileUp,
    roles: ["PETUGAS_LAPANGAN", "SUPER_ADMIN"],
  },
  {
    label: "Triase Ulasan",
    href: "/operator/triage",
    icon: CheckSquare,
    roles: ["PEGAWAI", "SUPER_ADMIN"],
  },
  {
    label: "Laporan Eksekutif",
    href: "/manager/reports",
    icon: BarChart3,
    roles: ["MANAGER", "SUPER_ADMIN"],
  },
  {
    label: "Manajemen Pengguna",
    href: "/admin/users",
    icon: Users,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Migrasi Data Eviden",
    href: "/admin/migration",
    icon: Database,
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Catatan Audit Log",
    href: "/admin/audit-logs",
    icon: ShieldAlert,
    roles: ["SUPER_ADMIN"],
  },
];

export function GlobalSidebar({ onClose, className }: GlobalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sessionQuery = trpc.auth.getSession.useQuery();
  const user = sessionQuery.data;

  const userRole = user?.role || "GUEST";

  // Filter menu items by RBAC
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "PETUGAS_LAPANGAN":
        return "Petugas Lapangan";
      case "PEGAWAI":
        return "Operator Triase";
      case "MANAGER":
        return "Manager UID";
      case "SUPER_ADMIN":
        return "Super Admin";
      default:
        return "Tamu Operasional";
    }
  };

  return (
    <aside
      className={cn(
        "w-64 h-full bg-white border-r border-[#e2e8f0] flex flex-col justify-between select-none z-30",
        className
      )}
    >
      {/* 1. Header & Branding */}
      <div>
        <div className="p-5 border-b border-[#f1f5f9] flex items-center justify-between">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 focus-utility-ring rounded-lg p-1 -m-1"
          >
            <div className="w-10 h-10 rounded-xl bg-[#006877] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5 text-[#f97316] fill-[#f97316]" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#0f172a] text-base tracking-tight leading-tight">
                  GORO S2JB
                </span>
                <span className="text-[10px] font-semibold bg-[#e7eeff] text-[#006877] px-1.5 py-0.2 rounded">
                  2026
                </span>
              </div>
              <span className="text-[11px] text-[#64748b] leading-tight mt-0.5">
                PLN UID S2JB
              </span>
            </div>
          </Link>
        </div>

        {/* 2. Navigation Menu */}
        <nav aria-label="Menu Navigasi Utama" className="p-3 space-y-1 mt-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href) ||
                  (item.href === "/operator/triage" && pathname.startsWith("/triage")) ||
                  (item.href === "/manager/reports" && pathname.startsWith("/reports"));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 focus-utility-ring min-h-[44px]",
                  isActive
                    ? "bg-[#e7eeff] text-[#006877] font-semibold border-l-4 border-[#00a2b9]"
                    : "text-[#64748b] hover:text-[#1e293b] hover:bg-[#f8fafc]"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0 transition-colors",
                    isActive ? "text-[#00a2b9]" : "text-[#94a3b8]"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 3. Footer: User Profile & Logout / Login CTA */}
      <div className="p-4 border-t border-[#f1f5f9] bg-[#f8fafc]/50">
        {user ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#e7eeff] text-[#006877] font-bold text-sm flex items-center justify-center shrink-0 border border-[#cfdaf2]">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex flex-col text-left overflow-hidden">
                <span className="text-xs font-semibold text-[#0f172a] truncate">
                  {user.name}
                </span>
                <span className="text-[11px] text-[#64748b] truncate">
                  {getRoleLabel(userRole)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#b91c1c] hover:bg-[#fee2e2] transition-colors focus-utility-ring border border-transparent cursor-pointer min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Sesi</span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#f1f5f9] text-[#64748b] font-bold text-sm flex items-center justify-center shrink-0 border border-[#e2e8f0]">
                <Users className="w-5 h-5 text-[#64748b]" />
              </div>
              <div className="flex flex-col text-left overflow-hidden">
                <span className="text-xs font-semibold text-[#0f172a] truncate">
                  Tamu Operasional
                </span>
                <span className="text-[11px] text-[#64748b] truncate">
                  Belum Masuk Sesi
                </span>
              </div>
            </div>

            <Link
              href="/login"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-[#00a2b9] hover:bg-[#008b9e] text-white transition-colors focus-utility-ring shadow-xs min-h-[44px]"
            >
              <LogIn className="w-4 h-4" />
              <span>Masuk ke Sistem</span>
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
