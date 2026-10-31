import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import prisma from "@/lib/prisma";
import {
  OcrSampleInclusion,
  OcrModelStatus,
  OcrTrainingJobStatus,
  PrismaClient,
} from "@prisma/client";

export interface TrainingPipelineOptions {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  targetVersion?: string;
  triggerType?: "MANUAL" | "THRESHOLD" | "SCHEDULED_CRON";
  actorId?: string;
  benchmarkPath?: string;
  onProgress?: (data: { epoch: number; totalEpochs: number; loss: number; elapsedSeconds: number }) => void;
  onLog?: (line: string) => void;
}

export interface TrainingResult {
  success: boolean;
  jobId: string;
  modelRegistryId?: string;
  artifactPath?: string;
  vocabPath?: string;
  metrics?: {
    cer: number;
    wer: number;
    accuracy: number;
    total_evaluated: number;
  };
  durationSeconds?: number;
  error?: string;
}

/**
 * Executes the Python Deep Learning OCR training pipeline.
 */
export async function runOcrTrainingPipeline(
  options: TrainingPipelineOptions = {},
  db: PrismaClient | any = prisma
): Promise<TrainingResult> {
  const epochs = options.epochs || 5;
  const batchSize = options.batchSize || 8;
  const lr = options.learningRate || 0.001;
  const triggerType = options.triggerType || "MANUAL";
  const targetVersion =
    options.targetVersion || `v1.${Date.now().toString().slice(-4)}.0`;

  // 1. Fetch approved training samples
  const samples = await db.ocrTrainingSample.findMany({
    where: { inclusion: OcrSampleInclusion.APPROVED_FOR_TRAIN },
    select: {
      id: true,
      imagePath: true,
      groundTruthText: true,
      reviewerName: true,
    },
    take: 5000,
  });

  if (!samples || samples.length === 0) {
    throw new Error(
      "Tidak ada data latih yang disetujui (APPROVED_FOR_TRAIN) untuk memulai training."
    );
  }

  // 2. Prepare training directories and dataset JSON
  const trainingDir = path.resolve(process.cwd(), "uploads/training");
  const datasetDir = path.join(trainingDir, "datasets");
  const modelDir = path.join(trainingDir, "models", targetVersion);
  fs.mkdirSync(datasetDir, { recursive: true });
  fs.mkdirSync(modelDir, { recursive: true });

  const datasetFilePath = path.join(datasetDir, `dataset_${targetVersion}.json`);
  const formattedSamples = samples.map((s: any) => ({
    image_path: s.imagePath.startsWith("/")
      ? s.imagePath
      : path.resolve(process.cwd(), s.imagePath),
    ground_truth_text: s.groundTruthText,
    reviewer_name: s.reviewerName,
  }));
  fs.writeFileSync(datasetFilePath, JSON.stringify(formattedSamples, null, 2), "utf-8");

  // 3. Create initial OcrTrainingJob record
  const job = await db.ocrTrainingJob.create({
    data: {
      status: OcrTrainingJobStatus.RUNNING,
      triggerType,
      modelTargetVersion: targetVersion,
      datasetSize: samples.length,
      totalEpochs: epochs,
      startedAt: new Date(),
      createdById: options.actorId || null,
      logs: [],
    },
  });

  // 4. Resolve Python executable and script path
  const venvPython = path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3");
  const pythonExecutable = fs.existsSync(venvPython) ? venvPython : "python3";
  const scriptPath = path.resolve(process.cwd(), "python-services/ocr_trainer/trainer.py");

  const cmdArgs = [
    scriptPath,
    "--dataset-json",
    datasetFilePath,
    "--output-dir",
    modelDir,
    "--epochs",
    String(epochs),
    "--batch-size",
    String(batchSize),
    "--lr",
    String(lr),
  ];

  if (options.benchmarkPath && fs.existsSync(options.benchmarkPath)) {
    cmdArgs.push("--benchmark-json", options.benchmarkPath);
  }

  return new Promise<TrainingResult>((resolve, reject) => {
    const proc = spawn(pythonExecutable, cmdArgs, {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });

    const logs: string[] = [];
    let completedPayload: any = null;
    let latestMetrics: any = null;
    let latestLoss: number | null = null;
    let currentEpoch = 0;
    let stderrOutput = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        logs.push(trimmed);
        if (options.onLog) options.onLog(trimmed);

        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === "progress") {
            currentEpoch = parsed.epoch;
            latestLoss = parsed.loss;
            if (options.onProgress) {
              options.onProgress({
                epoch: parsed.epoch,
                totalEpochs: parsed.total_epochs,
                loss: parsed.loss,
                elapsedSeconds: parsed.elapsed_seconds,
              });
            }
          } else if (parsed.type === "metrics") {
            latestMetrics = parsed;
          } else if (parsed.type === "completed") {
            completedPayload = parsed;
          }
        } catch {
          // Plain stdout log
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    proc.on("error", async (err: Error) => {
      await db.ocrTrainingJob.update({
        where: { id: job.id },
        data: {
          status: OcrTrainingJobStatus.FAILED,
          errorMessage: err.message,
          completedAt: new Date(),
          logs,
        },
      });

      reject(new Error(`Gagal menjalankan proses Python: ${err.message}`));
    });

    proc.on("close", async (code: number) => {
      if (code !== 0 || !completedPayload) {
        const errMsg =
          stderrOutput ||
          logs[logs.length - 1] ||
          `Proses trainer berhenti dengan kode keluar ${code}`;

        await db.ocrTrainingJob.update({
          where: { id: job.id },
          data: {
            status: OcrTrainingJobStatus.FAILED,
            errorMessage: errMsg,
            completedAt: new Date(),
            logs,
          },
        });

        resolve({
          success: false,
          jobId: job.id,
          error: errMsg,
        });
        return;
      }

      const metrics = completedPayload.metrics || latestMetrics || {};
      const duration = completedPayload.duration_seconds || 0;

      // 5. Register model in OcrModelRegistry in STAGING status (Option 2: Manual Approval)
      const modelRegistry = await db.ocrModelRegistry.create({
        data: {
          version: targetVersion,
          name: `PLN Mobile CRNN ${targetVersion}`,
          description: `Model hasil training active learning (${samples.length} sampel, ${epochs} epoch).`,
          artifactPath: completedPayload.artifact_path,
          architecture: "CRNN_PYTORCH",
          status: OcrModelStatus.STAGING,
          cerScore: metrics.cer ?? null,
          werScore: metrics.wer ?? null,
          accuracyScore: metrics.accuracy ?? null,
          trainingSamplesCount: samples.length,
          epochsTrained: epochs,
          durationSeconds: Math.round(duration),
          trainedById: options.actorId || null,
          metadata: {
            device: completedPayload.device,
            vocabPath: completedPayload.vocab_path,
            evalMetrics: metrics,
          },
        },
      });

      // 6. Mark job completed and link to model registry
      await db.ocrTrainingJob.update({
        where: { id: job.id },
        data: {
          status: OcrTrainingJobStatus.COMPLETED,
          modelRegistryId: modelRegistry.id,
          currentEpoch: epochs,
          currentLoss: latestLoss,
          completedAt: new Date(),
          durationSeconds: Math.round(duration),
          logs,
        },
      });

      resolve({
        success: true,
        jobId: job.id,
        modelRegistryId: modelRegistry.id,
        artifactPath: completedPayload.artifact_path,
        vocabPath: completedPayload.vocab_path,
        metrics,
        durationSeconds: duration,
      });
    });
  });
}

