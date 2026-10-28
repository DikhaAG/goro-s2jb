import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { OcrResultPayload, ValidationStatus } from "@/types";

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001";

/**
 * Executes Python OCR process via HTTP endpoint if reachable,
 * with seamless fallback to isolated Python child process.
 */
export async function executeOcrBridge(
  imageAbsolutePath: string,
  targetReviewerName: string
): Promise<OcrResultPayload> {
  const startTime = Date.now();

  // 1. Attempt HTTP request to local FastAPI microservice
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${OCR_SERVICE_URL}/api/v1/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_path: imageAbsolutePath,
        target_name: targetReviewerName,
      }),
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
  return new Promise((resolve) => {
    const venvPython = path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3");
    const pythonExecutable = fs.existsSync(venvPython) ? venvPython : "python3";
    const scriptPath = path.resolve(process.cwd(), "python-services/ocr/main.py");

    const proc = spawn(
      pythonExecutable,
      [scriptPath, "--image", imageAbsolutePath, "--expected-name", targetReviewerName],
      {
        timeout: 15000,
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

    proc.on("error", (err) => {
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
