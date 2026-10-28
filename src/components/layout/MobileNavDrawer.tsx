"use client";

import React, { useEffect } from "react";
import { GlobalSidebar } from "./GlobalSidebar";
import { X } from "lucide-react";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ isOpen, onClose }: MobileNavDrawerProps) {
  // Listen for Escape key (Anti-Slop R-32 Keyboard A11y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl z-10 transition-transform duration-200 ease-out">
        {/* Close Button: min 44px tap target (R-03) */}
        <div className="absolute top-3 right-3 z-20">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Menu Navigasi"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-100 text-[#475569] hover:text-[#0f172a] hover:bg-slate-200 transition-colors focus-utility-ring cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <GlobalSidebar onClose={onClose} className="w-full" />
      </div>
    </div>
  );
}
