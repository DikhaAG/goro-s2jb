import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { OcrResultPayload, ValidationStatus } from "@/types";
import { systemTelemetry } from "@/server/services/systemTelemetry";
import {
  AntiFraudCheckResult,
  BatchDuplicateQuery,
  VisionEnginePort,
} from "./types";
import { evaluateLocalDuplicates } from "./classification";

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001";
const HTTP_MAX_ATTEMPTS = 3;
const HTTP_TIMEOUT_MS = 90000;
const BATCH_DUPLICATE_TIMEOUT_MS = 2000;

/**
 * Resolves the native goro-engine binary path across platforms.
 */
export function resolveGoroEngineBinaryPath(): string {
  const isWindows = process.platform === "win32";
  return path.resolve(
    process.cwd(),
    "rust-services",
    "goro-engine",
    "target",
    "release",
    isWindows ? "goro-engine.exe" : "goro-engine"
  );
}

/**
 * Serializes a batch duplicate query into the exact contract expected by goro-engine's BatchDuplicateRequest.
 */
export function buildRustBatchDuplicatePayload(query: BatchDuplicateQuery) {
  return {
    review_id: query.reviewId,
    image_hash: query.imageHash,
    threshold: query.threshold,
    evidence_image_path: query.evidenceImagePath || null,
    extracted_text: query.extractedText || null,
    reviewer_name: query.reviewerName || null,
    candidates: query.candidates.map((c) => ({
      id: c.id,
      evidence_image_hash: c.evidenceImageHash,
      duplicate_of_id: c.duplicateOfId,
      extracted_ocr_text: c.extractedOcrText,
      playstore_reviewer_name: c.playstoreReviewerName,
      evidence_image_path: c.evidenceImagePath,
    })),
  };
}

async function runRustCliFallback(
  imageInput: string | Buffer,
  targetReviewerName: string,
  startTime: number,
  lastHttpError: string
): Promise<OcrResultPayload> {
  const isBuffer = Buffer.isBuffer(imageInput);
  const rustBin = resolveGoroEngineBinaryPath();

  if (!fs.existsSync(rustBin)) {
    await systemTelemetry.record({
      kind: "ocr_bridge",
      transport: "cli",
      outcome: "failure",
      fallbackTriggered: true,
      durationMs: Date.now() - startTime,
    });
    return {
      success: false,
      extracted_text: "",
      phash: "",
      similarity_score: 0,
      zone: "RED",
      recommended_status: ValidationStatus.REJECTED,
      execution_time_ms: Date.now() - startTime,
      error: `Layanan OCR (${OCR_SERVICE_URL}) tidak dapat dihubungi (${lastHttpError || "HTTP error"}) dan runner CLI lokal goro-engine tidak tersedia.`,
    };
  }

  const cliArgs = isBuffer
    ? ["--base64", "-", "--expected-name", targetReviewerName]
    : ["--image", imageInput as string, "--expected-name", targetReviewerName];

  return new Promise((resolve) => {
    const proc = spawn(rustBin, cliArgs, {
      timeout: 30000,
      env: { ...process.env },
    });

    let stdoutData = "";
    let stderrData = "";

    if (isBuffer && proc.stdin) {
      proc.stdin.write((imageInput as Buffer).toString("base64"));
      proc.stdin.end();
    }

    proc.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("error", async (err) => {
      await systemTelemetry.record({
        kind: "ocr_bridge",
        transport: "cli",
        outcome: "failure",
        fallbackTriggered: true,
        durationMs: Date.now() - startTime,
      });
      const errCode = (err as NodeJS.ErrnoException).code;
      const errorMessage =
        errCode === "ENOENT" || err.message.includes("ENOENT")
          ? `Layanan OCR (${OCR_SERVICE_URL}) tidak dapat dihubungi (${lastHttpError || "HTTP error"}) dan runner CLI lokal tidak tersedia.`
          : `Subprocess error: ${err.message}`;

      resolve({
        success: false,
        extracted_text: "",
        phash: "",
        similarity_score: 0,
        zone: "RED",
        recommended_status: ValidationStatus.REJECTED,
        execution_time_ms: Date.now() - startTime,
        error: errorMessage,
      });
    });

    proc.on("close", async (code) => {
      const duration = Date.now() - startTime;
      if (code !== 0) {
        await systemTelemetry.record({
          kind: "ocr_bridge",
          transport: "cli",
          outcome: "failure",
          fallbackTriggered: true,
          durationMs: duration,
        });
        resolve({
          success: false,
          extracted_text: "",
          phash: "",
          similarity_score: 0,
          zone: "RED",
          recommended_status: ValidationStatus.REJECTED,
          execution_time_ms: duration,
          error: stderrData || `Process exited with code ${code}`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdoutData.trim()) as OcrResultPayload;
        const effectiveDuration = parsed.execution_time_ms || duration;
        await systemTelemetry.record({
          kind: "ocr_bridge",
          transport: "cli",
          outcome: "success",
          fallbackTriggered: true,
          durationMs: effectiveDuration,
        });
        resolve({
          ...parsed,
          execution_time_ms: effectiveDuration,
        });
      } catch (parseErr: any) {
        await systemTelemetry.record({
          kind: "ocr_bridge",
          transport: "cli",
          outcome: "failure",
          fallbackTriggered: true,
          durationMs: duration,
        });
        resolve({
          success: false,
          extracted_text: stdoutData,
          phash: "",
          similarity_score: 0,
          zone: "RED",
          recommended_status: ValidationStatus.REJECTED,
          execution_time_ms: duration,
          error: `JSON parse error: ${parseErr.message}. Output: ${stdoutData}`,
        });
      }
    });
  });
}

/**
 * Production adapter for the Rust goro-engine (HTTP microservice with native CLI fallback and offline JS duplicate fallback).
 */
export const rustVisionEngineAdapter: VisionEnginePort = {
  async extractAndMatch(
    imageInput: string | Buffer,
    targetReviewerName: string
  ): Promise<OcrResultPayload> {
    const startTime = Date.now();
    const isBuffer = Buffer.isBuffer(imageInput);

    const serializedPayload = JSON.stringify(
      isBuffer
        ? {
            image_base64: (imageInput as Buffer).toString("base64"),
            target_name: targetReviewerName,
          }
        : {
            image_path: imageInput as string,
            target_name: targetReviewerName,
          }
    );

    let lastHttpError = "";
    for (let attempt = 1; attempt <= HTTP_MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

      try {
        const res = await fetch(`${OCR_SERVICE_URL}/api/v1/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serializedPayload,
          signal: controller.signal,
        });

        if (res.ok) {
          const data = (await res.json()) as OcrResultPayload;
          const duration = data.execution_time_ms || Date.now() - startTime;
          await systemTelemetry.record({
            kind: "ocr_bridge",
            transport: "http",
            outcome: "success",
            durationMs: duration,
          });
          return {
            ...data,
            execution_time_ms: duration,
          };
        }

        lastHttpError = `HTTP ${res.status} ${res.statusText || ""}`.trim();
      } catch (httpErr) {
        lastHttpError = httpErr instanceof Error ? httpErr.message : String(httpErr);
      } finally {
        clearTimeout(timeout);
      }

      if (attempt < HTTP_MAX_ATTEMPTS && !process.env.VITEST) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1500));
      }
    }

    return runRustCliFallback(imageInput, targetReviewerName, startTime, lastHttpError);
  },

  async checkBatchDuplicates(query: BatchDuplicateQuery): Promise<AntiFraudCheckResult> {
    if (!query.imageHash || query.imageHash.length !== 16) {
      return {
        isDuplicate: false,
        duplicateOfId: null,
        minDistance: 64,
        visualSimilarity: 0,
        textSimilarity: 0,
        reviewerSimilarity: 0,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), BATCH_DUPLICATE_TIMEOUT_MS);

      const rustRes = await fetch(`${OCR_SERVICE_URL}/api/v1/batch-duplicate-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRustBatchDuplicatePayload(query)),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (rustRes.ok) {
        const data = await rustRes.json();
        return {
          isDuplicate: Boolean(data.is_duplicate),
          duplicateOfId: data.duplicate_of_id || null,
          minDistance: Number(data.min_distance),
          visualSimilarity: Number(data.visual_similarity),
          textSimilarity: Number(data.text_similarity),
          reviewerSimilarity: Number(data.reviewer_similarity),
          matchReason: data.match_reason || undefined,
        };
      }
    } catch {
      // HTTP microservice unreachable (e.g. CLI-only local mode); fall back to in-process evaluation
    }

    return evaluateLocalDuplicates(query);
  },
};
