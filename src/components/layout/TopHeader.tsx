"use client";

import React from "react";
import Link from "next/link";
import { Menu, Zap } from "lucide-react";

interface TopHeaderProps {
  onOpenMobileNav: () => void;
  title?: string;
}

export function TopHeader({ onOpenMobileNav, title }: TopHeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#e2e8f0] px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Hamburger Menu Trigger: min 44px tap target (R-03) */}
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Buka Menu Navigasi"
          className="min-h-[44px] min-w-[44px] w-11 h-11 flex items-center justify-center rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#1e293b] hover:bg-[#f1f5f9] transition-colors focus-utility-ring cursor-pointer"
        >
          <Menu className="w-5 h-5 text-[#006877]" />
        </button>

        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#006877] text-white flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-[#f97316] fill-[#f97316]" />
          </div>
          <span className="font-bold text-sm text-[#0f172a] tracking-tight">
            GORO S2JB
          </span>
        </Link>
      </div>

      {title && (
        <span className="text-xs font-semibold text-[#64748b] truncate max-w-[150px] text-right">
          {title}
        </span>
      )}
    </header>
  );
}
