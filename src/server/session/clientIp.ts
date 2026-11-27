/**
 * The client IP is trusted only behind our own reverse proxy (TRUSTED_PROXY=true),
 * which overwrites X-Real-IP with the socket address. Anything else is
 * client-controlled, so callers get null and must not key limits on it.
 */
export function trustedClientIp(headers: Headers | null | undefined): string | null {
  if (process.env.TRUSTED_PROXY !== "true") return null;
  return headers?.get("x-real-ip")?.trim() || null;
}
