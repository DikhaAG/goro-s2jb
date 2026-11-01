import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { OcrResultPayload, ValidationStatus } from "@/types";

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001";

/**
 * Executes Python OCR process via HTTP endpoint if reachable,
 * with seamless fallback to isolated Python child process.
 * Supports both local physical file paths and in-memory image Buffers (streaming without disk persistence).
 */
export async function executeOcrBridge(
  imageInput: string | Buffer,
  targetReviewerName: string
): Promise<OcrResultPayload> {
  const startTime = Date.now();
  const isBuffer = Buffer.isBuffer(imageInput);

  // 1. Attempt HTTP request to local FastAPI microservice
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

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
      return {
        ...data,
        execution_time_ms: data.execution_time_ms || Date.now() - startTime,
      };
    }
  } catch (httpErr) {
    // HTTP service unavailable or timed out, gracefully continue to subprocess fallback
  }

  // 2. Subprocess fallback execution
  // If input is an in-memory buffer, write to a transient temporary file in os.tmpdir() that gets deleted immediately
  let tempFilePath: string | null = null;
  let targetPathForSubprocess = "";

  if (isBuffer) {
    tempFilePath = path.join(
      os.tmpdir(),
      `goro_ocr_stream_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
    );
    await fs.promises.writeFile(tempFilePath, imageInput as Buffer);
    targetPathForSubprocess = tempFilePath;
  } else {
    targetPathForSubprocess = imageInput as string;
  }

  const cleanupTemp = async () => {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch {
        // Ignore cleanup error
      }
    }
  };

  return new Promise((resolve) => {
    const venvPaths = [
      path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3"),
      path.resolve(process.cwd(), "python-services/ocr/venv/bin/python"),
      path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python.exe"),
      path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python"),
    ];
    const foundVenv = venvPaths.find((p) => fs.existsSync(p));
    const pythonExecutable = foundVenv || (process.platform === "win32" ? "python" : "python3");
    const scriptPath = path.resolve(process.cwd(), "python-services/ocr/main.py");

    const proc = spawn(
      pythonExecutable,
      [scriptPath, "--image", targetPathForSubprocess, "--expected-name", targetReviewerName],
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

    proc.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on("error", async (err) => {
      await cleanupTemp();
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

    proc.on("close", async (code) => {
      await cleanupTemp();
      if (code !== 0) {
        resolve({
          success: false,
          extracted_text: "",
          phash: "",
          similarity_score: 0,
          zone: "RED",
          recommended_status: ValidationStatus.REJECTED,
          execution_time_ms: Date.now() - startTime,
          error: stderrData || `Process exited with code ${code}`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdoutData.trim()) as OcrResultPayload;
        resolve({
          ...parsed,
          execution_time_ms: parsed.execution_time_ms || Date.now() - startTime,
        });
      } catch (parseErr: any) {
        resolve({
          success: false,
          extracted_text: stdoutData,
          phash: "",
          similarity_score: 0,
          zone: "RED",
          recommended_status: ValidationStatus.REJECTED,
          execution_time_ms: Date.now() - startTime,
          error: `JSON parse error: ${parseErr.message}. Output: ${stdoutData}`,
        });
      }
    });
  });
}
