import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { rolesForRouteGroup, type RouteGroup } from "@/lib/routeAuthorization";
import { requireServerAuth } from "@/lib/server-auth";

export interface RoleLayoutConfig {
  routeGroup: RouteGroup;
  pageTitle: string;
}

/**
 * Higher-Order Server Component factory for role-protected route groups.
 * Derives allowed roles from Otorisasi Rute before rendering AppShell.
 */
export function createRoleLayout({ routeGroup, pageTitle }: RoleLayoutConfig) {
  const allowedRoles = [...rolesForRouteGroup(routeGroup)];

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
  routeGroup,
  pageTitle,
}: RoleLayoutProps) {
  await requireServerAuth([...rolesForRouteGroup(routeGroup)]);
  return <AppShell pageTitle={pageTitle}>{children}</AppShell>;
}
