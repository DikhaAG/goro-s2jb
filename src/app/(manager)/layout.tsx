import React from "react";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/layout/AppShell";
import { requireServerAuth } from "@/lib/server-auth";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layer 2 Server Guard: Verify active session and role
  await requireServerAuth([Role.MANAGER, Role.SUPER_ADMIN]);

  return <AppShell pageTitle="Laporan & Intelijen Manajer">{children}</AppShell>;
}
