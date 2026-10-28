import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { OcrResultPayload, ValidationStatus } from "@/types";

export async function processEvidenceOcr(
  imageAbsolutePath: string,
  expectedReviewerName: string
): Promise<OcrResultPayload> {
  return new Promise((resolve) => {
    const venvPython = path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3");
    const pythonExecutable = fs.existsSync(venvPython) ? venvPython : "python3";
    const scriptPath = path.resolve(process.cwd(), "python-services/ocr/main.py");

    const startTime = Date.now();

    const proc = spawn(
      pythonExecutable,
      [scriptPath, "--image", imageAbsolutePath, "--expected-name", expectedReviewerName],
      {
        timeout: 20000,
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
        error: `Failed to spawn Python process: ${err.message}`,
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
      } catch (err: any) {
        resolve({
          success: false,
          extracted_text: stdoutData,
          phash: "",
          similarity_score: 0,
          zone: "RED",
          recommended_status: ValidationStatus.REJECTED,
          execution_time_ms: Date.now() - startTime,
          error: `JSON parse error: ${err.message}. Raw output: ${stdoutData}`,
        });
      }
    });
  });
}
