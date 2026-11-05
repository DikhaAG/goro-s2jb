import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { OcrResultPayload, ValidationStatus } from "@/types";

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001";

export interface OcrBridgeMetrics {
  totalRequests: number;
  httpSuccessCount: number;
  cliFallbackCount: number;
  cliSuccessCount: number;
  cliFailureCount: number;
  lastFallbackAt?: string;
  averageExecutionMs: number;
}

let ocrBridgeTotalDurationMs = 0;

let ocrBridgeMetrics: OcrBridgeMetrics = {
  totalRequests: 0,
  httpSuccessCount: 0,
  cliFallbackCount: 0,
  cliSuccessCount: 0,
  cliFailureCount: 0,
  averageExecutionMs: 0,
};

export function getOcrBridgeMetrics(): OcrBridgeMetrics {
  return { ...ocrBridgeMetrics };
}

export function resetOcrBridgeMetrics(): void {
  ocrBridgeTotalDurationMs = 0;
  ocrBridgeMetrics = {
    totalRequests: 0,
    httpSuccessCount: 0,
    cliFallbackCount: 0,
    cliSuccessCount: 0,
    cliFailureCount: 0,
    averageExecutionMs: 0,
  };
}

/**
 * Executes Python OCR process via HTTP endpoint if reachable,
 * with seamless fallback to isolated Python child process.
 * Supports both local physical file paths and in-memory image Buffers (streaming without disk persistence).
 */
export async function executeOcrBridge(
  imageInput: string | Buffer,
  targetReviewerName: string
): Promise<OcrResultPayload> {
  ocrBridgeMetrics.totalRequests++;
  const startTime = Date.now();
  const isBuffer = Buffer.isBuffer(imageInput);

  // 1. Attempt HTTP request to local FastAPI microservice
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const bodyPayload = isBuffer
      ? {
          image_base64: (imageInput as Buffer).toString("base64"),
          target_name: targetReviewerName,
        }
      : {
          image_path: imageInput as string,
          target_name: targetReviewerName,
        };

    const res = await fetch(`${OCR_SERVICE_URL}/api/v1/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as OcrResultPayload;
      const duration = data.execution_time_ms || Date.now() - startTime;
      ocrBridgeMetrics.httpSuccessCount++;
      ocrBridgeTotalDurationMs += duration;
      ocrBridgeMetrics.averageExecutionMs = Math.round(
        ocrBridgeTotalDurationMs / (ocrBridgeMetrics.httpSuccessCount + ocrBridgeMetrics.cliSuccessCount || 1)
      );

      return {
        ...data,
        execution_time_ms: duration,
      };
    }
  } catch (httpErr) {
    // HTTP service unavailable or timed out, gracefully continue to subprocess fallback
    ocrBridgeMetrics.cliFallbackCount++;
    ocrBridgeMetrics.lastFallbackAt = new Date().toISOString();
  }

  // 2. Subprocess fallback execution
  // In-memory buffer streams directly via stdin (--base64 -) for true zero-disk execution
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const rustBin = path.resolve(
      process.cwd(),
      "rust-services",
      "goro-engine",
      "target",
      "release",
      isWindows ? "goro-engine.exe" : "goro-engine"
    );

    let executable: string;
    let cliArgs: string[];

    if (fs.existsSync(rustBin)) {
      executable = rustBin;
      cliArgs = isBuffer
        ? ["--base64", "-", "--expected-name", targetReviewerName]
        : ["--image", imageInput as string, "--expected-name", targetReviewerName];
    } else {
      const venvPaths = [
        path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3"),
        path.resolve(process.cwd(), "python-services/ocr/venv/bin/python"),
        path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python.exe"),
        path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python"),
      ];
      const foundVenv = venvPaths.find((p) => fs.existsSync(p));
      executable = foundVenv || (isWindows ? "python" : "python3");
      const scriptPath = path.resolve(process.cwd(), "python-services/ocr/main.py");

      cliArgs = isBuffer
        ? [scriptPath, "--base64", "-", "--expected-name", targetReviewerName]
        : [scriptPath, "--image", imageInput as string, "--expected-name", targetReviewerName];
    }

    const proc = spawn(
      executable,
      cliArgs,
      {
        timeout: 30000,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
      }
    );

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

    proc.on("error", (err) => {
      ocrBridgeMetrics.cliFailureCount++;
      resolve({
        success: false,
        extracted_text: "",
        phash: "",
        similarity_score: 0,
        zone: "RED",
        recommended_status: ValidationStatus.REJECTED,
        execution_time_ms: Date.now() - startTime,
        error: `Subprocess error: ${err.message}`,
      });
    });

    proc.on("close", (code) => {
      const duration = Date.now() - startTime;
      if (code !== 0) {
        ocrBridgeMetrics.cliFailureCount++;
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
        ocrBridgeMetrics.cliSuccessCount++;
        ocrBridgeTotalDurationMs += duration;
        ocrBridgeMetrics.averageExecutionMs = Math.round(
          ocrBridgeTotalDurationMs / (ocrBridgeMetrics.httpSuccessCount + ocrBridgeMetrics.cliSuccessCount || 1)
        );

        resolve({
          ...parsed,
          execution_time_ms: parsed.execution_time_ms || duration,
        });
      } catch (parseErr: any) {
        ocrBridgeMetrics.cliFailureCount++;
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
