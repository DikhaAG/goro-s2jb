import React from "react";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/layout/AppShell";
import { requireServerAuth } from "@/lib/server-auth";

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layer 2 Server Guard: Verify active session and role
  await requireServerAuth([Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN]);

  return <AppShell pageTitle="Entri Eviden">{children}</AppShell>;
}
