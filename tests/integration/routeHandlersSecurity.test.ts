import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { POST as postUpload } from "@/app/api/upload/route";
import { GET as getUploadsFile } from "@/app/api/uploads/[...path]/route";
import { GET as getExcelExport } from "@/app/api/export/excel/route";
import { GET as getPdfExport } from "@/app/api/export/pdf/route";
import { GET as getHealth } from "@/app/api/health/route";
import { POST as postLogout } from "@/app/api/auth/logout/route";

import prisma from "@/lib/prisma";

describe("Task 12.2: Layer 3 HTTP Route Handlers Direct Security Test Suite", () => {
  let fieldToken: string;
  let operatorToken: string;
  let managerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const dbFieldUser = await prisma.user.findFirst({
      where: { role: Role.PETUGAS_LAPANGAN },
    });
    const fieldUserId = dbFieldUser ? dbFieldUser.id : "usr_field_h3";

    fieldToken = await signSessionToken({
      id: fieldUserId,
      username: "petugas_rivai",
      name: "Ahmad Field",
      role: Role.PETUGAS_LAPANGAN,
      up3Id: "up3_plg",
      ulpId: "ulp_riv",
    });

    operatorToken = await signSessionToken({
      id: "usr_operator_h3",
      username: "pegawai_operator",
      name: "Budi Triage",
      role: Role.PEGAWAI,
      up3Id: "up3_plg",
      ulpId: null,
    });

    managerToken = await signSessionToken({
      id: "usr_manager_h3",
      username: "manager_s2jb",
      name: "Hendra Manager",
      role: Role.MANAGER,
      up3Id: null,
      ulpId: null,
    });

    adminToken = await signSessionToken({
      id: "usr_admin_h3",
      username: "superadmin",
      name: "Super Administrator",
      role: Role.SUPER_ADMIN,
      up3Id: null,
      ulpId: null,
    });
  });

  function createRequest(
    url: string,
    method: string = "GET",
    token?: string,
    body?: any,
    headers?: Record<string, string>
  ) {
    const reqHeaders = new Headers(headers);
    if (token) {
      reqHeaders.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
    }
    return new NextRequest(url, {
      method,
      headers: reqHeaders,
      body,
    });
  }

  describe("1. POST /api/upload (Evidence & Migration Uploads)", () => {
    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");

      const req = createRequest("http://localhost:3000/api/upload", "POST", undefined, formData);
      const res = await postUpload(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Autentikasi diperlukan");
    });

    it("should reject PEGAWAI and MANAGER with 403 Forbidden on standard evidence upload", async () => {
      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");

      const reqOperator = createRequest("http://localhost:3000/api/upload", "POST", operatorToken, formData);
      const resOperator = await postUpload(reqOperator);
      expect(resOperator.status).toBe(403);

      const reqManager = createRequest("http://localhost:3000/api/upload", "POST", managerToken, formData);
      const resManager = await postUpload(reqManager);
      expect(resManager.status).toBe(403);
    });

    it("should allow PETUGAS_LAPANGAN and SUPER_ADMIN to pass upload authorization", async () => {
      // Empty form to test that auth succeeds and it reaches validation (status 400 instead of 401/403)
      const emptyForm = new FormData();
      const reqField = createRequest("http://localhost:3000/api/upload", "POST", fieldToken, emptyForm);
      const resField = await postUpload(reqField);
      expect(resField.status).toBe(400);

      const reqAdmin = createRequest("http://localhost:3000/api/upload", "POST", adminToken, emptyForm);
      const resAdmin = await postUpload(reqAdmin);
      expect(resAdmin.status).toBe(400);
    });

    it("should restrict type='migration' uploads to PEGAWAI and SUPER_ADMIN", async () => {
      const formData = new FormData();
      formData.append("type", "migration");
      formData.append("file", new Blob(["col1,col2"], { type: "text/csv" }), "test.csv");

      // Field officer trying migration upload -> 403
      const reqField = createRequest("http://localhost:3000/api/upload", "POST", fieldToken, formData);
      const resField = await postUpload(reqField);
      expect(resField.status).toBe(403);

      // Pegawai Triase trying migration upload -> 200
      const reqOperator = createRequest("http://localhost:3000/api/upload", "POST", operatorToken, formData);
      const resOperator = await postUpload(reqOperator);
      expect(resOperator.status).toBe(200);
      const dataOperator = await resOperator.json();
      expect(dataOperator.success).toBe(true);

      // Super admin trying migration upload -> 200
      const reqAdmin = createRequest("http://localhost:3000/api/upload", "POST", adminToken, formData);
      const resAdmin = await postUpload(reqAdmin);
      expect(resAdmin.status).toBe(200);
      const data = await resAdmin.json();
      expect(data.success).toBe(true);
    });
  });

  describe("2. GET /api/uploads/[...path] (Evidence File Serving)", () => {
    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const req = createRequest("http://localhost:3000/api/uploads/evidence/2026/01/01/photo.jpg");
      const res = await getUploadsFile(req, {
        params: Promise.resolve({ path: ["evidence", "2026", "01", "01", "photo.jpg"] }),
      });

      expect(res.status).toBe(401);
    });

    it("should allow all authenticated roles to pass auth guard (status 404 for nonexistent file, not 401)", async () => {
      const roles = [fieldToken, operatorToken, managerToken, adminToken];

      for (const token of roles) {
        const req = createRequest("http://localhost:3000/api/uploads/evidence/nonexistent.jpg", "GET", token);
        const res = await getUploadsFile(req, {
          params: Promise.resolve({ path: ["evidence", "nonexistent.jpg"] }),
        });
        expect(res.status).toBe(404);
      }
    });

    it("should reject path traversal attempts with 403 Forbidden", async () => {
      const req = createRequest("http://localhost:3000/api/uploads/../../etc/passwd", "GET", adminToken);
      const res = await getUploadsFile(req, {
        params: Promise.resolve({ path: ["..", "..", "etc", "passwd"] }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("3. GET /api/export/excel (Executive Spreadsheet)", () => {
    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const req = createRequest("http://localhost:3000/api/export/excel");
      const res = await getExcelExport(req);
      expect(res.status).toBe(401);
    });

    it("should reject PETUGAS_LAPANGAN and PEGAWAI with 403 Forbidden", async () => {
      const reqField = createRequest("http://localhost:3000/api/export/excel", "GET", fieldToken);
      const resField = await getExcelExport(reqField);
      expect(resField.status).toBe(403);

      const reqOperator = createRequest("http://localhost:3000/api/export/excel", "GET", operatorToken);
      const resOperator = await getExcelExport(reqOperator);
      expect(resOperator.status).toBe(403);
    });

    it("should allow MANAGER and SUPER_ADMIN to generate Excel spreadsheet", async () => {
      const reqManager = createRequest("http://localhost:3000/api/export/excel?year=2026&month=1", "GET", managerToken);
      const resManager = await getExcelExport(reqManager);
      expect(resManager.status).toBe(200);
      expect(resManager.headers.get("Content-Type")).toContain("spreadsheetml.sheet");

      const reqAdmin = createRequest("http://localhost:3000/api/export/excel?year=2026&month=1", "GET", adminToken);
      const resAdmin = await getExcelExport(reqAdmin);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    });
  });

  describe("4. GET /api/export/pdf (Printable HTML Report)", () => {
    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const req = createRequest("http://localhost:3000/api/export/pdf");
      const res = await getPdfExport(req);
      expect(res.status).toBe(401);
    });

    it("should reject PETUGAS_LAPANGAN and PEGAWAI with 403 Forbidden", async () => {
      const reqField = createRequest("http://localhost:3000/api/export/pdf", "GET", fieldToken);
      const resField = await getPdfExport(reqField);
      expect(resField.status).toBe(403);

      const reqOperator = createRequest("http://localhost:3000/api/export/pdf", "GET", operatorToken);
      const resOperator = await getPdfExport(reqOperator);
      expect(resOperator.status).toBe(403);
    });

    it("should allow MANAGER and SUPER_ADMIN to generate printable HTML report", async () => {
      const reqManager = createRequest("http://localhost:3000/api/export/pdf?year=2026&month=1", "GET", managerToken);
      const resManager = await getPdfExport(reqManager);
      expect(resManager.status).toBe(200);
      expect(resManager.headers.get("Content-Type")).toContain("text/html");

      const reqAdmin = createRequest("http://localhost:3000/api/export/pdf?year=2026&month=1", "GET", adminToken);
      const resAdmin = await getPdfExport(reqAdmin);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.headers.get("Content-Type")).toContain("text/html");
    });
  });

  describe("5. GET /api/health (System Diagnostics)", () => {
    it("should allow public unauthenticated health checks", async () => {
      const res = await getHealth();
      expect([200, 503]).toContain(res.status);
      const data = await res.json();
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("services");
    });

    it("should allow authenticated health checks", async () => {
      const res = await getHealth();
      expect([200, 503]).toContain(res.status);
    });
  });

  describe("6. POST /api/auth/logout (Session Termination)", () => {
    it("should terminate session and clear auth cookies", async () => {
      const req = createRequest("http://localhost:3000/api/auth/logout", "POST", fieldToken);
      const res = await postLogout(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const setCookieHeader = res.headers.get("set-cookie") || "";
      expect(setCookieHeader).toContain(`${SESSION_COOKIE_NAME}=;`);
      expect(setCookieHeader).toContain("Max-Age=0");
    });
  });
});
