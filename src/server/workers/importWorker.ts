import type { ImportJobData } from "../queues/importQueue";
import {
  migrationBatch,
  type IngestBatchResult,
  type MigrationBatchDeps,
} from "../services/migrationBatch";
import { queueControl, type QueueControl } from "../services/queueControl";

export interface ImportWorkerDeps {
  queueControl?: QueueControl;
  batchDeps?: MigrationBatchDeps;
}

export function createImportWorker(deps: ImportWorkerDeps = {}) {
  const control = deps.queueControl ?? queueControl;

  return control.createWorker<ImportJobData, IngestBatchResult>({
    queue: "import",
    concurrency: 1,
    label: "Import Worker",
    classifyResult: (result) => (result.success ? "completed" : "skipped"),
    processor: async (job) => {
      const { importBatchId, filePath, userId, startRowNumber } = job.data;
      console.log(
        `[Import Worker] Starting batch ${importBatchId} for file ${filePath} (startRow: ${startRowNumber || 0})`
      );

      return migrationBatch.ingest(
        {
          importBatchId,
          filePath,
          userId,
          startRowNumber,
          onProgress: async (progress) => {
            await job.updateProgress(progress);
          },
        },
        {
          ...deps.batchDeps,
          // QueueControl owns worker outcome telemetry so worker-driven runs do not double-record.
          recordTelemetry: async () => {},
        }
      );
    },
  });
}

if (require.main === module) {
  console.log("🚀 Starting standalone GORO S2JB Import Worker...");
  const worker = createImportWorker();

  process.on("uncaughtException", (err) => {
    console.error("[Import Worker] Uncaught Exception:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Import Worker] Unhandled Rejection:", reason);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down Import Worker...");
    await worker.close();
    process.exit(0);
  });
}
