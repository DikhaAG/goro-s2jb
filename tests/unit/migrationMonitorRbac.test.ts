import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrationRouter } from "@/server/routers/migration";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

describe("Migration Monitor RBAC Isolation & Live Metrics (Task 16 AC-6)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getMonitorBatches RBAC Isolation", () => {
    it("should filter batches by uploadedById when requested by PEGAWAI", async () => {
      const findManySpy = vi.spyOn(prisma.migrationBatch, "findMany").mockResolvedValueOnce([
        {
          id: "batch-pegawai-1",
          fileName: "data_pegawai.csv",
          uploadedById: "pegawai-user-id",
          status: "COMPLETED",
          processedRows: 100,
          failedRows: 0,
        },
      ] as any);

      vi.spyOn(prisma.migrationBatch, "count").mockResolvedValueOnce(1);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "pegawai-user-id",
          name: "Budi Pegawai",
          username: "budi",
          email: "budi@pln.co.id",
          role: Role.PEGAWAI,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const result = await caller.getMonitorBatches({
        page: 1,
        pageSize: 10,
        status: "ALL",
      });

      expect(result.isSuperAdmin).toBe(false);
      expect(result.batches).toHaveLength(1);
      // Strictly verify that uploadedById was injected into the where clause
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            uploadedById: "pegawai-user-id",
          }),
        })
      );
    });

    it("should NOT filter by uploadedById when requested by SUPER_ADMIN", async () => {
      const findManySpy = vi.spyOn(prisma.migrationBatch, "findMany").mockResolvedValueOnce([
        {
          id: "batch-1",
          uploadedById: "user-a",
        },
        {
          id: "batch-2",
          uploadedById: "user-b",
        },
      ] as any);

      vi.spyOn(prisma.migrationBatch, "count").mockResolvedValueOnce(2);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "super-admin-id",
          name: "Admin Utama",
          username: "superadmin",
          email: "admin@pln.co.id",
          role: Role.SUPER_ADMIN,
          up3Id: null,
          ulpId: null,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const result = await caller.getMonitorBatches({
        page: 1,
        pageSize: 10,
        status: "ALL",
      });

      expect(result.isSuperAdmin).toBe(true);
      expect(result.batches).toHaveLength(2);

      // Verify that where clause does NOT contain uploadedById
      const whereArg = findManySpy.mock.calls[0][0]?.where;
      expect(whereArg?.uploadedById).toBeUndefined();
    });

    it("should respect specific status filters such as CANCELLED or COMPLETED", async () => {
      const findManySpy = vi.spyOn(prisma.migrationBatch, "findMany").mockResolvedValueOnce([]);
      vi.spyOn(prisma.migrationBatch, "count").mockResolvedValueOnce(0);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "admin-id",
          role: Role.SUPER_ADMIN,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      await caller.getMonitorBatches({
        page: 1,
        pageSize: 10,
        status: "CANCELLED",
      });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "CANCELLED",
          }),
        })
      );
    });
  });

  describe("getWorkerLiveMetrics", () => {
    it("should return queue counts and database summary metrics", async () => {
      vi.spyOn(prisma.ratingReview, "count").mockResolvedValue(500);

      const caller = migrationRouter.createCaller({
        prisma,
        user: {
          id: "admin-id",
          role: Role.SUPER_ADMIN,
        },
        req: {} as any,
        res: {} as any,
      } as any);

      const metrics = await caller.getWorkerLiveMetrics();

      expect(metrics.isSuperAdmin).toBe(true);
      expect(metrics.databaseMetrics).toBeDefined();
      expect(metrics.importQueue).toBeDefined();
      expect(metrics.ocrQueue).toBeDefined();
      expect(metrics.redisStatus).toBeDefined();
    });
  });
});
