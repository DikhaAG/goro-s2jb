import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrationRouter } from "@/server/routers/migration";
import prisma from "@/lib/prisma";
import { importQueue } from "@/server/queues/importQueue";
import { Role } from "@prisma/client";

describe("Deep Worker & BullMQ Queue Management Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. getDetailedWorkerStatus Telemetry", () => {
    it("should return complete telemetry covering Redis, Node.js, Database, and Queues", async () => {
      vi.spyOn(prisma.ratingReview, "count").mockResolvedValue(100);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "admin-user",
          name: "Admin User",
          username: "adminuser",
          email: "admin@pln.co.id",
          role: Role.SUPER_ADMIN,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const status = await caller.getDetailedWorkerStatus();

      expect(status.isSuperAdmin).toBe(true);
      expect(status.redis).toBeDefined();
      expect(status.redis.healthy).toBe(true);
      expect(status.node).toBeDefined();
      expect(status.node.heapUsedMb).toBeGreaterThan(0);
      expect(status.database).toBeDefined();
      expect(status.queues.import).toBeDefined();
      expect(status.queues.ocr).toBeDefined();
      expect(typeof status.queues.import.isPaused).toBe("boolean");
      expect(typeof status.queues.ocr.isPaused).toBe("boolean");
    });
  });

  describe("2. RBAC Guard on Queue Lifecycle & Controls", () => {
    it("should reject PEGAWAI operator when attempting to pause queue with FORBIDDEN (403)", async () => {
      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "pegawai-user",
          name: "Pegawai User",
          username: "pegawaiuser",
          email: "pegawai@pln.co.id",
          role: Role.PEGAWAI,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      await expect(caller.pauseQueue({ queueName: "import" })).rejects.toThrow(
        "Hanya Super Admin yang berwenang"
      );
    });

    it("should allow SUPER_ADMIN to pause and resume queue", async () => {
      const pauseSpy = vi.spyOn(importQueue, "pause").mockResolvedValueOnce();
      const resumeSpy = vi.spyOn(importQueue, "resume").mockResolvedValueOnce();

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "admin-user",
          name: "Admin User",
          username: "adminuser",
          email: "admin@pln.co.id",
          role: Role.SUPER_ADMIN,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const pauseRes = await caller.pauseQueue({ queueName: "import" });
      expect(pauseRes.success).toBe(true);
      expect(pauseSpy).toHaveBeenCalled();

      const resumeRes = await caller.resumeQueue({ queueName: "import" });
      expect(resumeRes.success).toBe(true);
      expect(resumeSpy).toHaveBeenCalled();
    });
  });

  describe("3. Job Level Operations (Retry & Remove)", () => {
    it("should throw NOT_FOUND when attempting to retry non-existent job", async () => {
      vi.spyOn(importQueue, "getJob").mockResolvedValueOnce(null as any);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "admin-user",
          name: "Admin User",
          username: "adminuser",
          email: "admin@pln.co.id",
          role: Role.SUPER_ADMIN,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      await expect(
        caller.retryJob({ queueName: "import", jobId: "fake-job-id" })
      ).rejects.toThrow("tidak ditemukan di antrean");
    });

    it("should retry job successfully when job exists", async () => {
      const fakeJob = {
        id: "job-123",
        retry: vi.fn().mockResolvedValueOnce(undefined),
      };
      vi.spyOn(importQueue, "getJob").mockResolvedValueOnce(fakeJob as any);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "admin-user",
          role: Role.SUPER_ADMIN,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const res = await caller.retryJob({ queueName: "import", jobId: "job-123" });
      expect(res.success).toBe(true);
      expect(fakeJob.retry).toHaveBeenCalled();
    });
  });

  describe("4. getBatchErrorLogs Pagination", () => {
    it("should return paginated error logs for specific batch", async () => {
      vi.spyOn(prisma.migrationErrorLog, "findMany").mockResolvedValueOnce([
        {
          id: "err-1",
          batchId: "batch-1",
          rowNumber: 15,
          rawRowData: "2026-05-15,UP3,ULP,Nama,,,",
          errorReason: "ULP tidak terdaftar di sistem master",
          createdAt: new Date(),
        },
      ]);
      vi.spyOn(prisma.migrationErrorLog, "count").mockResolvedValueOnce(1);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "pegawai-user",
          role: Role.PEGAWAI,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const res = await caller.getBatchErrorLogs({
        batchId: "batch-1",
        page: 1,
        pageSize: 10,
      });

      expect(res.total).toBe(1);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].rowNumber).toBe(15);
      expect(res.errors[0].errorReason).toContain("ULP tidak terdaftar");
    });
  });
});
