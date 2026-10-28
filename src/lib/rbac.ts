import { Role } from "@prisma/client";

export interface RoutePermission {
  pattern: RegExp;
  prefix: string;
  allowedRoles: Role[];
  description: string;
}

/**
 * Single Source of Truth for Route-Based Access Control (RBAC).
 * Enforced across Edge Proxy, Server Layouts, Route Handlers, and UI Navigation.
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Admin module: exclusive to SUPER_ADMIN (/users, /migration, /audit-logs, /admin/*)
  {
    pattern: /^\/(users(\/.*)?|migration(\/.*)?|audit-logs(\/.*)?|admin(\/.*)?)$/,
    prefix: "/users",
    allowedRoles: [Role.SUPER_ADMIN],
    description: "Modul Administrasi Sistem (Users, Migration, Audit Logs)",
  },
  // Field intake: Petugas Lapangan and Super Admin
  {
    pattern: /^\/intake(\/.*)?$/,
    prefix: "/intake",
    allowedRoles: [Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN],
    description: "Modul Entri Eviden Lapangan",
  },
  // Operator triage: Pegawai and Super Admin
  {
    pattern: /^\/(operator\/triage|triage)(\/.*)?$/,
    prefix: "/triage",
    allowedRoles: [Role.PEGAWAI, Role.SUPER_ADMIN],
    description: "Modul Triase Ulasan Operator",
  },
  // Manager reports: Manager and Super Admin
  {
    pattern: /^\/(manager\/reports|reports)(\/.*)?$/,
    prefix: "/reports",
    allowedRoles: [Role.MANAGER, Role.SUPER_ADMIN],
    description: "Modul Laporan & Intelijen Manajer",
  },
  // Root Dashboard: Accessible to all authenticated operational roles, BLOCKED for unauthenticated users
  {
    pattern: /^\/$/,
    prefix: "/",
    allowedRoles: [
      Role.PETUGAS_LAPANGAN,
      Role.PEGAWAI,
      Role.MANAGER,
      Role.SUPER_ADMIN,
    ],
    description: "Pusat Komando Operasional (Beranda)",
  },
];

/**
 * Public routes that unauthenticated users are allowed to access.
 */
export const PUBLIC_ROUTES = ["/login", "/unauthorized"];

/**
 * Determines whether a given pathname is publicly accessible without login.
 */
export function isPublicRoute(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon.ico") || pathname.includes(".")) {
    return true;
  }
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Evaluates whether a role is authorized to access a given pathname.
 * Returns true if permitted, false otherwise.
 */
export function isRouteAllowed(pathname: string, userRole?: Role | null): boolean {
  if (isPublicRoute(pathname)) {
    return true;
  }

  if (!userRole) {
    return false;
  }

  // Find the most specific route permission matching the path
  const matchingRule = ROUTE_PERMISSIONS.find((rule) => rule.pattern.test(pathname));
  if (!matchingRule) {
    // If route has no specific restriction, authenticated users are permitted
    return true;
  }

  return matchingRule.allowedRoles.includes(userRole);
}

/**
 * Returns the primary required role for a given route, useful for 403 redirect query params.
 */
export function getRequiredRoleForRoute(pathname: string): Role | null {
  const matchingRule = ROUTE_PERMISSIONS.find((rule) => rule.pattern.test(pathname));
  if (!matchingRule || matchingRule.allowedRoles.length === 0) {
    return null;
  }
  // If Super Admin is the only allowed role, return SUPER_ADMIN; otherwise return the operational role
  if (matchingRule.allowedRoles.length === 1 && matchingRule.allowedRoles[0] === Role.SUPER_ADMIN) {
    return Role.SUPER_ADMIN;
  }
  return matchingRule.allowedRoles[0] ?? null;
}
