import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { proxy as middleware } from "@/proxy";
import { appRouter } from "@/server/routers/_app";
import { Role } from "@prisma/client";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

describe("Integrated RBAC Matrix & Route Protection (AC-2, AC-3, AC-4)", () => {
  let fieldToken: string;
  let operatorToken: string;
  let managerToken: string;
  let adminToken: string;

  const mockFieldUser = {
    id: "usr_mock_field",
    username: "field_officer",
    name: "Ahmad Lapangan",
    role: Role.PETUGAS_LAPANGAN,
    up3Id: "up3_1",
    ulpId: "ulp_1",
  };

  const mockOperatorUser = {
    id: "usr_mock_operator",
    username: "operator_triage",
    name: "Budi Triase",
    role: Role.PEGAWAI,
    up3Id: "up3_1",
    ulpId: null,
  };

  const mockManagerUser = {
    id: "usr_mock_manager",
    username: "manager_exec",
    name: "Hendra Manager",
    role: Role.MANAGER,
    up3Id: null,
    ulpId: null,
  };

  const mockAdminUser = {
    id: "usr_mock_admin",
    username: "super_admin",
    name: "Administrator",
    role: Role.SUPER_ADMIN,
    up3Id: null,
    ulpId: null,
  };

  beforeAll(async () => {
    fieldToken = await signSessionToken(mockFieldUser);
    operatorToken = await signSessionToken(mockOperatorUser);
    managerToken = await signSessionToken(mockManagerUser);
    adminToken = await signSessionToken(mockAdminUser);
  });

  function createMockRequest(pathname: string, token?: string) {
    const url = `http://localhost:3000${pathname}`;
    const headers = new Headers();
    if (token) {
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
    }
    return new NextRequest(url, { headers });
  }

  describe("Next.js Edge Middleware Route Guards (AC-3)", () => {
    it("should redirect unauthenticated users to /login with redirect query param", async () => {
      const res = await middleware(createMockRequest("/intake"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?redirect=%2Fintake");

      const resReports = await middleware(createMockRequest("/reports"));
      expect(resReports.status).toBe(307);
      expect(resReports.headers.get("location")).toContain("/login?redirect=%2Freports");
    });

    it("should redirect logged-in user on /login to their role-specific dashboard", async () => {
      const res = await middleware(createMockRequest("/login", fieldToken));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/intake");

      const resOperator = await middleware(createMockRequest("/login", operatorToken));
      expect(resOperator.status).toBe(307);
      expect(resOperator.headers.get("location")).toContain("/triage");

      const resManager = await middleware(createMockRequest("/login", managerToken));
      expect(resManager.status).toBe(307);
      expect(resManager.headers.get("location")).toContain("/reports");
    });

    it("should block Petugas Lapangan from accessing /triage or /reports", async () => {
      const triageRes = await middleware(createMockRequest("/triage", fieldToken));
      expect(triageRes.status).toBe(307);
      expect(triageRes.headers.get("location")).toContain("/unauthorized");

      const reportRes = await middleware(createMockRequest("/reports", fieldToken));
      expect(reportRes.status).toBe(307);
      expect(reportRes.headers.get("location")).toContain("/unauthorized");
    });

    it("should block Pegawai Operator from accessing /intake or /reports", async () => {
      const intakeRes = await middleware(createMockRequest("/intake", operatorToken));
      expect(intakeRes.status).toBe(307);
      expect(intakeRes.headers.get("location")).toContain("/unauthorized");

      const reportRes = await middleware(createMockRequest("/reports", operatorToken));
      expect(reportRes.status).toBe(307);
      expect(reportRes.headers.get("location")).toContain("/unauthorized");
    });

    it("should block Manager from accessing /intake, /triage, or /admin", async () => {
      const intakeRes = await middleware(createMockRequest("/intake", managerToken));
      expect(intakeRes.status).toBe(307);
      expect(intakeRes.headers.get("location")).toContain("/unauthorized");

      const adminRes = await middleware(createMockRequest("/users", managerToken));
      expect(adminRes.status).toBe(307);
      expect(adminRes.headers.get("location")).toContain("/unauthorized");
    });

    it("should allow Super Admin to access all modules", async () => {
      const intakeRes = await middleware(createMockRequest("/intake", adminToken));
      expect(intakeRes.status).toBe(200);

      const triageRes = await middleware(createMockRequest("/triage", adminToken));
      expect(triageRes.status).toBe(200);

      const reportRes = await middleware(createMockRequest("/reports", adminToken));
      expect(reportRes.status).toBe(200);

      const adminRes = await middleware(createMockRequest("/users", adminToken));
      expect(adminRes.status).toBe(200);
    });
  });

  describe("tRPC Backend Procedure Guards (AC-4)", () => {
    it("should reject non-admin from user management procedures with FORBIDDEN error", async () => {
      const caller = appRouter.createCaller({
        prisma,
        redis,
        user: mockOperatorUser,
        ipAddress: "127.0.0.1",
        userAgent: "test",
      } as any);

      await expect(caller.user.listUsers({})).rejects.toThrow("Akses eksklusif Super Admin.");
    });

    it("should reject non-executive from report procedures with FORBIDDEN error", async () => {
      const caller = appRouter.createCaller({
        prisma,
        redis,
        user: mockFieldUser,
        ipAddress: "127.0.0.1",
        userAgent: "test",
      } as any);

      await expect(caller.report.getDaily({ date: "2026-03-01" })).rejects.toThrow(
        "Hanya Manager atau Super Admin yang diizinkan."
      );
    });

    it("should reject non-operator from triage procedures with FORBIDDEN error", async () => {
      const caller = appRouter.createCaller({
        prisma,
        redis,
        user: mockManagerUser,
        ipAddress: "127.0.0.1",
        userAgent: "test",
      } as any);

      await expect(caller.triage.getQueue({})).rejects.toThrow(
        "Hanya Pegawai Operator atau Super Admin yang diizinkan."
      );
    });

    it("should reject non-field officer from intake submission with FORBIDDEN error", async () => {
      const caller = appRouter.createCaller({
        prisma,
        redis,
        user: mockOperatorUser,
        ipAddress: "127.0.0.1",
        userAgent: "test",
      } as any);

      await expect(
        caller.intake.submitReview({
          up3Id: "up3_1",
          ulpId: "ulp_1",
          playstoreReviewerName: "Ahmad",
          entryDate: "2026-03-01",
          evidenceImageBase64: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
          appVersionId: "v1",
          originalReviewerName: "Ahmad",
        })
      ).rejects.toThrow("Hanya Petugas Lapangan atau Super Admin yang diizinkan.");
    });

    it("should permit Super Admin to invoke admin procedures successfully", async () => {
      const caller = appRouter.createCaller({
        prisma,
        redis,
        user: mockAdminUser,
        ipAddress: "127.0.0.1",
        userAgent: "test",
      } as any);

      const res = await caller.user.listUsers({ limit: 5 });
      expect(res).toBeDefined();
      expect(res.users).toBeInstanceOf(Array);
    });
  });
});
