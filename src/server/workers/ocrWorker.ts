import { OCR_QUEUE_NAME, type OcrJobData } from "../queues/ocrQueue";
import {
  verifyEvidence,
  type VerifyEvidenceDeps,
  type VerifyEvidenceResult,
} from "../services/evidenceVerification";
import {
  queueControl,
  type QueueControl,
  type WorkerJobContext,
} from "../services/queueControl";

export interface OcrWorkerDeps {
  queueControl?: QueueControl;
  verifyEvidenceDeps?: VerifyEvidenceDeps;
}

export async function processOcrJob(
  job: WorkerJobContext<OcrJobData>,
  verifyDeps?: VerifyEvidenceDeps
): Promise<VerifyEvidenceResult> {
  console.log(`[OCR Worker] Processing job ${job.id} for reviewId: ${job.data.reviewId}`);

  const result = await verifyEvidence(
    {
      reviewId: job.data.reviewId,
      evidenceImagePath: job.data.evidenceImagePath,
      expectedReviewerName: job.data.expectedReviewerName,
      isFinalAttempt: job.isFinalAttempt,
    },
    verifyDeps
  );

  if (!result.success) {
    if (!result.skipped && !result.permanentFailure) {
      throw new Error(result.error || "Verifikasi Eviden gagal diproses");
    }
    return result;
  }

  console.log(
    `[OCR Worker] Successfully processed review ${result.reviewId}: Zone ${result.zone}, Score ${result.score}%, Status: ${result.status}, Dup: ${result.isDuplicate}`
  );

  return result;
}

export function createOcrWorker(
  queueName: string = OCR_QUEUE_NAME,
  deps: OcrWorkerDeps = {}
) {
  const control = deps.queueControl ?? queueControl;

  return control.createWorker<OcrJobData, VerifyEvidenceResult>({
    queue: queueName,
    concurrency: 4,
    label: "OCR Worker",
    classifyResult: (result) => {
      if (result.success) return "completed";
      if (result.permanentFailure && !result.skipped) return "failed";
      return "skipped";
    },
    processor: (job) => processOcrJob(job, deps.verifyEvidenceDeps),
  });
}

if (require.main === module) {
  console.log("🚀 Starting standalone GORO S2JB OCR Worker...");
  const worker = createOcrWorker();

  process.on("uncaughtException", (err) => {
    console.error("[OCR Worker] Uncaught Exception:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[OCR Worker] Unhandled Rejection:", reason);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down OCR Worker...");
    await worker.close();
    process.exit(0);
  });
}
