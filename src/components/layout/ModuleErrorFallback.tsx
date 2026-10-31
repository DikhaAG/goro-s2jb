"use client";

import React, { useEffect } from "react";
import { LucideIcon, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export interface ModuleErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  moduleName: string;
  badgeLabel: string;
  defaultTitle: string;
  defaultMessage: string;
  retryLabel?: string;
  icon: LucideIcon;
  themeColor?: "red" | "orange" | "blue" | "slate";
}

const THEME_STYLES = {
  red: {
    iconBg: "bg-[#fef2f2]",
    iconBorder: "border-[#fecaca]",
    iconText: "text-[#ef4444]",
    badgeBg: "bg-[#fef2f2]",
    badgeText: "text-[#b91c1c]",
    badgeBorder: "border-[#fecaca]",
  },
  orange: {
    iconBg: "bg-[#fff7ed]",
    iconBorder: "border-[#fed7aa]",
    iconText: "text-[#f97316]",
    badgeBg: "bg-[#fff7ed]",
    badgeText: "text-[#b45309]",
    badgeBorder: "border-[#fed7aa]",
  },
  blue: {
    iconBg: "bg-[#eff6ff]",
    iconBorder: "border-[#bfdbfe]",
    iconText: "text-[#0284c7]",
    badgeBg: "bg-[#eff6ff]",
    badgeText: "text-[#0369a1]",
    badgeBorder: "border-[#bfdbfe]",
  },
  slate: {
    iconBg: "bg-[#f8fafc]",
    iconBorder: "border-[#e2e8f0]",
    iconText: "text-[#475569]",
    badgeBg: "bg-[#f1f5f9]",
    badgeText: "text-[#334155]",
    badgeBorder: "border-[#cbd5e1]",
  },
};

/**
 * Standardized, accessible error fallback component across application modules.
 * Eliminates repetitive boilerplate in error.tsx files while keeping module-specific branding.
 */
export function ModuleErrorFallback({
  error,
  reset,
  moduleName,
  badgeLabel,
  defaultTitle,
  defaultMessage,
  retryLabel = "Coba Lagi",
  icon: Icon,
  themeColor = "red",
}: ModuleErrorFallbackProps) {
  useEffect(() => {
    console.error(`${moduleName} Runtime Error:`, error);
  }, [moduleName, error]);

  const theme = THEME_STYLES[themeColor];

  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col justify-center items-center px-4 py-12 text-[#0f172a]">
      <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl p-8 shadow-xs text-center space-y-6">
        <div
          className={`w-16 h-16 rounded-2xl ${theme.iconBg} border ${theme.iconBorder} flex items-center justify-center mx-auto ${theme.iconText} shadow-xs`}
        >
          <Icon className="w-8 h-8" />
        </div>

        <div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}
          >
            {badgeLabel}
          </span>
          <h2 className="text-xl font-bold text-[#0f172a] mt-2">
            {defaultTitle}
          </h2>
          <p className="text-xs text-[#64748b] mt-2 leading-relaxed">
            {error.message || defaultMessage}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2 border-t border-[#f1f5f9]">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#00a2b9] hover:bg-[#008b9e] text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer focus-utility-ring"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{retryLabel}</span>
          </button>
          <Link
            href="/"
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold flex items-center gap-1.5 transition focus-utility-ring"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Beranda</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

