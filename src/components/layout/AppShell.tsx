"use client";

import React, { useState } from "react";
import { GlobalSidebar } from "./GlobalSidebar";
import { TopHeader } from "./TopHeader";
import { MobileNavDrawer } from "./MobileNavDrawer";

interface AppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function AppShell({ children, pageTitle }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f9f9ff] flex flex-col">
      {/* 1. Mobile Top Navigation Bar (< 1024px) */}
      <TopHeader
        onOpenMobileNav={() => setIsMobileNavOpen(true)}
        title={pageTitle}
      />

      {/* 2. Mobile Slide-Over Drawer (< 1024px) */}
      <MobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* 3. Main Layout Container */}
      <div className="flex-1 flex">
        {/* Desktop Fixed Sidebar (>= 1024px) */}
        <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:z-30 lg:w-64">
          <GlobalSidebar className="w-64" />
        </div>

        {/* Content Area with Left Offset on Desktop */}
        <main className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
