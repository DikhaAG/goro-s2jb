import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrationRouter } from "@/server/routers/migration";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { Role } from "@prisma/client";

describe("Migration Batch Cancellation & Redis Flag (Task 16 AC-5)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw NOT_FOUND if batch does not exist", async () => {
    vi.spyOn(prisma.migrationBatch, "findUnique").mockResolvedValueOnce(null);

    const caller = migrationRouter.createCaller({
      prisma,
      user: {
        id: "user-1",
        name: "Test User",
        username: "testuser",
        email: "test@pln.co.id",
        role: Role.PEGAWAI,
        up3Id: null,
        ulpId: null,
      },
      req: {} as any,
      res: {} as any,
    } as any);

    await expect(caller.cancelBatch({ batchId: "missing-batch-id" })).rejects.toThrow(
      "Data batch migrasi tidak ditemukan"
    );
  });

  it("should throw FORBIDDEN if caller is another PEGAWAI and not the batch creator", async () => {
    vi.spyOn(prisma.migrationBatch, "findUnique").mockResolvedValueOnce({
      id: "batch-owned-by-user-2",
      uploadedById: "user-2",
      status: "PROCESSING",
    } as any);

    const caller = migrationRouter.createCaller({
      prisma,
      user: {
        id: "user-1", // different user
        name: "Different User",
        username: "diffuser",
        email: "diff@pln.co.id",
        role: Role.PEGAWAI,
        up3Id: null,
        ulpId: null,
      },
      req: {} as any,
      res: {} as any,
    } as any);

    await expect(
      caller.cancelBatch({ batchId: "batch-owned-by-user-2" })
    ).rejects.toThrow("Anda tidak memiliki wewenang");
  });

  it("should cancel successfully and set Redis cancel token when cancelled by owner", async () => {
    vi.spyOn(prisma.migrationBatch, "findUnique").mockResolvedValueOnce({
      id: "batch-user-1",
      uploadedById: "user-1",
      status: "PROCESSING",
    } as any);

    const updateSpy = vi.spyOn(prisma.migrationBatch, "update").mockResolvedValueOnce({
      id: "batch-user-1",
      status: "CANCELLED",
    } as any);

    const redisSetSpy = vi.spyOn(redis, "set").mockResolvedValueOnce("OK" as any);

    const caller = migrationRouter.createCaller({
      prisma,
      user: {
        id: "user-1",
        name: "Owner User",
        username: "owner",
        email: "owner@pln.co.id",
        role: Role.PEGAWAI,
        up3Id: null,
        ulpId: null,
      },
      req: {} as any,
      res: {} as any,
    } as any);

    const result = await caller.cancelBatch({ batchId: "batch-user-1" });

    expect(result.success).toBe(true);
    expect(redisSetSpy).toHaveBeenCalledWith("migration:cancel:batch-user-1", "1", "EX", 3600);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-user-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
        }),
      })
    );
  });

  it("should allow SUPER_ADMIN to cancel any batch regardless of owner", async () => {
    vi.spyOn(prisma.migrationBatch, "findUnique").mockResolvedValueOnce({
      id: "batch-user-2",
      uploadedById: "user-2",
      status: "PROCESSING",
    } as any);

    const updateSpy = vi.spyOn(prisma.migrationBatch, "update").mockResolvedValueOnce({
      id: "batch-user-2",
      status: "CANCELLED",
    } as any);

    vi.spyOn(redis, "set").mockResolvedValueOnce("OK" as any);

    const caller = migrationRouter.createCaller({
      prisma,
      user: {
        id: "admin-root",
        name: "Super Admin",
        username: "adminroot",
        email: "admin@pln.co.id",
        role: Role.SUPER_ADMIN,
        up3Id: null,
        ulpId: null,
      },
      req: {} as any,
      res: {} as any,
    } as any);

    const result = await caller.cancelBatch({ batchId: "batch-user-2" });
    expect(result.success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-user-2" },
        data: expect.objectContaining({
          status: "CANCELLED",
        }),
      })
    );
  });
});
