"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileUp,
  BarChart3,
  Users,
  Database,
  ShieldAlert,
  LogOut,
  LogIn,
  Zap,
  Activity,
  Terminal,
  FolderKanban,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { forRole, type NavItemId } from "@/lib/routeAuthorization";

interface GlobalSidebarProps {
  onClose?: () => void;
  className?: string;
}

const NAV_ICONS: Record<NavItemId, React.ComponentType<{ className?: string }>> = {
  home: LayoutDashboard,
  intake: FileUp,
  reviews: FolderKanban,
  reports: BarChart3,
  users: Users,
  migration: Database,
  "migration-monitor": Activity,
  "system-processes": Terminal,
  "audit-logs": ShieldAlert,
};

export function GlobalSidebar({ onClose, className }: GlobalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sessionQuery = trpc.auth.getSession.useQuery();
  const user = sessionQuery.data;

  const userRole = user?.role || "GUEST";
  const visibleItems = forRole(user?.role).sidebarItems(pathname);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // ignore network errors on logout
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
        "w-64 h-full max-h-[100dvh] bg-white border-r border-[#e2e8f0] flex flex-col overflow-hidden select-none z-30",
        className
      )}
    >
      {/* 1. Header & Branding */}
      <div
        className={cn(
          "p-4 sm:p-5 border-b border-[#f1f5f9] flex items-center justify-between gap-2 shrink-0",
          onClose && "pr-16"
        )}
      >
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 focus-utility-ring rounded-lg p-1 -m-1 min-w-0"
        >
          <div className="w-10 h-10 rounded-xl bg-[#006877] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Zap className="w-5 h-5 text-[#f97316] fill-[#f97316]" />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#0f172a] text-base tracking-tight leading-tight truncate">
                GORO S2JB
              </span>
              <span className="text-xs font-semibold bg-[#e7eeff] text-[#006877] px-1.5 py-0.5 rounded shrink-0">
                2026
              </span>
            </div>
            <span className="text-xs text-[#64748b] leading-tight mt-0.5 truncate">
              PLN UID S2JB
            </span>
          </div>
        </Link>
      </div>

      {/* 2. Scrollable Navigation Menu (prevents footer clipping on compact viewports) */}
      <nav
        aria-label="Menu Navigasi Utama"
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-1"
      >
        {visibleItems.map((item) => {
          const Icon = NAV_ICONS[item.id];

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 focus-utility-ring min-h-[44px]",
                item.active
                  ? "bg-[#e7eeff] text-[#006877] font-semibold ring-1 ring-[#cfdaf2]"
                  : "text-[#64748b] hover:text-[#1e293b] hover:bg-[#f8fafc]"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-colors",
                  item.active ? "text-[#00a2b9]" : "text-[#94a3b8]"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 3. Footer: User Profile & Logout / Login CTA */}
      <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-[#f1f5f9] bg-[#f8fafc]/80">
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
                <span className="text-xs text-[#64748b] truncate">
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
                <span className="text-xs text-[#64748b] truncate">
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
