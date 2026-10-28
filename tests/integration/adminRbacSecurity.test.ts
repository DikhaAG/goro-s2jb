import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { proxy as middleware } from "@/proxy";
import { appRouter } from "@/server/routers/_app";
import { Role } from "@prisma/client";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

describe("Task 9: Super Admin Exclusive User Management Security & RBAC Enforcement", () => {
  let fieldToken: string;
  let operatorToken: string;
  let managerToken: string;
  let adminToken: string;

  const mockFieldUser = {
    id: "usr_mock_field_9",
    username: "field_officer_9",
    name: "Petugas Lapangan",
    role: Role.PETUGAS_LAPANGAN,
    up3Id: "up3_1",
    ulpId: "ulp_1",
  };

  const mockOperatorUser = {
    id: "usr_mock_operator_9",
    username: "operator_triage_9",
    name: "Operator Triase",
    role: Role.PEGAWAI,
    up3Id: "up3_1",
    ulpId: null,
  };

  const mockManagerUser = {
    id: "usr_mock_manager_9",
    username: "manager_exec_9",
    name: "Manager UID",
    role: Role.MANAGER,
    up3Id: null,
    ulpId: null,
  };

  const mockAdminUser = {
    id: "usr_mock_admin_9",
    username: "super_admin_9",
    name: "Super Administrator",
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

  describe("Middleware Route Protection for /users", () => {
    it("should redirect unauthenticated guest on /users to login with redirect param", async () => {
      const res = await middleware(createMockRequest("/users"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?redirect=%2Fusers");
    });

    it("should redirect PETUGAS_LAPANGAN on /users to /unauthorized?required=SUPER_ADMIN", async () => {
      const res = await middleware(createMockRequest("/users", fieldToken));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/unauthorized?required=SUPER_ADMIN");
    });

    it("should redirect PEGAWAI on /users to /unauthorized?required=SUPER_ADMIN", async () => {
      const res = await middleware(createMockRequest("/users", operatorToken));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/unauthorized?required=SUPER_ADMIN");
    });

    it("should redirect MANAGER on /users to /unauthorized?required=SUPER_ADMIN", async () => {
      const res = await middleware(createMockRequest("/users", managerToken));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/unauthorized?required=SUPER_ADMIN");
    });

    it("should allow SUPER_ADMIN to access /users without redirection", async () => {
      const res = await middleware(createMockRequest("/users", adminToken));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("tRPC Server Procedure Authorization Guards", () => {
    it("should reject listUsers query when called by PETUGAS_LAPANGAN", async () => {
      const caller = appRouter.createCaller({
        user: mockFieldUser,
        req: {} as any,
        prisma,
        redis,
      });

      await expect(caller.user.listUsers({})).rejects.toThrow("Akses eksklusif Super Admin.");
    });

    it("should reject listUsers query when called by PEGAWAI", async () => {
      const caller = appRouter.createCaller({
        user: mockOperatorUser,
        req: {} as any,
        prisma,
        redis,
      });

      await expect(caller.user.listUsers({})).rejects.toThrow("Akses eksklusif Super Admin.");
    });

    it("should reject listUsers query when called by MANAGER", async () => {
      const caller = appRouter.createCaller({
        user: mockManagerUser,
        req: {} as any,
        prisma,
        redis,
      });

      await expect(caller.user.listUsers({})).rejects.toThrow("Akses eksklusif Super Admin.");
    });

    it("should permit listUsers query when called by SUPER_ADMIN", async () => {
      const caller = appRouter.createCaller({
        user: mockAdminUser,
        req: {} as any,
        prisma,
        redis,
      });

      const result = await caller.user.listUsers({ limit: 5 });
      expect(result).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
    });

    it("should reject createUser mutation when called by non-admin role", async () => {
      const caller = appRouter.createCaller({
        user: mockManagerUser,
        req: {} as any,
        prisma,
        redis,
      });

      await expect(
        caller.user.createUser({
          username: "unauthorized_user",
          name: "Unauthorized User",
          password: "password123",
          role: Role.PETUGAS_LAPANGAN,
          up3Id: "up3_1",
          ulpId: "ulp_1",
        })
      ).rejects.toThrow("Akses eksklusif Super Admin.");
    });

    it("should reject toggleStatus mutation when called by non-admin role", async () => {
      const caller = appRouter.createCaller({
        user: mockOperatorUser,
        req: {} as any,
        prisma,
        redis,
      });

      await expect(
        caller.user.toggleStatus({
          id: "some_user_id",
          isActive: false,
        })
      ).rejects.toThrow("Akses eksklusif Super Admin.");
    });

    it("should reject resetPassword mutation when called by non-admin role", async () => {
      const caller = appRouter.createCaller({
        user: mockFieldUser,
        req: {} as any,
        prisma,
        redis,
      });

      await expect(
        caller.user.resetPassword({
          id: "some_user_id",
        })
      ).rejects.toThrow("Akses eksklusif Super Admin.");
    });
  });
});
