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
      return "/triage";
    case Role.MANAGER:
      return "/reports";
    case Role.SUPER_ADMIN:
      return "/users";
    default:
      return "/login";
  }
}
