import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Role } from "@prisma/client";
import {
  createMigrationBatch,
  parseExcelOrStandardDate,
  resolveMigrationFilePath,
  streamSpreadsheetRows,
} from "@/server/services/migrationBatch";
import { createReportSyncStamp } from "@/server/services/achievementReport";

function createInMemoryRedis() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
      }
      return count;
    }),
  };
}

function createInMemoryMigrationDb(initialExistingReviews: any[] = []) {
  const batches = new Map<string, any>();
  const errors: any[] = [];
  const reviews: any[] = [...initialExistingReviews];
  let seq = 1;

  const up3s = [
    { id: "up3-plg", name: "UP3 PALEMBANG", code: "UP3_PLG" },
    { id: "up3-oi", name: "UP3 OGAN ILIR", code: "UP3_OI" },
  ];
  const ulps = [
    { id: "ulp-riv", name: "ULP RIVAI", code: "ULP_RIV", up3Id: "up3-plg" },
    { id: "ulp-pb", name: "ULP PANGKALAN BALAI", code: "ULP_PB", up3Id: "up3-plg" },
    { id: "ulp-tm", name: "ULP TUGU MULYO", code: "ULP_TM", up3Id: "up3-oi" },
  ];
  const versions = [{ id: "ver-5279", version: "V5.2.79" }];

  const prismaMock: any = {
    batches,
    errors,
    reviews,
    uP3: { findMany: vi.fn(async () => up3s) },
    uLP: { findMany: vi.fn(async () => ulps) },
    appVersion: { findMany: vi.fn(async () => versions) },
    user: {
      findUnique: vi.fn(async ({ where }: any) =>
        where?.id ? { id: where.id } : null
      ),
    },
    migrationBatch: {
      create: vi.fn(async ({ data }: any) => {
        const id = `batch-${seq++}`;
        const record = {
          id,
          totalRows: 0,
          processedRows: 0,
          failedRows: 0,
          lastProcessedRow: 0,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        batches.set(id, record);
        return record;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => {
        const found = batches.get(where.id) || null;
        if (!found) return null;
        if (include?._count) {
          return {
            ...found,
            _count: {
              errors: errors.filter((e) => e.batchId === found.id).length,
              reviews: reviews.filter((r) => r.migrationBatchId === found.id).length,
            },
          };
        }
        return { ...found };
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        for (const b of batches.values()) {
          if (where.uploadedById && b.uploadedById !== where.uploadedById) continue;
          if (where.status?.in && !where.status.in.includes(b.status)) continue;
          return { ...b };
        }
        return null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return Array.from(batches.values()).filter((b) => {
          if (where?.uploadedById && b.uploadedById !== where.uploadedById) return false;
          if (where?.status && b.status !== where.status) return false;
          return true;
        });
      }),
      count: vi.fn(async ({ where }: any) => {
        return Array.from(batches.values()).filter((b) => {
          if (where?.uploadedById && b.uploadedById !== where.uploadedById) return false;
          if (where?.status && b.status !== where.status) return false;
          return true;
        }).length;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const current = batches.get(where.id);
        if (!current) throw new Error("Batch missing");
        const updated = { ...current, ...data, updatedAt: new Date() };
        batches.set(where.id, updated);
        return updated;
      }),
    },
    migrationErrorLog: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `err-${seq++}`, createdAt: new Date(), ...data };
        errors.push(row);
        return row;
      }),
      createMany: vi.fn(async ({ data }: any) => {
        for (const item of data) {
          errors.push({ id: `err-${seq++}`, createdAt: new Date(), ...item });
        }
        return { count: data.length };
      }),
      findMany: vi.fn(async ({ where }: any) =>
        errors.filter((e) => e.batchId === where.batchId)
      ),
      count: vi.fn(async ({ where }: any) =>
        errors.filter((e) => e.batchId === where.batchId).length
      ),
    },
    ratingReview: {
      findMany: vi.fn(async ({ where }: any) => {
        if (where?.evidenceImagePath?.in) {
          const targets = new Set(where.evidenceImagePath.in);
          return reviews.filter((r) => targets.has(r.evidenceImagePath));
        }
        if (where?.migrationBatchId) {
          return reviews
            .filter((r) => r.migrationBatchId === where.migrationBatchId)
            .map((r) => ({
              ...r,
              up3: up3s.find((u) => u.id === r.up3Id) || { name: "UP3" },
              ulp: ulps.find((u) => u.id === r.ulpId) || { name: "ULP" },
              appVersion: versions.find((v) => v.id === r.appVersionId) || { version: "V5.2.79" },
            }));
        }
        return [];
      }),
      createManyAndReturn: vi.fn(async ({ data }: any) => {
        const created = data.map((item: any) => ({
          id: `rev-${seq++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          verifiedAt: null,
          confidenceScore: null,
          ...item,
        }));
        reviews.push(...created);
        return created;
      }),
      aggregate: vi.fn(async () => ({ _avg: { confidenceScore: 95 } })),
      count: vi.fn(async ({ where }: any) =>
        reviews.filter((r) => {
          if (where?.migrationBatchId && r.migrationBatchId !== where.migrationBatchId) {
            return false;
          }
          if (where?.ocrStatus && typeof where.ocrStatus === "string" && r.ocrStatus !== where.ocrStatus) {
            return false;
          }
          return true;
        }).length
      ),
    },
  };

  return prismaMock;
}

describe("Batch Migrasi (migrationBatch deep module)", () => {
  let tempDir: string;
  let migrationDir: string;

  const pegawaiOwner = { id: "user-pegawai-1", name: "Budi", role: Role.PEGAWAI };
  const otherPegawai = { id: "user-pegawai-2", name: "Sari", role: Role.PEGAWAI };
  const managerUser = { id: "user-manager-1", name: "Hendra", role: Role.MANAGER };
  const adminUser = { id: "user-admin-1", name: "Root", role: Role.SUPER_ADMIN };

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "goro-mig-"));
    migrationDir = path.join(tempDir, "migration");
    await fs.promises.mkdir(migrationDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("enforces path containment within storage root and remaps cross-host /uploads/ mounts", () => {
    const inside = resolveMigrationFilePath("migration/test.csv", tempDir);
    expect(inside.isAllowed).toBe(true);
    expect(inside.safeAbsolutePath).toBe(path.join(tempDir, "migration", "test.csv"));

    const crossHost = resolveMigrationFilePath("/other/host/uploads/migration/test.csv", tempDir);
    expect(crossHost.isAllowed).toBe(true);
    expect(crossHost.safeAbsolutePath).toBe(path.join(tempDir, "migration", "test.csv"));

    const traversal = resolveMigrationFilePath("../../etc/passwd", tempDir);
    expect(traversal.isAllowed).toBe(false);

    const outsideAbs = resolveMigrationFilePath("/etc/passwd", tempDir);
    expect(outsideAbs.isAllowed).toBe(false);
  });

  it("persists spreadsheet uploads inside <baseUploadDir>/migration with RBAC and extension checks", async () => {
    const module = createMigrationBatch({
      prisma: createInMemoryMigrationDb(),
      redis: createInMemoryRedis(),
      baseUploadDir: tempDir,
      importQueue: { add: vi.fn().mockResolvedValue({ id: "job-1" }) },
      audit: vi.fn().mockResolvedValue({}),
    });

    const fieldDenied = await module.storeUpload(
      { id: "field-1", name: "Field", role: Role.PETUGAS_LAPANGAN },
      { fileName: "raw.csv", bytes: Buffer.from("a,b") }
    );
    expect(fieldDenied.ok).toBe(false);
    if (!fieldDenied.ok) expect(fieldDenied.status).toBe(403);

    const badExt = await module.storeUpload(pegawaiOwner, {
      fileName: "payload.exe",
      bytes: Buffer.from("MZ"),
    });
    expect(badExt.ok).toBe(false);
    if (!badExt.ok) expect(badExt.status).toBe(400);

    const stored = await module.storeUpload(pegawaiOwner, {
      fileName: "../../GORO (2026).xlsx",
      bytes: Buffer.from("xlsx-bytes"),
      fileSize: 10,
    });
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      expect(stored.relativePath).toMatch(/^migration\/\d+_[0-9a-f]{12}_GORO__2026_\.xlsx$/);
      expect(stored.filePath).toBe(path.join(tempDir, stored.relativePath));
      expect(fs.readFileSync(stored.filePath).toString()).toBe("xlsx-bytes");
    }
  });

  it("rejects unsupported targetType, outside filePath, and records audit on start", async () => {
    const db = createInMemoryMigrationDb();
    const redisClient = createInMemoryRedis();
    const importQueue = { add: vi.fn().mockResolvedValue({ id: "job-1" }) };
    const audit = vi.fn().mockResolvedValue({});

    const module = createMigrationBatch({
      prisma: db,
      redis: redisClient,
      baseUploadDir: tempDir,
      importQueue,
      audit,
    });

    await expect(
      module.start(pegawaiOwner, {
        filePath: path.join(migrationDir, "data.csv"),
        fileName: "data.csv",
        fileSize: 100,
        targetType: "HISTORICAL_REPORTS",
      })
    ).rejects.toThrow("HISTORICAL_REPORTS belum didukung");

    await expect(
      module.start(pegawaiOwner, {
        filePath: "/etc/passwd",
        fileName: "passwd.csv",
        fileSize: 100,
      })
    ).rejects.toThrow("direktori unggahan resmi");

    const started = await module.start(pegawaiOwner, {
      filePath: path.join(migrationDir, "valid.csv"),
      fileName: "valid.csv",
      fileSize: 512,
    });

    expect(started.success).toBe(true);
    expect(importQueue.add).toHaveBeenCalledWith(
      "process-bulk-import",
      expect.objectContaining({
        importBatchId: started.batchId,
        startRowNumber: 0,
      })
    );
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "START_MIGRATION",
        entityType: "MigrationBatch",
        entityId: started.batchId,
      })
    );
  });

  it("ingests CSV with 13-col normalization, ghost-row exit, malformed isolation, and deduplication", async () => {
    const csvPath = path.join(migrationDir, "sample.csv");
    const csvLines = [
      "Column 1,Column 2,Column 3,Column 4,Column 5,Column 6,Column 7,Column 8,Column 9,Column 10,Column 11,Column 12,Column 13",
      "7/2/2026 11:02:22,UP3 OGAN ILIR,ULP TUGU MULYO,Rudi Tabuci,02/07/2026,https://drive.google.com/open?id=driveIdNew1,V5.2.79,rudi tabuci,Pelanggan,,TIDAK,TRUE,",
      // Intra-batch duplicate (same Drive ID + reviewer, different Drive URL format)
      "7/2/2026 11:05:00,UP3 OGAN ILIR,ULP TUGU MULYO,Rudi Tabuci,02/07/2026,https://drive.google.com/file/d/driveIdNew1/view,V5.2.79,rudi tabuci,Pelanggan,,TIDAK,TRUE,",
      // Inter-batch duplicate against pre-existing DB review
      "7/2/2026 12:00:00,UP3 PALEMBANG,ULP RIVAI,Existing Reviewer,02/07/2026,https://drive.google.com/open?id=existingDriveId,V5.2.79,Existing Reviewer,Pelanggan,,TIDAK,1,",
      // Malformed row (missing UP3 & ULP)
      "7/2/2026 12:30:00,,,Broken Row,02/07/2026,https://drive.google.com/open?id=broken1,V5.2.79,Broken,Pelanggan,,TIDAK,1,",
      // Valid row 2
      "7/2/2026 13:33:40,UP3 PALEMBANG,ULP PANGKALAN BALAI,Eta,02/07/2026,https://drive.google.com/open?id=driveIdNew2,V5.2.79,Eta,Pelanggan,,TIDAK,FALSE,",
    ];
    for (let i = 0; i < 12; i++) {
      csvLines.push(",,,,,,,,,,TIDAK,FALSE,");
    }
    await fs.promises.writeFile(csvPath, csvLines.join("\n"));

    const db = createInMemoryMigrationDb([
      {
        id: "rev-existing",
        evidenceImagePath: "https://drive.google.com/open?id=existingDriveId",
        playstoreReviewerName: "Existing Reviewer",
      },
    ]);
    const redisClient = createInMemoryRedis();
    const enqueueVerification = vi.fn().mockResolvedValue({ enqueuedCount: 2 });
    const recordTelemetry = vi.fn().mockResolvedValue(undefined);
    const importQueue = { add: vi.fn().mockResolvedValue({ id: "job-1" }) };

    const module = createMigrationBatch({
      prisma: db,
      redis: redisClient,
      baseUploadDir: tempDir,
      importQueue,
      enqueueVerification,
      recordTelemetry,
      audit: vi.fn().mockResolvedValue({}),
    });

    const { batchId } = await module.start(pegawaiOwner, {
      filePath: csvPath,
      fileName: "sample.csv",
      fileSize: 2048,
    });

    const result = await module.ingest({
      importBatchId: batchId,
      filePath: csvPath,
      userId: pegawaiOwner.id,
    });

    expect(result.success).toBe(true);
    expect(result.processedRows).toBe(2); // Rudi + Eta
    expect(result.failedRows).toBe(3); // 2 duplicates + 1 malformed (0 ghost rows!)

    const batch = db.batches.get(batchId);
    expect(batch.status).toBe("COMPLETED");
    expect(batch.totalRows).toBe(5);
    expect(enqueueVerification).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ expectedReviewerName: "Rudi Tabuci" }),
        expect.objectContaining({ expectedReviewerName: "Eta" }),
      ]),
      { priority: 2, markQueuedInDb: false }
    );
    expect(await createReportSyncStamp(() => redisClient).lastUpdated()).not.toBeNull();
    expect(recordTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "queue_job", outcome: "completed" })
    );
  });

  it("reads reference XLSX Form Responses 1 through the shared 13-col normalizer", async () => {
    const referenceXlsx = path.resolve(process.cwd(), "docs/GORO S2JB 2026 (Jawaban).xlsx");
    const received: any[] = [];
    const res = await streamSpreadsheetRows(referenceXlsx, {
      ext: ".xlsx",
      sheetName: "Form Responses 1",
      batchSize: 5,
      maxRows: 10,
      onBatch: async (batch) => {
        received.push(...batch);
      },
    });

    expect(res.totalProcessed).toBeGreaterThanOrEqual(10);
    expect(received[0].up3Name).toBe("UP3 OGAN ILIR");
    expect(received[0].ulpName).toBe("ULP TUGU MULYO");
    expect(received[0].playstoreReviewerName).toBe("Rudi Tabuci");
    expect(received[0].validationStatus).toBe("APPROVED");
    expect(received[0].entryDate).toBeInstanceOf(Date);
  });

  it("halts cleanly on PAUSE without overwriting status to CANCELLED, and resumes from checkpoint", async () => {
    const csvPath = path.join(migrationDir, "resumable.csv");
    const lines = [
      "Column 1,Column 2,Column 3,Column 4,Column 5,Column 6,Column 7,Column 8,Column 9,Column 10,Column 11,Column 12,Column 13",
    ];
    for (let i = 1; i <= 4; i++) {
      lines.push(
        `2026-05-15T08:00:00Z,UP3 PALEMBANG,ULP RIVAI,Pengulas ${i},2026-05-15,https://drive.google.com/open?id=img_${i},V5.2.79,Pengulas ${i},Pelanggan,,TIDAK,1,`
      );
    }
    await fs.promises.writeFile(csvPath, lines.join("\n"));

    const db = createInMemoryMigrationDb();
    const redisClient = createInMemoryRedis();
    const importQueue = { add: vi.fn().mockResolvedValue({ id: "job-1" }) };
    const audit = vi.fn().mockResolvedValue({});

    const module = createMigrationBatch({
      prisma: db,
      redis: redisClient,
      baseUploadDir: tempDir,
      importQueue,
      enqueueVerification: vi.fn().mockResolvedValue({ enqueuedCount: 0 }),
      recordTelemetry: vi.fn().mockResolvedValue(undefined),
      audit,
    });

    const { batchId } = await module.start(pegawaiOwner, {
      filePath: csvPath,
      fileName: "resumable.csv",
      fileSize: 500,
    });

    // Pause before ingest finishes -> ingest must preserve PAUSED (not overwrite to CANCELLED)
    await module.pause(pegawaiOwner, batchId);
    const pausedIngest = await module.ingest({
      importBatchId: batchId,
      filePath: csvPath,
      userId: pegawaiOwner.id,
    });

    expect(pausedIngest.paused).toBe(true);
    expect(pausedIngest.cancelled).toBeUndefined();
    expect(db.batches.get(batchId).status).toBe("PAUSED");

    // Simulate checkpoint at row 3 (header=1, rows 2..3 processed) and resume
    await db.migrationBatch.update({
      where: { id: batchId },
      data: { lastProcessedRow: 3, processedRows: 2 },
    });

    const resumed = await module.resume(pegawaiOwner, batchId);
    expect(resumed.resumedFromRow).toBe(3);

    const resumedIngest = await module.ingest({
      importBatchId: batchId,
      filePath: csvPath,
      userId: pegawaiOwner.id,
      startRowNumber: 3,
    });

    expect(resumedIngest.success).toBe(true);
    expect(resumedIngest.processedRows).toBe(4);
    expect(db.batches.get(batchId).status).toBe("COMPLETED");
  });

  it("enforces uniform ownership across operations and provides CSV fallback download", async () => {
    const db = createInMemoryMigrationDb();
    const redisClient = createInMemoryRedis();
    const importQueue = { add: vi.fn().mockResolvedValue({ id: "job-1" }) };
    const module = createMigrationBatch({
      prisma: db,
      redis: redisClient,
      baseUploadDir: tempDir,
      importQueue,
      enqueueVerification: vi.fn().mockResolvedValue({ enqueuedCount: 1 }),
      recordTelemetry: vi.fn().mockResolvedValue(undefined),
      audit: vi.fn().mockResolvedValue({}),
    });

    const csvPath = path.join(migrationDir, "owned.csv");
    await fs.promises.writeFile(
      csvPath,
      "Column 1,Column 2,Column 3,Column 4,Column 5,Column 6,Column 7,Column 8,Column 9,Column 10,Column 11,Column 12,Column 13\n" +
        "2026-05-15T08:00:00Z,UP3 PALEMBANG,ULP RIVAI,Rudi,2026-05-15,https://drive.google.com/open?id=x1,V5.2.79,Rudi,Pelanggan,,TIDAK,1,"
    );

    const { batchId } = await module.start(pegawaiOwner, {
      filePath: csvPath,
      fileName: "owned.csv",
      fileSize: 200,
    });

    await expect(module.pause(otherPegawai, batchId)).rejects.toThrow("wewenang");
    await expect(module.resume(otherPegawai, batchId)).rejects.toThrow("wewenang");
    await expect(module.cancel(otherPegawai, batchId)).rejects.toThrow("wewenang");
    await expect(module.getStatus(otherPegawai, batchId)).rejects.toThrow("akses");
    await expect(module.listErrors(otherPegawai, { batchId })).rejects.toThrow("akses");
    await expect(module.getDetails(otherPegawai, { batchId })).rejects.toThrow("akses");
    await expect(module.download(otherPegawai, batchId)).rejects.toThrow("akses");

    // Owner and SUPER_ADMIN and MANAGER can download physical file
    const diskDownload = await module.download(managerUser, batchId);
    expect(diskDownload.kind).toBe("file");

    // Ingest then remove physical file -> fallback generates UTF-8 BOM CSV
    await module.ingest({ importBatchId: batchId, filePath: csvPath, userId: pegawaiOwner.id });
    await fs.promises.unlink(csvPath);

    const fallbackDownload = await module.download(adminUser, batchId);
    expect(fallbackDownload.kind).toBe("csv_fallback");
    expect(fallbackDownload.buffer.toString("utf-8")).toContain("Nama Pengulas Play Store");
    expect(fallbackDownload.buffer.toString("utf-8")).toContain("Rudi");
  });

  it("parses Indonesian DD/MM/YYYY and Google Form M/D/YYYY timestamps deterministically", () => {
    const d1 = parseExcelOrStandardDate("02/07/2026");
    expect(d1.getFullYear()).toBe(2026);
    expect(d1.getMonth()).toBe(6);
    expect(d1.getDate()).toBe(2);

    const dt = parseExcelOrStandardDate("7/2/2026 11:02:22");
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(6);
    expect(dt.getDate()).toBe(2);
    expect(dt.getHours()).toBe(11);
  });
});
