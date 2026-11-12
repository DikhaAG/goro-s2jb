import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { shouldUseSecureCookie } from "@/lib/auth-constants";
import { POST as postLogout } from "@/app/api/auth/logout/route";

describe("Dynamic Cookie Secure Attribute Detection (shouldUseSecureCookie)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return false in production when accessed over plain HTTP IP without proxy headers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

    const req = new NextRequest("http://103.79.237.38:3020/api/auth/login", {
      method: "POST",
    });

    expect(shouldUseSecureCookie(req)).toBe(false);
  });

  it("should return true in production when accessed directly via HTTPS", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");

    const req = new NextRequest("https://goro.pln.co.id/api/auth/login", {
      method: "POST",
    });

    expect(shouldUseSecureCookie(req)).toBe(true);
  });

  it("should return true in production when reverse proxy forwards x-forwarded-proto: https", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");

    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "x-forwarded-proto": "https",
      },
    });

    expect(shouldUseSecureCookie(req)).toBe(true);
  });

  it("should respect the first hop in comma-separated x-forwarded-proto headers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");

    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "x-forwarded-proto": "http, https",
      },
    });

    expect(shouldUseSecureCookie(req)).toBe(false);
  });

  it("should honor explicit COOKIE_SECURE=true override even on HTTP", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("COOKIE_SECURE", "true");

    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
    });

    expect(shouldUseSecureCookie(req)).toBe(true);
  });

  it("should honor explicit COOKIE_SECURE=false override even behind HTTPS proxy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "false");

    const req = new NextRequest("https://goro.pln.co.id/api/auth/login", {
      method: "POST",
      headers: {
        "x-forwarded-proto": "https",
      },
    });

    expect(shouldUseSecureCookie(req)).toBe(false);
  });

  it("should fall back to BETTER_AUTH_URL / NEXTAUTH_URL when called without a request", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");
    vi.stubEnv("BETTER_AUTH_URL", "http://103.79.237.38:3020");
    expect(shouldUseSecureCookie()).toBe(false);

    vi.stubEnv("BETTER_AUTH_URL", "https://goro.pln.co.id");
    expect(shouldUseSecureCookie()).toBe(true);
  });

  it("should omit Secure on logout Set-Cookie for plain HTTP and include Secure for HTTPS proxy", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");

    const httpReq = new NextRequest("http://103.79.237.38:3020/api/auth/logout", {
      method: "POST",
    });
    const httpRes = await postLogout(httpReq);
    expect(httpRes.status).toBe(200);
    const httpCookies = httpRes.headers.get("set-cookie") || "";
    expect(httpCookies).toContain("goro_session_token=;");
    expect(httpCookies).not.toContain("Secure");

    const httpsProxyReq = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        "x-forwarded-proto": "https",
      },
    });
    const httpsRes = await postLogout(httpsProxyReq);
    expect(httpsRes.status).toBe(200);
    const httpsCookies = httpsRes.headers.get("set-cookie") || "";
    expect(httpsCookies).toContain("goro_session_token=;");
    expect(httpsCookies).toContain("Secure");
  });
});

