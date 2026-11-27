import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Role, ValidationStatus } from "@prisma/client";
import {
  createInMemoryQueueAdapter,
  createQueueControl,
  REDACTED_FAILURE_REASON,
  type QueueAuditPayload,
} from "@/server/services/queueControl";
import { createMigrationRouter } from "@/server/routers/migration";
import { createOcrWorker } from "@/server/workers/ocrWorker";
import { createImportWorker } from "@/server/workers/importWorker";
import { createInMemoryVisionEngineAdapter } from "@/server/services/evidenceVerification";
import { IMPORT_QUEUE_NAME } from "@/server/queues/importQueue";
import { OCR_QUEUE_NAME } from "@/server/queues/ocrQueue";
import type { TelemetryEvent } from "@/server/services/systemTelemetry";

const superAdmin = {
  id: "admin-1",
  name: "Super Admin",
  username: "superadmin",
  role: Role.SUPER_ADMIN,
};

const pegawai = {
  id: "pegawai-1",
  name: "Operator Pegawai",
  username: "budi.op",
  role: Role.PEGAWAI,
};

const manager = {
  id: "manager-1",
  name: "Manager PLN",
  username: "manager.pln",
  role: Role.MANAGER,
};

describe("QueueControl deep module (ports & adapters)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Listing, pagination & SUPER_ADMIN redaction", () => {
    it("merges waiting + prioritized counts and redacts internals for non-SUPER_ADMIN callers", async () => {
      const backend = createInMemoryQueueAdapter(() => 1_700_000_000_000);
      backend.seedJob("import", {
        id: "wait-1",
        name: "process-bulk-import",
        status: "waiting",
        data: { filePath: "/srv/uploads/secret.csv", userId: "pegawai-1" },
      });
      backend.seedJob("import", {
        id: "prio-1",
        name: "process-bulk-import",
        status: "prioritized",
        priority: 2,
        data: { filePath: "/srv/uploads/urgent.csv", userId: "admin-1" },
      });
      backend.seedJob("import", {
        id: "fail-1",
        name: "process-bulk-import",
        status: "failed",
        data: { filePath: "/srv/uploads/broken.xlsx", userId: "pegawai-1" },
        progress: 40,
        attemptsMade: 2,
        failedReason: "ENOENT: open '/srv/uploads/broken.xlsx'",
        stacktrace: ["line 1", "line 2", "line 3", "line 4"],
      });

      const control = createQueueControl({ backend, audit: vi.fn(), recordTelemetry: vi.fn() });
      const caller = createMigrationRouter({ queueControl: control }).createCaller({
        prisma: {} as any,
        redis: {} as any,
        user: pegawai as any,
      });

      const waitingList = await caller.getQueueJobs({
        queueName: "import",
        status: "waiting",
        page: 1,
        pageSize: 1,
      });
      expect(waitingList.total).toBe(2);
      expect(waitingList.totalPages).toBe(2);
      expect(waitingList.jobs).toHaveLength(1);
      expect(waitingList.jobs[0].data).toBeNull();

      const failedForManager = await control.listJobs(manager, {
        queueName: "import",
        status: "failed",
      });
      expect(failedForManager.jobs[0]).toMatchObject({
        id: "fail-1",
        progress: 40,
        attemptsMade: 2,
        data: null,
        stacktrace: [],
        failedReason: REDACTED_FAILURE_REASON,
      });

      const failedForAdmin = await control.listJobs(superAdmin, {
        queueName: "import",
        status: "failed",
      });
      expect(failedForAdmin.jobs[0]).toMatchObject({
        id: "fail-1",
        data: { filePath: "/srv/uploads/broken.xlsx", userId: "pegawai-1" },
        failedReason: "ENOENT: open '/srv/uploads/broken.xlsx'",
        stacktrace: ["line 1", "line 2", "line 3"],
      });
    });
  });

  describe("2. RBAC guard, queue mutations & audit logging across all 6 control actions", () => {
    it("rejects non-SUPER_ADMIN callers across all mutating queue procedures without mutating state or auditing", async () => {
      const backend = createInMemoryQueueAdapter();
      backend.seedJob("ocr", { id: "j1", name: "process-ocr", status: "failed", data: {} });
      const auditEvents: QueueAuditPayload[] = [];
      const control = createQueueControl({
        backend,
        audit: async (ev) => {
          auditEvents.push(ev);
        },
        recordTelemetry: vi.fn(),
      });
      const caller = createMigrationRouter({ queueControl: control }).createCaller({
        prisma: {} as any,
        redis: {} as any,
        user: pegawai as any,
      });

      await expect(caller.pauseQueue({ queueName: "ocr" })).rejects.toThrow(
        "Hanya Super Admin yang berwenang menjeda antrean worker sistem."
      );
      await expect(caller.resumeQueue({ queueName: "ocr" })).rejects.toThrow(
        "Hanya Super Admin yang berwenang melanjutkan antrean worker sistem."
      );
      await expect(caller.retryJob({ queueName: "ocr", jobId: "j1" })).rejects.toThrow(
        "Hanya Super Admin yang berwenang mencoba ulang job worker."
      );
      await expect(caller.removeJob({ queueName: "ocr", jobId: "j1" })).rejects.toThrow(
        "Hanya Super Admin yang berwenang menghapus job worker."
      );
      await expect(caller.retryAllFailedJobs({ queueName: "ocr" })).rejects.toThrow(
        "Hanya Super Admin yang berwenang mencoba ulang seluruh job gagal."
      );
      await expect(caller.cleanQueue({ queueName: "ocr", type: "failed" })).rejects.toThrow(
        "Hanya Super Admin yang berwenang membersihkan riwayat antrean."
      );

      expect(await backend.isPaused("ocr")).toBe(false);
      expect(await backend.getJob("ocr", "j1")).not.toBeNull();
      expect(auditEvents).toHaveLength(0);
    });

    it("executes pause, resume, retryJob, removeJob, retryAllFailedJobs, and cleanQueue with audit trail", async () => {
      const backend = createInMemoryQueueAdapter();
      backend.seedJob("ocr", {
        id: "ocr-fail-1",
        name: "process-ocr",
        status: "failed",
        failedReason: "timeout",
        data: { reviewId: "r1" },
      });
      backend.seedJob("ocr", {
        id: "ocr-fail-2",
        name: "process-ocr",
        status: "failed",
        failedReason: "timeout",
        data: { reviewId: "r2" },
      });
      backend.seedJob("ocr", {
        id: "ocr-done-1",
        name: "process-ocr",
        status: "completed",
        data: { reviewId: "r3" },
      });

      const auditEvents: QueueAuditPayload[] = [];
      const control = createQueueControl({
        backend,
        audit: async (ev) => {
          auditEvents.push(ev);
        },
        recordTelemetry: vi.fn(),
      });
      const caller = createMigrationRouter({ queueControl: control }).createCaller({
        prisma: {} as any,
        redis: {} as any,
        user: superAdmin as any,
      });

      await caller.pauseQueue({ queueName: "ocr" });
      expect(await backend.isPaused("ocr")).toBe(true);

      await caller.resumeQueue({ queueName: "ocr" });
      expect(await backend.isPaused("ocr")).toBe(false);

      await expect(caller.retryJob({ queueName: "ocr", jobId: "missing" })).rejects.toThrow(
        "tidak ditemukan di antrean"
      );
      await expect(caller.removeJob({ queueName: "ocr", jobId: "missing" })).rejects.toThrow(
        "tidak ditemukan di antrean"
      );

      const retriedSingle = await caller.retryJob({ queueName: "ocr", jobId: "ocr-fail-1" });
      expect(retriedSingle.success).toBe(true);
      expect((await backend.getJobCounts("ocr")).waiting).toBe(1);

      const retriedBulk = await caller.retryAllFailedJobs({ queueName: "ocr" });
      expect(retriedBulk).toMatchObject({ success: true, retriedCount: 1 });
      expect((await backend.getJobCounts("ocr")).waiting).toBe(2);

      const removed = await caller.removeJob({ queueName: "ocr", jobId: "ocr-fail-1" });
      expect(removed.success).toBe(true);
      expect(await backend.getJob("ocr", "ocr-fail-1")).toBeNull();

      const cleaned = await caller.cleanQueue({ queueName: "ocr", type: "completed" });
      expect(cleaned.success).toBe(true);
      expect((await backend.getJobCounts("ocr")).completed).toBe(0);

      expect(auditEvents.map((e) => e.action)).toEqual([
        "PAUSE_QUEUE",
        "RESUME_QUEUE",
        "RETRY_JOB",
        "RETRY_ALL_FAILED_JOBS",
        "REMOVE_JOB",
        "CLEAN_QUEUE",
      ]);
      expect(auditEvents[0]).toMatchObject({
        userId: "admin-1",
        entityType: "Queue",
        entityId: "ocr",
        metadata: { queueName: "ocr", executor: "superadmin" },
      });
    });
  });

  describe("3. Worker outcome telemetry behind the seam", () => {
    it("records completed, transient-failed, permanent-failed, and skipped OCR outcomes through the seam", async () => {
      let currentMs = 1_700_000_100_000;
      const backend = createInMemoryQueueAdapter(() => currentMs);
      const telemetryEvents: TelemetryEvent[] = [];
      const control = createQueueControl({
        backend,
        audit: vi.fn(),
        recordTelemetry: async (ev) => {
          telemetryEvents.push(ev);
        },
        now: () => {
          currentMs += 150;
          return currentMs;
        },
      });

      let reviewRow: any = {
        id: "rev-1",
        source: "INTAKE",
        validationStatus: ValidationStatus.PENDING,
        verifiedAt: null,
        reviewRemarks: null,
        entryDate: new Date("2026-11-27"),
        evidenceImagePath: "https://drive.google.com/open?id=abc",
        playstoreReviewerName: "Budi",
      };

      const fakePrisma = {
        ratingReview: {
          findUnique: vi.fn(async ({ where }: any) => (where.id === "rev-missing" ? null : reviewRow)),
          findMany: vi.fn(async () => []),
          update: vi.fn(async ({ data }: any) => {
            reviewRow = { ...reviewRow, ...data };
            return reviewRow;
          }),
        },
      };

      let mode: "ok" | "transient" | "permanent" = "ok";
      const worker = createOcrWorker(OCR_QUEUE_NAME, {
        queueControl: control,
        verifyEvidenceDeps: {
          prismaClient: fakePrisma,
          visionEngine: createInMemoryVisionEngineAdapter({
            ocrResult: async () => {
              if (mode === "transient") {
                return {
                  success: false,
                  extracted_text: "",
                  phash: "",
                  similarity_score: 0,
                  zone: "RED",
                  recommended_status: ValidationStatus.REJECTED,
                  execution_time_ms: 10,
                  error: "HTTP 503 Service Unavailable",
                };
              }
              return {
                success: true,
                extracted_text: "Budi",
                phash: "1010101010101010",
                similarity_score: 96,
                zone: "GREEN",
                recommended_status: ValidationStatus.APPROVED,
                execution_time_ms: 20,
              };
            },
          }),
          streamExternalEvidence: async () => {
            if (mode === "permanent") {
              return { success: false, error: "404 Not Found" };
            }
            return { success: true, buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) };
          },
          onReportApproved: async () => {},
        },
      });

      // 1) Completed job -> records completed with durationMs
      await backend.addJob("ocr", "process-ocr", {
        reviewId: "rev-1",
        evidenceImagePath: "https://drive.google.com/open?id=abc",
        expectedReviewerName: "Budi",
      });
      await backend.drain("ocr");

      // 2) Transient failure (attempt 1 of 3) -> throws so worker.on("failed") records failed once and job stays queued
      mode = "transient";
      const transientJob = await backend.addJob(
        "ocr",
        "process-ocr",
        {
          reviewId: "rev-1",
          evidenceImagePath: "https://drive.google.com/open?id=abc",
          expectedReviewerName: "Budi",
        },
        { attempts: 3 }
      );
      await backend.drain("ocr", { maxJobs: 1 });
      expect((await backend.getJobCounts("ocr")).waiting).toBe(1);
      await transientJob.remove();

      // 3) Permanent local-file failure -> returns permanentFailure without throwing, records failed once
      mode = "ok";
      await backend.addJob(
        "ocr",
        "process-ocr",
        {
          reviewId: "rev-1",
          evidenceImagePath: "evidence/nonexistent-proof.jpg",
          expectedReviewerName: "Budi",
        },
        { attempts: 1 }
      );
      await backend.drain("ocr");

      // 4) Missing review (skipped) -> records neither completed nor failed
      await backend.addJob("ocr", "process-ocr", {
        reviewId: "rev-missing",
        evidenceImagePath: "https://drive.google.com/open?id=abc",
        expectedReviewerName: "Budi",
      });
      await backend.drain("ocr");

      await worker.close();

      expect(telemetryEvents).toEqual([
        {
          kind: "queue_job",
          queue: OCR_QUEUE_NAME,
          outcome: "completed",
          durationMs: 150,
        },
        {
          kind: "queue_job",
          queue: OCR_QUEUE_NAME,
          outcome: "failed",
        },
        {
          kind: "queue_job",
          queue: OCR_QUEUE_NAME,
          outcome: "failed",
        },
      ]);
    });

    it("records import worker outcome telemetry exactly once per run and skips paused/cancelled runs", async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "goro-import-worker-"));
      try {
        const csvPath = path.join(tempDir, "sample.csv");
        await fs.promises.writeFile(
          csvPath,
          "Column 1,Column 2,Column 3,Column 4,Column 5,Column 6,Column 7,Column 8,Column 9,Column 10,Column 11,Column 12,Column 13\n" +
            "2026-05-15T08:00:00Z,UP3 PALEMBANG,ULP RIVAI,Rudi,2026-05-15,https://drive.google.com/open?id=x1,V5.2.79,Rudi,Pelanggan,,TIDAK,1,"
        );
        const badExtPath = path.join(tempDir, "unsupported.txt");
        await fs.promises.writeFile(badExtPath, "not a spreadsheet");

        let nowMs = 1_700_000_200_000;
        const backend = createInMemoryQueueAdapter(() => nowMs);
        const telemetryEvents: TelemetryEvent[] = [];
        const control = createQueueControl({
          backend,
          audit: vi.fn(),
          recordTelemetry: async (ev) => {
            telemetryEvents.push(ev);
          },
          now: () => {
            nowMs += 200;
            return nowMs;
          },
        });

        const batches = new Map<string, any>([
          [
            "batch-ok",
            {
              id: "batch-ok",
              fileName: "sample.csv",
              filePath: csvPath,
              status: "PENDING",
              lastProcessedRow: 0,
              processedRows: 0,
              failedRows: 0,
            },
          ],
          [
            "batch-paused",
            {
              id: "batch-paused",
              fileName: "sample.csv",
              filePath: csvPath,
              status: "PENDING",
              lastProcessedRow: 0,
              processedRows: 0,
              failedRows: 0,
            },
          ],
          [
            "batch-throw",
            {
              id: "batch-throw",
              fileName: "unsupported.txt",
              filePath: badExtPath,
              status: "PENDING",
              lastProcessedRow: 0,
              processedRows: 0,
              failedRows: 0,
            },
          ],
        ]);

        const fakeRedis = {
          get: vi.fn(async (key: string) => (key === "migration:pause:batch-paused" ? "1" : null)),
          set: vi.fn(async () => "OK"),
          del: vi.fn(async () => 1),
        };

        const fakePrisma: any = {
          uP3: { findMany: vi.fn(async () => [{ id: "up3-1", name: "UP3 PALEMBANG", code: "UP3" }]) },
          uLP: {
            findMany: vi.fn(async () => [
              { id: "ulp-1", name: "ULP RIVAI", code: "ULP", up3Id: "up3-1" },
            ]),
          },
          appVersion: { findMany: vi.fn(async () => [{ id: "v-1", version: "V5.2.79" }]) },
          user: { findUnique: vi.fn(async () => ({ id: "user-1" })) },
          migrationBatch: {
            findUnique: vi.fn(async ({ where }: any) => batches.get(where.id) ?? null),
            update: vi.fn(async ({ where, data }: any) => {
              const updated = { ...batches.get(where.id), ...data };
              batches.set(where.id, updated);
              return updated;
            }),
          },
          ratingReview: {
            findMany: vi.fn(async () => []),
            createManyAndReturn: vi.fn(async ({ data }: any) =>
              data.map((d: any, idx: number) => ({ id: `rev-${idx}`, ...d }))
            ),
          },
          migrationErrorLog: { create: vi.fn() },
        };

        const worker = createImportWorker({
          queueControl: control,
          batchDeps: {
            prisma: fakePrisma,
            redis: fakeRedis,
            baseUploadDir: tempDir,
            enqueueVerification: vi.fn().mockResolvedValue({ enqueuedCount: 1 }),
          },
        });

        await backend.addJob("import", "process-bulk-import", {
          importBatchId: "batch-ok",
          filePath: csvPath,
          userId: "user-1",
        });
        await backend.addJob("import", "process-bulk-import", {
          importBatchId: "batch-paused",
          filePath: csvPath,
          userId: "user-1",
        });
        await backend.addJob("import", "process-bulk-import", {
          importBatchId: "batch-throw",
          filePath: badExtPath,
          userId: "user-1",
        });

        await backend.drain("import");
        await worker.close();

        expect(telemetryEvents).toEqual([
          {
            kind: "queue_job",
            queue: IMPORT_QUEUE_NAME,
            outcome: "completed",
            durationMs: 200,
          },
          {
            kind: "queue_job",
            queue: IMPORT_QUEUE_NAME,
            outcome: "failed",
          },
        ]);
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
