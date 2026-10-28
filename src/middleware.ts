import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { Role } from "@prisma/client";
import { SESSION_COOKIE_NAME, getDefaultRedirectForRole } from "@/lib/auth-constants";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "goro-s2jb-command-center-secret-key-pln-2026-production-secured"
);

interface JwtUserPayload {
  id: string;
  username: string;
  role: Role;
  name: string;
}

async function verifyTokenEdge(token: string): Promise<JwtUserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.id || !payload.role) return null;
    return {
      id: payload.id as string,
      username: payload.username as string,
      role: payload.role as Role,
      name: (payload.name as string) || (payload.username as string),
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, APIs, and favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Read session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = sessionCookie ? await verifyTokenEdge(sessionCookie) : null;

  // 3. Handle Login page when already authenticated
  if (pathname === "/login") {
    if (user) {
      const redirectUrl = getDefaultRedirectForRole(user.role);
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.next();
  }

  // 4. Handle Unauthorized page (always accessible)
  if (pathname === "/unauthorized") {
    return NextResponse.next();
  }

  // 5. Define Protected Route Matchers
  const isIntakeRoute = pathname.startsWith("/intake");
  const isOperatorRoute = pathname.startsWith("/operator") || pathname.startsWith("/triage");
  const isManagerRoute = pathname.startsWith("/manager") || pathname.startsWith("/reports");
  const isAdminRoute = pathname.startsWith("/admin");

  const isProtectedRoute = isIntakeRoute || isOperatorRoute || isManagerRoute || isAdminRoute;

  if (isProtectedRoute) {
    // If not logged in, redirect to login with return path
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-Based Access Control (RBAC) Enforcement
    if (isIntakeRoute) {
      const allowed: Role[] = [Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN];
      if (!allowed.includes(user.role)) {
        return NextResponse.redirect(new URL("/unauthorized?required=PETUGAS_LAPANGAN", request.url));
      }
    }

    if (isOperatorRoute) {
      const allowed: Role[] = [Role.PEGAWAI, Role.SUPER_ADMIN];
      if (!allowed.includes(user.role)) {
        return NextResponse.redirect(new URL("/unauthorized?required=PEGAWAI", request.url));
      }
    }

    if (isManagerRoute) {
      const allowed: Role[] = [Role.MANAGER, Role.SUPER_ADMIN];
      if (!allowed.includes(user.role)) {
        return NextResponse.redirect(new URL("/unauthorized?required=MANAGER", request.url));
      }
    }

    if (isAdminRoute) {
      if (user.role !== Role.SUPER_ADMIN) {
        return NextResponse.redirect(new URL("/unauthorized?required=SUPER_ADMIN", request.url));
      }
    }
  }

  // 6. Handle friendly URL rewrites for aliases
  if (pathname === "/operator/triage") {
    return NextResponse.rewrite(new URL("/triage", request.url));
  }
  if (pathname === "/manager/reports") {
    return NextResponse.rewrite(new URL("/reports", request.url));
  }

  return NextResponse.next();
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
