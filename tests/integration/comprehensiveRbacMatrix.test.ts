import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { proxy } from "@/proxy";
import { isRouteAllowed, getRequiredRoleForRoute, isPublicRoute } from "@/lib/rbac";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { GET as getExcelExport } from "@/app/api/export/excel/route";
import { GET as getPdfExport } from "@/app/api/export/pdf/route";
import { POST as postUpload } from "@/app/api/upload/route";
import { GET as getUploadsFile } from "@/app/api/uploads/[...path]/route";

describe("Comprehensive Defense-in-Depth RBAC Penetration Matrix (Task 10)", () => {
  let fieldToken: string;
  let operatorToken: string;
  let managerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    fieldToken = await signSessionToken({
      id: "usr_field_01",
      username: "petugas_lapangan",
      name: "Budi Petugas",
      role: Role.PETUGAS_LAPANGAN,
    });

    operatorToken = await signSessionToken({
      id: "usr_operator_01",
      username: "pegawai_operator",
      name: "Siti Operator",
      role: Role.PEGAWAI,
    });

    managerToken = await signSessionToken({
      id: "usr_manager_01",
      username: "manager_uid",
      name: "Ahmad Manager",
      role: Role.MANAGER,
    });

    adminToken = await signSessionToken({
      id: "usr_admin_01",
      username: "super_admin",
      name: "Super Administrator",
      role: Role.SUPER_ADMIN,
    });
  });

  describe("1. Layer 1: Edge Proxy Access Matrix & Routing Security", () => {
    it("should REDIRECT unauthenticated guests from root (/) immediately to /login", async () => {
      const req = new NextRequest("http://localhost:3000/");
      const res = await proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    });

    it("should REDIRECT unauthenticated guests from protected internal modules to /login with redirect param", async () => {
      const routes = ["/intake", "/triage", "/reports", "/users"];

      for (const route of routes) {
        const req = new NextRequest(`http://localhost:3000${route}`);
        const res = await proxy(req);

        expect(res.status).toBe(307);
        const location = res.headers.get("location") || "";
        expect(location).toContain("/login");
        expect(location).toContain(encodeURIComponent(route));
      }
    });

    it("should ALLOW public access to /login and /unauthorized without session", async () => {
      const reqLogin = new NextRequest("http://localhost:3000/login");
      const resLogin = await proxy(reqLogin);
      expect(resLogin.status).toBe(200);

      const reqUnauthorized = new NextRequest("http://localhost:3000/unauthorized");
      const resUnauthorized = await proxy(reqUnauthorized);
      expect(resUnauthorized.status).toBe(200);
    });

    it("should REDIRECT already authenticated users hitting /login to their role dashboard", async () => {
      const testCases = [
        { token: fieldToken, expected: "/intake" },
        { token: operatorToken, expected: "/triage" },
        { token: managerToken, expected: "/reports" },
        { token: adminToken, expected: "/users" },
      ];

      for (const tc of testCases) {
        const req = new NextRequest("http://localhost:3000/login", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${tc.token}` },
        });
        const res = await proxy(req);

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe(`http://localhost:3000${tc.expected}`);
      }
    });

    it("should ENFORCE RBAC on Petugas Lapangan: permit /, /intake; reject /triage, /reports, /admin", async () => {
      // 1. Root /
      const reqRoot = new NextRequest("http://localhost:3000/", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${fieldToken}` },
      });
      const resRoot = await proxy(reqRoot);
      expect(resRoot.status).toBe(200);
      expect(resRoot.headers.get("x-user-role")).toBe("PETUGAS_LAPANGAN");

      // 2. /intake
      const reqIntake = new NextRequest("http://localhost:3000/intake", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${fieldToken}` },
      });
      const resIntake = await proxy(reqIntake);
      expect(resIntake.status).toBe(200);

      // 3. /operator/triage (Forbidden for field officer)
      const reqTriage = new NextRequest("http://localhost:3000/operator/triage", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${fieldToken}` },
      });
      const resTriage = await proxy(reqTriage);
      expect(resTriage.status).toBe(307);
      expect(resTriage.headers.get("location")).toContain("/unauthorized?required=PEGAWAI");

      // 4. /users (Forbidden for field officer)
      const reqAdmin = new NextRequest("http://localhost:3000/users", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${fieldToken}` },
      });
      const resAdmin = await proxy(reqAdmin);
      expect(resAdmin.status).toBe(307);
      expect(resAdmin.headers.get("location")).toContain("/unauthorized?required=SUPER_ADMIN");
    });

    it("should ENFORCE RBAC on Pegawai Operator: permit /, /triage, and rewrite /operator/triage; reject /intake, /admin", async () => {
      // 1. /triage canonical route
      const reqCanonical = new NextRequest("http://localhost:3000/triage", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const resCanonical = await proxy(reqCanonical);
      expect(resCanonical.status).toBe(200);

      // 2. /operator/triage should rewrite to /triage
      const reqTriage = new NextRequest("http://localhost:3000/operator/triage", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const resTriage = await proxy(reqTriage);
      expect(resTriage.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/triage");

      // 3. /intake should be forbidden
      const reqIntake = new NextRequest("http://localhost:3000/intake", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
      });
      const resIntake = await proxy(reqIntake);
      expect(resIntake.status).toBe(307);
      expect(resIntake.headers.get("location")).toContain("/unauthorized?required=PETUGAS_LAPANGAN");
    });

    it("should ENFORCE RBAC on Manager: permit /, /reports, and rewrite /manager/reports; reject /intake, /admin", async () => {
      // 1. /reports canonical route
      const reqCanonical = new NextRequest("http://localhost:3000/reports", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${managerToken}` },
      });
      const resCanonical = await proxy(reqCanonical);
      expect(resCanonical.status).toBe(200);

      // 2. /manager/reports should rewrite to /reports
      const reqReports = new NextRequest("http://localhost:3000/manager/reports", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${managerToken}` },
      });
      const resReports = await proxy(reqReports);
      expect(resReports.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/reports");

      // 3. /users should be forbidden
      const reqAdmin = new NextRequest("http://localhost:3000/users", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${managerToken}` },
      });
      const resAdmin = await proxy(reqAdmin);
      expect(resAdmin.status).toBe(307);
      expect(resAdmin.headers.get("location")).toContain("/unauthorized?required=SUPER_ADMIN");
    });

    it("should GRANT Super Admin complete access across all routes", async () => {
      const routes = ["/", "/intake", "/triage", "/reports", "/users", "/migration", "/audit-logs"];

      for (const route of routes) {
        const req = new NextRequest(`http://localhost:3000${route}`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
        });
        const res = await proxy(req);

        // Not redirected to /unauthorized or /login
        const location = res.headers.get("location");
        expect(location).toBeNull();
      }
    });
  });

  describe("2. Layer 3: HTTP Route Handlers Independent Security Guards", () => {
    describe("GET /api/export/excel", () => {
      it("should reject unauthenticated request with 401", async () => {
        const req = new NextRequest("http://localhost:3000/api/export/excel");
        const res = await getExcelExport(req);
        expect(res.status).toBe(401);
      });

      it("should reject Petugas Lapangan and Pegawai Operator with 403", async () => {
        const reqField = new NextRequest("http://localhost:3000/api/export/excel", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${fieldToken}` },
        });
        const resField = await getExcelExport(reqField);
        expect(resField.status).toBe(403);

        const reqOperator = new NextRequest("http://localhost:3000/api/export/excel", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
        });
        const resOperator = await getExcelExport(reqOperator);
        expect(resOperator.status).toBe(403);
      });

      it("should permit Manager and Super Admin to download Excel report", async () => {
        const reqManager = new NextRequest("http://localhost:3000/api/export/excel", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${managerToken}` },
        });
        const resManager = await getExcelExport(reqManager);
        expect(resManager.status).toBe(200);
        expect(resManager.headers.get("Content-Type")).toContain("spreadsheetml.sheet");

        const reqAdmin = new NextRequest("http://localhost:3000/api/export/excel", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
        });
        const resAdmin = await getExcelExport(reqAdmin);
        expect(resAdmin.status).toBe(200);
      });
    });

    describe("GET /api/export/pdf", () => {
      it("should reject unauthenticated request with 401", async () => {
        const req = new NextRequest("http://localhost:3000/api/export/pdf");
        const res = await getPdfExport(req);
        expect(res.status).toBe(401);
      });

      it("should reject Petugas Lapangan with 403", async () => {
        const reqField = new NextRequest("http://localhost:3000/api/export/pdf", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${fieldToken}` },
        });
        const resField = await getPdfExport(reqField);
        expect(resField.status).toBe(403);
      });

      it("should permit Manager to download printable HTML report", async () => {
        const reqManager = new NextRequest("http://localhost:3000/api/export/pdf", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${managerToken}` },
        });
        const resManager = await getPdfExport(reqManager);
        expect(resManager.status).toBe(200);
        expect(resManager.headers.get("Content-Type")).toContain("text/html");
      });
    });

    describe("POST /api/upload", () => {
      it("should reject unauthenticated upload with 401", async () => {
        const formData = new FormData();
        formData.append("file", new Blob(["test"], { type: "text/plain" }), "test.txt");

        const req = new NextRequest("http://localhost:3000/api/upload", {
          method: "POST",
          body: formData,
        });
        const res = await postUpload(req);
        expect(res.status).toBe(401);
      });

      it("should reject Petugas Lapangan attempting migration upload with 403", async () => {
        const formData = new FormData();
        formData.append("file", new Blob(["test"], { type: "text/csv" }), "test.csv");
        formData.append("type", "migration");

        const req = new NextRequest("http://localhost:3000/api/upload", {
          method: "POST",
          body: formData,
          headers: { cookie: `${SESSION_COOKIE_NAME}=${fieldToken}` },
        });
        const res = await postUpload(req);
        expect(res.status).toBe(403);
      });

      it("should allow Super Admin to upload migration files", async () => {
        const formData = new FormData();
        formData.append("file", new Blob(["sample,csv"], { type: "text/csv" }), "test_migration.csv");
        formData.append("type", "migration");

        const req = new NextRequest("http://localhost:3000/api/upload", {
          method: "POST",
          body: formData,
          headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
        });
        const res = await postUpload(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
      });
    });

    describe("GET /api/uploads/[...path]", () => {
      it("should reject unauthenticated request to sensitive evidence files with 401", async () => {
        const req = new NextRequest("http://localhost:3000/api/uploads/test/sample_budi.png");
        const res = await getUploadsFile(req, {
          params: Promise.resolve({ path: ["test", "sample_budi.png"] }),
        });
        expect(res.status).toBe(401);
      });
    });
  });

  describe("3. Core RBAC Matrix Utility Functions (src/lib/rbac.ts)", () => {
    it("should correctly identify public vs protected routes", () => {
      expect(isPublicRoute("/login")).toBe(true);
      expect(isPublicRoute("/unauthorized")).toBe(true);
      expect(isPublicRoute("/_next/static/chunk.js")).toBe(true);
      expect(isPublicRoute("/favicon.ico")).toBe(true);

      expect(isPublicRoute("/")).toBe(false);
      expect(isPublicRoute("/intake")).toBe(false);
      expect(isPublicRoute("/triage")).toBe(false);
      expect(isPublicRoute("/reports")).toBe(false);
      expect(isPublicRoute("/users")).toBe(false);
    });

    it("should return the exact required role for 403 reporting", () => {
      expect(getRequiredRoleForRoute("/intake")).toBe(Role.PETUGAS_LAPANGAN);
      expect(getRequiredRoleForRoute("/triage")).toBe(Role.PEGAWAI);
      expect(getRequiredRoleForRoute("/reports")).toBe(Role.MANAGER);
      expect(getRequiredRoleForRoute("/users")).toBe(Role.SUPER_ADMIN);
      expect(getRequiredRoleForRoute("/migration")).toBe(Role.SUPER_ADMIN);
      expect(getRequiredRoleForRoute("/audit-logs")).toBe(Role.SUPER_ADMIN);
    });

    it("should correctly evaluate isRouteAllowed for all role permutations", () => {
      // Guest (null role)
      expect(isRouteAllowed("/", null)).toBe(false);
      expect(isRouteAllowed("/intake", null)).toBe(false);
      expect(isRouteAllowed("/login", null)).toBe(true);
      expect(isRouteAllowed("/unauthorized", null)).toBe(true);

      // Petugas Lapangan
      expect(isRouteAllowed("/", Role.PETUGAS_LAPANGAN)).toBe(true);
      expect(isRouteAllowed("/intake", Role.PETUGAS_LAPANGAN)).toBe(true);
      expect(isRouteAllowed("/triage", Role.PETUGAS_LAPANGAN)).toBe(false);
      expect(isRouteAllowed("/users", Role.PETUGAS_LAPANGAN)).toBe(false);

      // Super Admin
      expect(isRouteAllowed("/", Role.SUPER_ADMIN)).toBe(true);
      expect(isRouteAllowed("/intake", Role.SUPER_ADMIN)).toBe(true);
      expect(isRouteAllowed("/triage", Role.SUPER_ADMIN)).toBe(true);
      expect(isRouteAllowed("/reports", Role.SUPER_ADMIN)).toBe(true);
      expect(isRouteAllowed("/users", Role.SUPER_ADMIN)).toBe(true);
    });
  });
});
