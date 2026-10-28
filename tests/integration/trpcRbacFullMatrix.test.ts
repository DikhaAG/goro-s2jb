import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Role } from "@prisma/client";
import { appRouter } from "@/server/routers/_app";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { SessionUser } from "@/types";

describe("Task 12.4: Layer 4 tRPC RBAC Procedure Matrix Verification Suite", () => {
  const mockFieldUser: SessionUser = {
    id: "usr_mock_field_trpc",
    username: "petugas_rivai",
    name: "Ahmad Field",
    role: Role.PETUGAS_LAPANGAN,
    up3Id: "up3_plg",
    ulpId: "ulp_riv",
  };

  const mockOperatorUser: SessionUser = {
    id: "usr_mock_operator_trpc",
    username: "pegawai_operator",
    name: "Budi Triage",
    role: Role.PEGAWAI,
    up3Id: "up3_plg",
    ulpId: null,
  };

  const mockManagerUser: SessionUser = {
    id: "usr_mock_manager_trpc",
    username: "manager_s2jb",
    name: "Hendra Manager",
    role: Role.MANAGER,
    up3Id: null,
    ulpId: null,
  };

  const mockAdminUser: SessionUser = {
    id: "usr_mock_admin_trpc",
    username: "superadmin",
    name: "Super Administrator",
    role: Role.SUPER_ADMIN,
    up3Id: null,
    ulpId: null,
  };

  const makeCaller = (user: SessionUser | null) => {
    return appRouter.createCaller({
      prisma,
      redis,
      user,
      ipAddress: "127.0.0.1",
      userAgent: "Vitest-RBAC-Agent",
    });
  };

  let guestCaller: ReturnType<typeof makeCaller>;
  let fieldCaller: ReturnType<typeof makeCaller>;
  let operatorCaller: ReturnType<typeof makeCaller>;
  let managerCaller: ReturnType<typeof makeCaller>;
  let adminCaller: ReturnType<typeof makeCaller>;

  beforeAll(() => {
    guestCaller = makeCaller(null);
    fieldCaller = makeCaller(mockFieldUser);
    operatorCaller = makeCaller(mockOperatorUser);
    managerCaller = makeCaller(mockManagerUser);
    adminCaller = makeCaller(mockAdminUser);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  describe("1. Field Procedure Guard (fieldProcedure: intake.*)", () => {
    const dummyIntakeInput = {
      up3Id: "up3_plg",
      ulpId: "ulp_riv",
      playstoreReviewerName: "Budi Surveyor",
      entryDate: "2026-10-28",
      appVersionId: "ver_sample",
      evidenceImageBase64: "data:image/jpeg;base64,aGVsbG8=",
      evidenceFilename: "eviden.jpg",
      fieldNotes: "Catatan peninjauan",
    };

    it("should reject unauthenticated guest with UNAUTHORIZED", async () => {
      await expect(guestCaller.intake.submitReview(dummyIntakeInput)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject Pegawai Triase and Manager with FORBIDDEN", async () => {
      await expect(operatorCaller.intake.submitReview(dummyIntakeInput)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      await expect(managerCaller.intake.submitReview(dummyIntakeInput)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("should allow Petugas Lapangan and Super Admin to pass the RBAC procedure guard", async () => {
      // Input with missing fields to test that it passes the RBAC middleware and reaches input validation (BAD_REQUEST)
      const invalidInput: any = {};

      await expect(fieldCaller.intake.submitReview(invalidInput)).rejects.not.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(fieldCaller.intake.submitReview(invalidInput)).rejects.not.toMatchObject({
        code: "UNAUTHORIZED",
      });

      await expect(adminCaller.intake.submitReview(invalidInput)).rejects.not.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(adminCaller.intake.submitReview(invalidInput)).rejects.not.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("2. Operator Procedure Guard (operatorProcedure: triage.*)", () => {
    it("should reject unauthenticated guest with UNAUTHORIZED", async () => {
      await expect(guestCaller.triage.getQueue({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject Petugas Lapangan and Manager with FORBIDDEN", async () => {
      await expect(fieldCaller.triage.getQueue({})).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      await expect(managerCaller.triage.getQueue({})).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("should allow Pegawai Triase and Super Admin to query the triage queue", async () => {
      const operatorRes = await operatorCaller.triage.getQueue({});
      expect(operatorRes).toHaveProperty("items");
      expect(Array.isArray(operatorRes.items)).toBe(true);

      const adminRes = await adminCaller.triage.getQueue({});
      expect(adminRes).toHaveProperty("items");
      expect(Array.isArray(adminRes.items)).toBe(true);
    });
  });

  describe("3. Executive Procedure Guard (executiveProcedure: report.*)", () => {
    it("should reject unauthenticated guest with UNAUTHORIZED", async () => {
      await expect(guestCaller.report.getKpis()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject Petugas Lapangan and Pegawai Triase with FORBIDDEN", async () => {
      await expect(fieldCaller.report.getKpis()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      await expect(operatorCaller.report.getKpis()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("should allow Manager and Super Admin to fetch executive KPIs and daily summaries", async () => {
      const managerRes = await managerCaller.report.getKpis();
      expect(managerRes).toHaveProperty("totalCumulativeRealization");

      const adminRes = await adminCaller.report.getKpis();
      expect(adminRes).toHaveProperty("totalCumulativeRealization");
    });
  });

  describe("4. Administrative & Migration Procedure Guards", () => {
    it("should reject unauthenticated guest with UNAUTHORIZED", async () => {
      await expect(guestCaller.user.listUsers({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      await expect(guestCaller.migration.listBatches()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should strictly reject non-admin callers from user management with FORBIDDEN", async () => {
      const callers = [fieldCaller, operatorCaller, managerCaller];

      for (const caller of callers) {
        await expect(caller.user.listUsers({})).rejects.toMatchObject({
          code: "FORBIDDEN",
        });

        await expect(caller.user.getAuditLogs({})).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      }
    });

    it("should reject Petugas Lapangan and Manager from migration procedures with FORBIDDEN", async () => {
      const nonMigrationCallers = [fieldCaller, managerCaller];

      for (const caller of nonMigrationCallers) {
        await expect(caller.migration.listBatches()).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      }
    });

    it("should permit Pegawai Triase and Super Admin to access migration procedures", async () => {
      const operatorBatchesRes = await operatorCaller.migration.listBatches();
      expect(Array.isArray(operatorBatchesRes)).toBe(true);

      const adminBatchesRes = await adminCaller.migration.listBatches();
      expect(Array.isArray(adminBatchesRes)).toBe(true);
    });

    it("should permit Super Admin to access all administrative user procedures", async () => {
      const usersRes = await adminCaller.user.listUsers({ limit: 5 });
      expect(usersRes).toHaveProperty("users");
      expect(Array.isArray(usersRes.users)).toBe(true);

      const auditLogsRes = await adminCaller.user.getAuditLogs({ limit: 5 });
      expect(auditLogsRes).toHaveProperty("logs");
      expect(Array.isArray(auditLogsRes.logs)).toBe(true);
    });
  });
});
