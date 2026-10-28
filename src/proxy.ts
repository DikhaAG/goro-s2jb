import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { Role } from "@prisma/client";
import { SESSION_COOKIE_NAME, getDefaultRedirectForRole } from "@/lib/auth-constants";
import { isRouteAllowed, getRequiredRoleForRoute, isPublicRoute } from "@/lib/rbac";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "goro-s2jb-command-center-secret-key-pln-2026-production-secured"
);

export interface EdgeSessionUser {
  id: string;
  username: string;
  role: Role;
  name: string;
  up3Id?: string | null;
  ulpId?: string | null;
}

/**
 * Declarative operational alias rewrite mapping.
 * Maps legacy or user-friendly route aliases to internal Next.js App Router route groups.
 */
const REWRITE_MAP: Readonly<Record<string, string>> = Object.freeze({
  "/operator/triage": "/triage",
  "/manager/reports": "/reports",
  "/admin/users": "/users",
  "/admin/migration": "/migration",
  "/admin/audit-logs": "/audit-logs",
});

/**
 * Verifies JWT session token at the Edge Runtime using Web Crypto API.
 */
export async function verifyTokenEdge(token: string): Promise<EdgeSessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.id || !payload.role || !payload.username) return null;
    return {
      id: payload.id as string,
      username: payload.username as string,
      role: payload.role as Role,
      name: (payload.name as string) || (payload.username as string),
      up3Id: (payload.up3Id as string | null) || null,
      ulpId: (payload.ulpId as string | null) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Next.js Edge Network Proxy (Layer 1 Security Boundary).
 *
 * Enforces edge-level perimeter defense:
 * 1. Bypasses static assets and internal Next.js build files.
 * 2. Authenticates session token via cryptographically signed JWT.
 * 3. Sanitizes downstream request headers (prevents header spoofing).
 * 4. Redirects authenticated users attempting to access guest-only routes (/login).
 * 5. Strictly protects the root dashboard (/) from unauthenticated visitors.
 * 6. Enforces Role-Based Access Control (RBAC) across all protected routes.
 * 7. Enriches downstream headers with verified user credentials.
 * 8. Executes declarative URL rewrites for operational route aliases.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1. Bypass static assets, internal files, and favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Read session cookie and verify token at the edge
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = sessionCookie ? await verifyTokenEdge(sessionCookie) : null;

  // 3. Prevent client header spoofing by sanitizing internal context headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-role");
  requestHeaders.delete("x-user-name");

  // 4. Handle Login page (guest only)
  if (pathname === "/login") {
    if (user) {
      const redirectUrl = getDefaultRedirectForRole(user.role);
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.next();
  }

  // 5. Handle Unauthorized 403 page
  if (pathname === "/unauthorized") {
    return NextResponse.next();
  }

  // 6. Root Dashboard (/) - STRICTLY PROTECTED: unauthenticated visitors are redirected to /login
  if (pathname === "/") {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 7. Enforce RBAC for all protected application routes
  if (!isPublicRoute(pathname)) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("redirect", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    const isAllowed = isRouteAllowed(pathname, user.role);
    if (!isAllowed) {
      const requiredRole = getRequiredRoleForRoute(pathname);
      const unauthorizedUrl = new URL("/unauthorized", request.url);
      if (requiredRole) {
        unauthorizedUrl.searchParams.set("required", requiredRole);
      }
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  // 8. Header Enrichment: inject verified user context into downstream request headers
  if (user) {
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-role", user.role);
    requestHeaders.set("x-user-name", encodeURIComponent(user.name));
  }

  // 9. Declarative operational URL rewrites
  const rewriteTarget = REWRITE_MAP[pathname];
  if (rewriteTarget) {
    const rewriteResponse = NextResponse.rewrite(new URL(rewriteTarget, request.url), {
      request: { headers: requestHeaders },
    });
    if (user) {
      rewriteResponse.headers.set("x-user-role", user.role);
      rewriteResponse.headers.set("x-user-id", user.id);
    }
    return rewriteResponse;
  }

  // 10. Pass-through response with enriched downstream context
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  if (user) {
    response.headers.set("x-user-role", user.role);
    response.headers.set("x-user-id", user.id);
  }
  return response;
}

/**
 * Universal export conventions for Edge Proxy.
 * Supports Next.js conventions as well as test harness imports.
 */
export { proxy as middleware };
export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
