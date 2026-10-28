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
 * Next.js Edge Network Proxy (Layer 1).
 * Intercepts incoming network traffic before hitting application code.
 * Handles boundary security: optimistic redirection, route aliases, and header enrichment.
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

  // 3. Handle Login page (guest only)
  if (pathname === "/login") {
    if (user) {
      const redirectUrl = getDefaultRedirectForRole(user.role);
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.next();
  }

  // 4. Handle Unauthorized 403 page
  if (pathname === "/unauthorized") {
    return NextResponse.next();
  }

  // 5. Root Dashboard (/) - STRICTLY PROTECTED: unauthenticated visitors are redirected to /login
  if (pathname === "/") {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 6. Enforce RBAC for all protected application routes
  if (!isPublicRoute(pathname)) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
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

  // 7. Header Enrichment: inject secure user context into downstream request headers
  const requestHeaders = new Headers(request.headers);
  if (user) {
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-role", user.role);
    requestHeaders.set("x-user-name", encodeURIComponent(user.name));
  }

  // 8. Handle friendly URL rewrites for operational aliases
  if (pathname === "/operator/triage") {
    return NextResponse.rewrite(new URL("/triage", request.url), {
      request: { headers: requestHeaders },
    });
  }
  if (pathname === "/manager/reports") {
    return NextResponse.rewrite(new URL("/reports", request.url), {
      request: { headers: requestHeaders },
    });
  }
  if (pathname === "/admin/users") {
    return NextResponse.rewrite(new URL("/users", request.url), {
      request: { headers: requestHeaders },
    });
  }
  if (pathname === "/admin/migration") {
    return NextResponse.rewrite(new URL("/migration", request.url), {
      request: { headers: requestHeaders },
    });
  }
  if (pathname === "/admin/audit-logs") {
    return NextResponse.rewrite(new URL("/audit-logs", request.url), {
      request: { headers: requestHeaders },
    });
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  if (user) {
    response.headers.set("x-user-role", user.role);
    response.headers.set("x-user-id", user.id);
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
