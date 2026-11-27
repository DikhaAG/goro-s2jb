import { Role } from "@prisma/client";

export type RouteGroup = "admin" | "operator" | "manager" | "field";

export type NavItemId =
  | "home"
  | "intake"
  | "reviews"
  | "reports"
  | "users"
  | "migration"
  | "migration-monitor"
  | "system-processes"
  | "audit-logs";

export interface SidebarNavItem {
  readonly id: NavItemId;
  readonly label: string;
  readonly href: string;
  readonly active: boolean;
}

export type ProxyDecision<TUser extends { role: Role }> =
  | { readonly kind: "bypass" }
  | { readonly kind: "allow"; readonly user: TUser | null; readonly rewriteTo?: string }
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "not-found"; readonly user: TUser };

export interface RoleRoutePolicy {
  canVisit(pathname: string): boolean;
  resolveLanding(unsafeRedirect?: string | null): string;
  sidebarItems(currentPathname: string): readonly SidebarNavItem[];
}

interface InternalNavSpec {
  readonly id: NavItemId;
  readonly label: string;
}

interface InternalRouteSpec {
  readonly canonicalPath: string;
  readonly exactOnly?: boolean;
  readonly group?: RouteGroup;
  readonly allowedRoles: readonly Role[];
  readonly aliases?: readonly string[];
  readonly nav?: InternalNavSpec;
}

const STATIC_ASSET_EXTENSION_RE =
  /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|woff|woff2|ttf|map|txt|xml)$/i;

const ALL_OPERATIONAL_ROLES: readonly Role[] = Object.freeze([
  Role.PETUGAS_LAPANGAN,
  Role.PEGAWAI,
  Role.MANAGER,
  Role.SUPER_ADMIN,
]);

const ROLE_LANDING_PATH: Readonly<Record<Role, string>> = Object.freeze({
  [Role.PETUGAS_LAPANGAN]: "/intake",
  [Role.PEGAWAI]: "/reviews",
  [Role.MANAGER]: "/reports",
  [Role.SUPER_ADMIN]: "/users",
});

// Single source of truth for Otorisasi Rute: canonical routes, aliases, role guards, and sidebar order.
const ROUTE_SPECS: readonly InternalRouteSpec[] = Object.freeze([
  {
    canonicalPath: "/",
    exactOnly: true,
    allowedRoles: ALL_OPERATIONAL_ROLES,
    nav: { id: "home", label: "Beranda" },
  },
  {
    canonicalPath: "/intake",
    group: "field",
    allowedRoles: [Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN],
    nav: { id: "intake", label: "Entri Eviden" },
  },
  {
    canonicalPath: "/reviews",
    group: "operator",
    allowedRoles: [Role.PEGAWAI, Role.SUPER_ADMIN],
    aliases: ["/operator/triage", "/triage"],
    nav: { id: "reviews", label: "Triase & Data Ulasan" },
  },
  {
    canonicalPath: "/reports",
    group: "manager",
    allowedRoles: [Role.MANAGER, Role.SUPER_ADMIN],
    aliases: ["/manager/reports"],
    nav: { id: "reports", label: "Laporan Eksekutif" },
  },
  {
    canonicalPath: "/users",
    group: "admin",
    allowedRoles: [Role.SUPER_ADMIN],
    aliases: ["/admin/users"],
    nav: { id: "users", label: "Manajemen Pengguna" },
  },
  {
    canonicalPath: "/migration",
    group: "operator",
    allowedRoles: [Role.PEGAWAI, Role.SUPER_ADMIN],
    aliases: ["/admin/migration"],
    nav: { id: "migration", label: "Migrasi Data Eviden" },
  },
  {
    canonicalPath: "/migration/monitor",
    group: "operator",
    allowedRoles: [Role.PEGAWAI, Role.SUPER_ADMIN],
    nav: { id: "migration-monitor", label: "Monitoring Worker" },
  },
  {
    canonicalPath: "/system-processes",
    group: "admin",
    allowedRoles: [Role.SUPER_ADMIN],
    aliases: ["/admin/system-processes"],
    nav: { id: "system-processes", label: "Layanan & Proses Sistem" },
  },
  {
    canonicalPath: "/audit-logs",
    group: "admin",
    allowedRoles: [Role.SUPER_ADMIN],
    aliases: ["/admin/audit-logs"],
    nav: { id: "audit-logs", label: "Catatan Audit Log" },
  },
]);

interface AliasEntry {
  readonly alias: string;
  readonly target: string;
}

const ALIAS_ENTRIES: readonly AliasEntry[] = Object.freeze(
  ROUTE_SPECS.flatMap((spec) =>
    (spec.aliases ?? []).map((alias) => ({ alias, target: spec.canonicalPath }))
  ).sort((a, b) => b.alias.length - a.alias.length)
);

const ROUTES_BY_SPECIFICITY: readonly InternalRouteSpec[] = Object.freeze(
  [...ROUTE_SPECS].sort((a, b) => b.canonicalPath.length - a.canonicalPath.length)
);

function assertPolicyInvariants(): void {
  const canonicalSet = new Set<string>();
  const aliasSet = new Set<string>();

  for (const spec of ROUTE_SPECS) {
    if (canonicalSet.has(spec.canonicalPath)) {
      throw new Error(`Otorisasi Rute: duplicate canonical path ${spec.canonicalPath}`);
    }
    canonicalSet.add(spec.canonicalPath);
    for (const alias of spec.aliases ?? []) {
      if (aliasSet.has(alias)) {
        throw new Error(`Otorisasi Rute: duplicate alias ${alias}`);
      }
      aliasSet.add(alias);
    }
  }

  for (const alias of aliasSet) {
    if (canonicalSet.has(alias)) {
      throw new Error(`Otorisasi Rute: alias collides with canonical path ${alias}`);
    }
  }

  for (const role of Object.values(Role)) {
    const landing = ROLE_LANDING_PATH[role];
    const spec = ROUTE_SPECS.find((item) => item.canonicalPath === landing);
    if (!spec || !spec.allowedRoles.includes(role)) {
      throw new Error(`Otorisasi Rute: invalid landing route for role ${role}`);
    }
  }
}

assertPolicyInvariants();

function matchesSegmentPrefix(pathname: string, prefix: string, exactOnly = false): boolean {
  if (exactOnly || prefix === "/") {
    return pathname === prefix;
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function normalizePathname(rawPathname: string): string | null {
  if (!rawPathname || !rawPathname.startsWith("/")) return null;
  if (rawPathname.includes("\\") || rawPathname.includes("\0") || rawPathname.includes("//")) {
    return null;
  }
  const withoutQueryOrHash = rawPathname.split(/[?#]/, 1)[0];
  if (/[\x00-\x1f\x7f]/.test(withoutQueryOrHash)) return null;

  const segments = withoutQueryOrHash.split("/");
  if (segments.some((seg) => seg === ".." || seg === ".")) {
    return null;
  }

  if (withoutQueryOrHash.length > 1 && withoutQueryOrHash.endsWith("/")) {
    return withoutQueryOrHash.slice(0, -1);
  }
  return withoutQueryOrHash;
}

function isStaticPath(pathname: string): boolean {
  if (matchesSegmentPrefix(pathname, "/_next") || pathname === "/favicon.ico") {
    return true;
  }
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return STATIC_ASSET_EXTENSION_RE.test(lastSegment);
}

function isPublicAuthPath(pathname: string, target: "/login" | "/unauthorized"): boolean {
  return matchesSegmentPrefix(pathname, target);
}

function canonicalizeKnownPath(pathname: string): {
  canonicalPath: string;
  rewritten: boolean;
} {
  for (const entry of ALIAS_ENTRIES) {
    if (matchesSegmentPrefix(pathname, entry.alias)) {
      return {
        canonicalPath: `${entry.target}${pathname.slice(entry.alias.length)}`,
        rewritten: true,
      };
    }
  }
  return { canonicalPath: pathname, rewritten: false };
}

function findMatchingRoute(canonicalPath: string): InternalRouteSpec | null {
  for (const spec of ROUTES_BY_SPECIFICITY) {
    if (matchesSegmentPrefix(canonicalPath, spec.canonicalPath, spec.exactOnly)) {
      return spec;
    }
  }
  return null;
}

function primaryRequiredRole(allowedRoles: readonly Role[]): Role {
  const nonAdmin = allowedRoles.find((role) => role !== Role.SUPER_ADMIN);
  return nonAdmin ?? allowedRoles[0];
}

function isKnownRole(role: Role | null | undefined): role is Role {
  return typeof role === "string" && Object.values(Role).includes(role);
}

function normalizeSearch(search?: string): string {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}

function extractRedirectParam(search?: string): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("redirect");
}

function isSafeRelativeCandidate(raw: string): boolean {
  if (!raw.startsWith("/") || raw.startsWith("//")) return false;
  if (raw.includes("\\") || /[\x00-\x1f\x7f]/.test(raw)) return false;
  const lower = raw.toLowerCase();
  if (lower.includes("%5c") || lower.startsWith("/%2f")) return false;
  return true;
}

/**
 * Evaluates a Next.js proxy page request against Otorisasi Rute.
 * Skips Sesi Pengguna resolution on static assets and /unauthorized.
 */
export async function authorizeProxy<TUser extends { role: Role }>(
  pathname: string,
  resolveUser: () => Promise<TUser | null> | TUser | null,
  search?: string
): Promise<ProxyDecision<TUser>> {
  const normalized = normalizePathname(pathname);
  if (!normalized) {
    const user = await resolveUser();
    return user ? { kind: "not-found", user } : { kind: "redirect", to: "/login" };
  }

  if (isStaticPath(normalized)) {
    return { kind: "bypass" };
  }

  if (isPublicAuthPath(normalized, "/unauthorized")) {
    return { kind: "allow", user: null };
  }

  const user = await resolveUser();
  const normalizedSearch = normalizeSearch(search);

  if (isPublicAuthPath(normalized, "/login")) {
    if (!user) {
      return { kind: "allow", user: null };
    }
    const requestedRedirect = extractRedirectParam(normalizedSearch);
    return {
      kind: "redirect",
      to: forRole(user.role).resolveLanding(requestedRedirect),
    };
  }

  const { canonicalPath, rewritten } = canonicalizeKnownPath(normalized);
  const spec = findMatchingRoute(canonicalPath);

  if (!spec) {
    if (!user) {
      return { kind: "redirect", to: "/login" };
    }
    return { kind: "not-found", user };
  }

  if (!user) {
    if (normalized === "/") {
      return { kind: "redirect", to: "/login" };
    }
    const requestedWithSearch = `${normalized}${normalizedSearch}`;
    return {
      kind: "redirect",
      to: `/login?redirect=${encodeURIComponent(requestedWithSearch)}`,
    };
  }

  if (!spec.allowedRoles.includes(user.role)) {
    const required = primaryRequiredRole(spec.allowedRoles);
    return {
      kind: "redirect",
      to: `/unauthorized?required=${required}`,
    };
  }

  return {
    kind: "allow",
    user,
    ...(rewritten ? { rewriteTo: `${canonicalPath}${normalizedSearch}` } : {}),
  };
}

/**
 * Derives allowed roles for a Next.js route-group layout from the single policy table.
 */
export function rolesForRouteGroup(group: RouteGroup): readonly Role[] {
  const members = ROUTE_SPECS.filter((spec) => spec.group === group);
  if (members.length === 0) {
    throw new Error(`Otorisasi Rute: unknown route group "${group}"`);
  }

  const firstRoles = members[0].allowedRoles;
  for (const member of members) {
    if (
      member.allowedRoles.length !== firstRoles.length ||
      member.allowedRoles.some((r, idx) => r !== firstRoles[idx])
    ) {
      throw new Error(`Otorisasi Rute: inconsistent roles within route group "${group}"`);
    }
  }

  return firstRoles;
}

/**
 * Returns a role-scoped policy handle for direct access checks, safe post-login landing,
 * and sidebar navigation rendering.
 */
export function forRole(role: Role | null | undefined): RoleRoutePolicy {
  const validRole = isKnownRole(role) ? role : null;

  function canVisit(pathname: string): boolean {
    const normalized = normalizePathname(pathname);
    if (!normalized || isStaticPath(normalized)) return false;

    if (isPublicAuthPath(normalized, "/login") || isPublicAuthPath(normalized, "/unauthorized")) {
      return true;
    }

    if (!validRole) return false;

    const { canonicalPath } = canonicalizeKnownPath(normalized);
    const spec = findMatchingRoute(canonicalPath);
    return spec !== null && spec.allowedRoles.includes(validRole);
  }

  function resolveLanding(unsafeRedirect?: string | null): string {
    if (!validRole) return "/login";
    const defaultLanding = ROLE_LANDING_PATH[validRole];

    const candidate = unsafeRedirect?.trim();
    if (!candidate || !isSafeRelativeCandidate(candidate)) {
      return defaultLanding;
    }

    let parsed: URL;
    try {
      parsed = new URL(candidate, "https://goro.internal");
    } catch {
      return defaultLanding;
    }

    if (parsed.origin !== "https://goro.internal") {
      return defaultLanding;
    }

    const normalizedPath = normalizePathname(parsed.pathname);
    if (
      !normalizedPath ||
      isStaticPath(normalizedPath) ||
      isPublicAuthPath(normalizedPath, "/login") ||
      isPublicAuthPath(normalizedPath, "/unauthorized")
    ) {
      return defaultLanding;
    }

    const { canonicalPath } = canonicalizeKnownPath(normalizedPath);
    const spec = findMatchingRoute(canonicalPath);
    if (!spec || !spec.allowedRoles.includes(validRole)) {
      return defaultLanding;
    }

    return `${canonicalPath}${parsed.search}${parsed.hash}`;
  }

  function sidebarItems(currentPathname: string): readonly SidebarNavItem[] {
    if (!validRole) return [];

    const visibleSpecs = ROUTE_SPECS.filter(
      (spec): spec is InternalRouteSpec & { nav: InternalNavSpec } =>
        Boolean(spec.nav) && spec.allowedRoles.includes(validRole)
    );

    const normalizedCurrent = normalizePathname(currentPathname);
    const canonicalCurrent = normalizedCurrent
      ? canonicalizeKnownPath(normalizedCurrent).canonicalPath
      : "";

    let activeHref: string | null = null;
    if (canonicalCurrent) {
      let bestMatchLength = -1;
      for (const spec of visibleSpecs) {
        if (matchesSegmentPrefix(canonicalCurrent, spec.canonicalPath, spec.exactOnly)) {
          if (spec.canonicalPath.length > bestMatchLength) {
            bestMatchLength = spec.canonicalPath.length;
            activeHref = spec.canonicalPath;
          }
        }
      }
    }

    return visibleSpecs.map((spec) => ({
      id: spec.nav.id,
      label: spec.nav.label,
      href: spec.canonicalPath,
      active: spec.canonicalPath === activeHref,
    }));
  }

  return {
    canVisit,
    resolveLanding,
    sidebarItems,
  };
}
