import { describe, it, expect, vi, beforeEach } from "vitest";
import { runOcrTrainingPipeline } from "@/server/services/ocrTrainerService";
import { OcrSampleInclusion } from "@prisma/client";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("Subtask 19.2: OCR Trainer Service Unit Test Suite", () => {
  let mockPrisma: any;
  let mockSpawn: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPrisma = {
      ocrTrainingSample: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "s-1",
            imagePath: "uploads/sample1.png",
            groundTruthText: "Ahmad Rizky",
            reviewerName: "Ahmad Rizky",
          },
          {
            id: "s-2",
            imagePath: "uploads/sample2.png",
            groundTruthText: "Budi Santoso",
            reviewerName: "Budi Santoso",
          },
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
      ocrTrainingJob: {
        create: vi.fn().mockResolvedValue({ id: "job-1" }),
        update: vi.fn().mockResolvedValue({ id: "job-1" }),
      },
      ocrModelRegistry: {
        create: vi.fn().mockResolvedValue({ id: "model-1", version: "v1.0.0" }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };

    const { spawn } = await import("child_process");
    mockSpawn = spawn;
  });

  it("should reject training if there are no approved training samples", async () => {
    mockPrisma.ocrTrainingSample.findMany.mockResolvedValueOnce([]);

    await expect(
      runOcrTrainingPipeline(
        {
          epochs: 2,
          targetVersion: "v1.0.0",
          actorId: "usr-1",
        },
        mockPrisma
      )
    ).rejects.toThrow("Tidak ada data latih");
  });

  it("should spawn Python trainer, parse JSON events, and save staging model", async () => {
    // Setup mock child process
    const mockProc: any = {
      stdout: {
        on: vi.fn((event, cb) => {
          if (event === "data") {
            const lines = [
              JSON.stringify({ type: "init", device: "mps", total_samples: 2, epochs: 2 }),
              JSON.stringify({ type: "progress", epoch: 1, total_epochs: 2, loss: 1.25 }),
              JSON.stringify({ type: "metrics", cer: 4.5, wer: 8.2, accuracy: 91.0 }),
              JSON.stringify({
                type: "completed",
                success: true,
                artifact_path: "/tmp/weights.pt",
                metrics: { cer: 4.5, wer: 8.2, accuracy: 91.0 },
                duration_seconds: 5.2,
              }),
            ].join("\n");
            cb(Buffer.from(lines));
          }
        }),
      },
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn((event, cb) => {
        if (event === "close") {
          cb(0);
        }
      }),
    };

    mockSpawn.mockReturnValue(mockProc);

    const onProgress = vi.fn();
    const result = await runOcrTrainingPipeline(
      {
        epochs: 2,
        batchSize: 4,
        targetVersion: "v1.1.0",
        actorId: "usr-admin-1",
        onProgress,
      },
      mockPrisma
    );

    expect(result.success).toBe(true);
    expect(result.metrics?.cer).toBe(4.5);
    expect(mockPrisma.ocrModelRegistry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: "v1.1.0",
        cerScore: 4.5,
        status: "STAGING",
      }),
    });
    expect(mockPrisma.ocrTrainingJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
        }),
      })
    );
  });
});

