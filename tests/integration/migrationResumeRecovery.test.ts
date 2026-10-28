import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { appRouter } from "@/server/routers/_app";
import { TRPCError } from "@trpc/server";
import fs from "fs";
import path from "path";

describe("Resumable Migration Engine & Recovery Procedure Integration (Task 14)", () => {
  let operatorUser: { id: string; username: string; name: string; role: any };
  let fieldUser: { id: string; username: string; name: string; role: any };
  let testCsvPath: string;
  let testBatchId: string;

  beforeAll(async () => {
    // 1. Fetch users
    const pegawai = await prisma.user.findFirst({
      where: { role: "PEGAWAI" },
    });
    const field = await prisma.user.findFirst({
      where: { role: "PETUGAS_LAPANGAN" },
    });

    operatorUser = pegawai!;
    fieldUser = field!;

    // 2. Create test CSV file
    testCsvPath = path.join(process.cwd(), "uploads", "test_recovery_sample.csv");
    const lines = [
      "Column 1,Column 2,Column 3,Column 4,Column 5,Column 6,Column 7,Column 8,Column 9,Column 10,Column 11,Column 12,Column 13",
      "2026-05-15T08:00:00Z,UP3 PALEMBANG,ULP RIVAI,Pengulas 1,2026-05-15,https://drive.google.com/test_1,V5.2.79,Pengulas Asli 1,Pelanggan,Catatan 1,TIDAK,1,Valid",
    ];
    await fs.promises.writeFile(testCsvPath, lines.join("\n"));
  });

  afterAll(async () => {
    if (fs.existsSync(testCsvPath)) {
      await fs.promises.unlink(testCsvPath);
    }
    if (testBatchId) {
      await prisma.migrationBatch.deleteMany({
        where: { id: testBatchId },
      });
    }
  });

  it("should enforce RBAC guard: reject PETUGAS_LAPANGAN with FORBIDDEN (403)", async () => {
    const fieldCaller = appRouter.createCaller({
      prisma,
      redis,
      user: fieldUser,
      req: undefined,
    });

    await expect(
      fieldCaller.migration.getActiveOrInterruptedBatch()
    ).rejects.toThrowError(TRPCError);

    try {
      await fieldCaller.migration.getActiveOrInterruptedBatch();
    } catch (err: any) {
      expect(err.code).toBe("FORBIDDEN");
    }
  });

  it("should record filePath when PEGAWAI operator starts migration", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: operatorUser,
      req: undefined,
    });

    const result = await operatorCaller.migration.startMigration({
      fileName: "test_recovery_sample.csv",
      fileSize: 1024,
      filePath: testCsvPath,
      targetType: "FORM_RESPONSES_RAW",
    });

    expect(result.success).toBe(true);
    expect(result.batchId).toBeDefined();
    testBatchId = result.batchId;

    const dbBatch = await prisma.migrationBatch.findUnique({
      where: { id: testBatchId },
    });

    expect(dbBatch).toBeDefined();
    expect(dbBatch?.filePath).toBe(testCsvPath);
    expect(dbBatch?.status).toBe("PENDING");
  });

  it("should find active or interrupted batch via getActiveOrInterruptedBatch", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: operatorUser,
      req: undefined,
    });

    const active = await operatorCaller.migration.getActiveOrInterruptedBatch();
    expect(active).toBeDefined();
    expect(active?.id).toBe(testBatchId);
  });

  it("should allow pausing an active migration and update status to PAUSED", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: operatorUser,
      req: undefined,
    });

    // Simulate progress
    await prisma.migrationBatch.update({
      where: { id: testBatchId },
      data: {
        processedRows: 100,
        lastProcessedRow: 100,
      },
    });

    const pauseResult = await operatorCaller.migration.pauseMigration({
      batchId: testBatchId,
    });

    expect(pauseResult.success).toBe(true);

    const pausedBatch = await prisma.migrationBatch.findUnique({
      where: { id: testBatchId },
    });
    expect(pausedBatch?.status).toBe("PAUSED");
    expect(pausedBatch?.lastProcessedRow).toBe(100);
  });

  it("should resume paused migration from lastProcessedRow checkpoint", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: operatorUser,
      req: undefined,
    });

    const resumeResult = await operatorCaller.migration.resumeMigration({
      batchId: testBatchId,
    });

    expect(resumeResult.success).toBe(true);
    expect(resumeResult.resumedFromRow).toBe(100);

    const resumedBatch = await prisma.migrationBatch.findUnique({
      where: { id: testBatchId },
    });
    expect(resumedBatch?.status).toBe("PROCESSING");
  });

  it("should cancel batch and mark status as FAILED with cancellation reason", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: operatorUser,
      req: undefined,
    });

    const cancelResult = await operatorCaller.migration.cancelBatch({
      batchId: testBatchId,
    });

    expect(cancelResult.success).toBe(true);

    const cancelledBatch = await prisma.migrationBatch.findUnique({
      where: { id: testBatchId },
    });
    expect(cancelledBatch?.status).toBe("FAILED");
    expect(cancelledBatch?.errorMessage).toBe("Dibatalkan oleh pengguna");
  });
});
