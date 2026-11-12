import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { hashPassword } from "@/lib/auth";

const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  checkLoginRateLimit: vi.fn(async () => ({ success: true })),
  recordLoginFailure: vi.fn(async () => ({ remaining: 4, locked: false })),
  resetLoginRateLimit: vi.fn(async () => undefined),
}));

vi.mock("@/server/services/auditService", () => ({
  logAuditEvent: vi.fn(async () => undefined),
}));

import { POST as postLogin } from "@/app/api/auth/login/route";

describe("POST /api/auth/login Set-Cookie Secure Behavior", () => {
  let passwordHash: string;

  beforeEach(async () => {
    passwordHash = await hashPassword("secret123");
    mockFindUnique.mockResolvedValue({
      id: "usr_123",
      username: "admin_s2jb",
      name: "Admin S2JB",
      role: Role.SUPER_ADMIN,
      isActive: true,
      passwordHash,
      up3Id: null,
      ulpId: null,
      up3: null,
      ulp: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("sets goro_session_token and goro_user_id without Secure flag on HTTP IP access in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

    const req = new NextRequest("http://103.79.237.38:3020/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin_s2jb", password: "secret123" }),
    });

    const res = await postLogin(req);
    expect(res.status).toBe(200);

    const setCookieHeader = res.headers.get("set-cookie") || "";
    expect(setCookieHeader).toContain("goro_session_token=");
    expect(setCookieHeader).toContain("goro_user_id=usr_123");
    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).not.toContain("Secure");
  });

  it("sets Secure attribute on login cookies when behind HTTPS reverse proxy", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECURE", "");

    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-proto": "https",
      },
      body: JSON.stringify({ username: "admin_s2jb", password: "secret123" }),
    });

    const res = await postLogin(req);
    expect(res.status).toBe(200);

    const setCookieHeader = res.headers.get("set-cookie") || "";
    expect(setCookieHeader).toContain("goro_session_token=");
    expect(setCookieHeader).toContain("goro_user_id=usr_123");
    expect(setCookieHeader).toContain("Secure");
  });
});

