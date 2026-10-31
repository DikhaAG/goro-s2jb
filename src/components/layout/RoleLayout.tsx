import React from "react";
import { Role } from "@prisma/client";
import { AppShell } from "@/components/layout/AppShell";
import { requireServerAuth } from "@/lib/server-auth";

export interface RoleLayoutConfig {
  allowedRoles: Role[];
  pageTitle: string;
}

/**
 * Higher-Order Server Component factory for role-protected route groups.
 * Enforces Layer 2 Server Authentication & Authorization before rendering AppShell.
 * Eliminates boilerplate duplication across route groups while maintaining strict isolation.
 */
export function createRoleLayout({ allowedRoles, pageTitle }: RoleLayoutConfig) {
  return async function RoleProtectedLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    await requireServerAuth(allowedRoles);
    return <AppShell pageTitle={pageTitle}>{children}</AppShell>;
  };
}

export interface RoleLayoutProps extends RoleLayoutConfig {
  children: React.ReactNode;
}

/**
 * Reusable server component for role-protected layouts.
 */
export async function RoleLayout({
  children,
  allowedRoles,
  pageTitle,
}: RoleLayoutProps) {
  await requireServerAuth(allowedRoles);
  return <AppShell pageTitle={pageTitle}>{children}</AppShell>;
}

