import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { proxy } from "@/proxy";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

describe("Task 12.1: Layer 1 Edge Proxy Penetration Test Suite", () => {
  let fieldToken: string;
  let operatorToken: string;
  let managerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    fieldToken = await signSessionToken({
      id: "usr_mock_field_12",
      username: "petugas_rivai",
      name: "Ahmad Surveyor Lapangan",
      role: Role.PETUGAS_LAPANGAN,
      up3Id: "up3_plg",
      ulpId: "ulp_riv",
    });

    operatorToken = await signSessionToken({
      id: "usr_mock_operator_12",
      username: "pegawai_operator",
      name: "Budi Operator Triase",
      role: Role.PEGAWAI,
      up3Id: "up3_plg",
      ulpId: null,
    });

    managerToken = await signSessionToken({
      id: "usr_mock_manager_12",
      username: "manager_s2jb",
      name: "Hendra Manager UID",
      role: Role.MANAGER,
      up3Id: null,
      ulpId: null,
    });

    adminToken = await signSessionToken({
      id: "usr_mock_admin_12",
      username: "superadmin",
      name: "Super Administrator",
      role: Role.SUPER_ADMIN,
      up3Id: null,
      ulpId: null,
    });
  });

  function createRequest(pathname: string, token?: string, customHeaders?: Record<string, string>) {
    const url = `http://localhost:3000${pathname}`;
    const headers = new Headers(customHeaders);
    if (token) {
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
    }
    return new NextRequest(url, { headers });
  }

  describe("A. Guest Penetration (Unauthenticated Visitors)", () => {
    it("should redirect unauthenticated guest accessing root (/) strictly to /login without redirect parameter", async () => {
      const req = createRequest("/");
      const res = await proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    });

    it("should allow unauthenticated guest to access public pages (/login and /unauthorized)", async () => {
      const resLogin = await proxy(createRequest("/login"));
      expect(resLogin.status).toBe(200);

      const resUnauthorized = await proxy(createRequest("/unauthorized"));
      expect(resUnauthorized.status).toBe(200);
    });

    it("should block unauthenticated guest from all protected canonical routes and redirect to /login with redirect query param", async () => {
      const protectedRoutes = [
        "/intake",
        "/triage",
        "/reports",
        "/users",
        "/migration",
        "/audit-logs",
      ];

      for (const route of protectedRoutes) {
        const req = createRequest(route);
        const res = await proxy(req);

        expect(res.status).toBe(307);
        const location = res.headers.get("location") || "";
        expect(location).toContain("/login");
        expect(location).toContain(`redirect=${encodeURIComponent(route)}`);
      }
    });
  });

  describe("B. Authenticated User Redirection from /login", () => {
    it("should redirect authenticated users on /login directly to their canonical role dashboard", async () => {
      const expectations = [
        { role: Role.PETUGAS_LAPANGAN, token: fieldToken, expected: "/intake" },
        { role: Role.PEGAWAI, token: operatorToken, expected: "/triage" },
        { role: Role.MANAGER, token: managerToken, expected: "/reports" },
        { role: Role.SUPER_ADMIN, token: adminToken, expected: "/users" },
      ];

      for (const item of expectations) {
        const req = createRequest("/login", item.token);
        const res = await proxy(req);

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe(`http://localhost:3000${item.expected}`);
      }
    });
  });

  describe("C. Role-Based Access Control Matrix (Defense Layer 1)", () => {
    describe("1. Petugas Lapangan (PETUGAS_LAPANGAN)", () => {
      it("should permit access to / and /intake", async () => {
        const resHome = await proxy(createRequest("/", fieldToken));
        expect(resHome.status).toBe(200);
        expect(resHome.headers.get("x-user-role")).toBe(Role.PETUGAS_LAPANGAN);

        const resIntake = await proxy(createRequest("/intake", fieldToken));
        expect(resIntake.status).toBe(200);
      });

      it("should reject and redirect unauthorized routes to /unauthorized with required role param", async () => {
        const forbiddenRoutes = [
          { path: "/triage", required: "PEGAWAI" },
          { path: "/reports", required: "MANAGER" },
          { path: "/users", required: "SUPER_ADMIN" },
          { path: "/migration", required: "SUPER_ADMIN" },
          { path: "/audit-logs", required: "SUPER_ADMIN" },
        ];

        for (const item of forbiddenRoutes) {
          const res = await proxy(createRequest(item.path, fieldToken));
          expect(res.status).toBe(307);
          const location = res.headers.get("location") || "";
          expect(location).toContain("/unauthorized");
          expect(location).toContain(`required=${item.required}`);
        }
      });
    });

    describe("2. Pegawai Triase (PEGAWAI)", () => {
      it("should permit access to / and /triage", async () => {
        const resHome = await proxy(createRequest("/", operatorToken));
        expect(resHome.status).toBe(200);
        expect(resHome.headers.get("x-user-role")).toBe(Role.PEGAWAI);

        const resTriage = await proxy(createRequest("/triage", operatorToken));
        expect(resTriage.status).toBe(200);
      });

      it("should reject and redirect unauthorized routes to /unauthorized", async () => {
        const forbiddenRoutes = [
          { path: "/intake", required: "PETUGAS_LAPANGAN" },
          { path: "/reports", required: "MANAGER" },
          { path: "/users", required: "SUPER_ADMIN" },
          { path: "/migration", required: "SUPER_ADMIN" },
          { path: "/audit-logs", required: "SUPER_ADMIN" },
        ];

        for (const item of forbiddenRoutes) {
          const res = await proxy(createRequest(item.path, operatorToken));
          expect(res.status).toBe(307);
          const location = res.headers.get("location") || "";
          expect(location).toContain("/unauthorized");
          expect(location).toContain(`required=${item.required}`);
        }
      });
    });

    describe("3. Manager UID (MANAGER)", () => {
      it("should permit access to / and /reports", async () => {
        const resHome = await proxy(createRequest("/", managerToken));
        expect(resHome.status).toBe(200);
        expect(resHome.headers.get("x-user-role")).toBe(Role.MANAGER);

        const resReports = await proxy(createRequest("/reports", managerToken));
        expect(resReports.status).toBe(200);
      });

      it("should reject and redirect unauthorized routes to /unauthorized", async () => {
        const forbiddenRoutes = [
          { path: "/intake", required: "PETUGAS_LAPANGAN" },
          { path: "/triage", required: "PEGAWAI" },
          { path: "/users", required: "SUPER_ADMIN" },
          { path: "/migration", required: "SUPER_ADMIN" },
          { path: "/audit-logs", required: "SUPER_ADMIN" },
        ];

        for (const item of forbiddenRoutes) {
          const res = await proxy(createRequest(item.path, managerToken));
          expect(res.status).toBe(307);
          const location = res.headers.get("location") || "";
          expect(location).toContain("/unauthorized");
          expect(location).toContain(`required=${item.required}`);
        }
      });
    });

    describe("4. Super Administrator (SUPER_ADMIN)", () => {
      it("should grant unconditional 200 OK access across all canonical system routes", async () => {
        const allCanonicalRoutes = [
          "/",
          "/intake",
          "/triage",
          "/reports",
          "/users",
          "/migration",
          "/audit-logs",
          "/unauthorized",
        ];

        for (const route of allCanonicalRoutes) {
          const res = await proxy(createRequest(route, adminToken));
          expect(res.status).toBe(200);
        }
      });
    });
  });

  describe("D. Security Hardening & Anti-Spoofing Guarantees", () => {
    it("should sanitize and strip malicious spoofed headers from incoming requests", async () => {
      const spoofedHeaders = {
        "x-user-id": "hacker_999",
        "x-user-role": "SUPER_ADMIN",
        "x-user-name": "Attacker",
      };

      const unauthReq = createRequest("/login", undefined, spoofedHeaders);
      const unauthRes = await proxy(unauthReq);
      expect(unauthRes.headers.get("x-user-id")).toBeNull();
      expect(unauthRes.headers.get("x-user-role")).toBeNull();
    });

    it("should enrich downstream headers with verified user credentials on valid session", async () => {
      const req = createRequest("/", fieldToken);
      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("x-user-role")).toBe(Role.PETUGAS_LAPANGAN);
      expect(res.headers.get("x-user-id")).toBe("usr_mock_field_12");
    });
  });
});
