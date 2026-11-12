import { Role } from "@prisma/client";

export const SESSION_COOKIE_NAME = "goro_session_token";
export const USER_ID_COOKIE_NAME = "goro_user_id";

/**
 * Determines session duration based on PRD security specifications:
 * - Petugas Lapangan: 7 days (604,800s) for field convenience
 * - Pegawai & Manager & Super Admin: 24 hours (86,400s) for executive protection
 */
export function getRoleMaxAgeSeconds(role: Role): number {
  if (role === Role.PETUGAS_LAPANGAN) {
    return 7 * 24 * 60 * 60; // 7 days
  }
  return 24 * 60 * 60; // 24 hours
}

/**
 * Maps user role to their dedicated operational landing dashboard.
 */
export function getDefaultRedirectForRole(role: Role): string {
  switch (role) {
    case Role.PETUGAS_LAPANGAN:
      return "/intake";
    case Role.PEGAWAI:
      return "/reviews";
    case Role.MANAGER:
      return "/reports";
    case Role.SUPER_ADMIN:
      return "/users";
    default:
      return "/login";
  }
}

export interface CookieRequestContext {
  headers?: Pick<Headers, "get">;
  nextUrl?: { protocol?: string };
  url?: string;
}

/**
 * Determines whether auth cookies should include the `Secure` attribute.
 *
 * Precedence:
 * 1. Explicit `COOKIE_SECURE` env override ("true" or "false").
 * 2. Reverse-proxy `x-forwarded-proto` header (first value === "https").
 * 3. Request protocol (`nextUrl.protocol` or `url` starting with "https://").
 * 4. Fallback to configured `BETTER_AUTH_URL` / `NEXTAUTH_URL` when no request is given.
 *
 * Avoids hardcoding `Secure` from `NODE_ENV === "production"` so plain HTTP
 * IP deployments in Docker can still persist session cookies.
 */
export function shouldUseSecureCookie(request?: CookieRequestContext): boolean {
  const cookieSecureEnv = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (cookieSecureEnv === "true") {
    return true;
  }
  if (cookieSecureEnv === "false") {
    return false;
  }

  if (request) {
    const forwardedProto = request.headers
      ?.get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    if (forwardedProto) {
      return forwardedProto === "https";
    }

    const nextProtocol = request.nextUrl?.protocol?.toLowerCase();
    if (nextProtocol) {
      return nextProtocol === "https:";
    }

    const rawUrl = request.url?.trim().toLowerCase();
    if (rawUrl) {
      return rawUrl.startsWith("https://");
    }
  }

  const configuredUrl = (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    ""
  )
    .trim()
    .toLowerCase();

  return configuredUrl.startsWith("https://");
}
