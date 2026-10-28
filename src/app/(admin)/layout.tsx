import React from "react";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/layout/AppShell";
import { requireServerAuth } from "@/lib/server-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layer 2 Server Guard: Verify active session and role (exclusive Super Admin)
  await requireServerAuth([Role.SUPER_ADMIN]);

  return <AppShell pageTitle="Administrasi Sistem">{children}</AppShell>;
}
