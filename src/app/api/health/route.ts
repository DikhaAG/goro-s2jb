import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { ocrQueue } from "@/server/queues/ocrQueue";
import { importQueue } from "@/server/queues/importQueue";
import { BASE_UPLOAD_DIR } from "@/lib/storage";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "@/lib/logger";

const execAsync = promisify(exec);

export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  const services: {
    database: { status: "up" | "down"; latency_ms?: number; error?: string };
    redis: { status: "up" | "down"; latency_ms?: number; error?: string };
    bullmq: {
      status: "up" | "down";
      ocr_waiting?: number;
      ocr_active?: number;
      import_waiting?: number;
      import_active?: number;
      error?: string;
    };
    python_ocr: { status: "up" | "down"; latency_ms?: number; error?: string };
    storage: {
      status: "up" | "down";
      writable: boolean;
      upload_dir: string;
      error?: string;
    };
  } = {
    database: { status: "down" },
    redis: { status: "down" },
    bullmq: { status: "down" },
    python_ocr: { status: "down" },
    storage: { status: "down", writable: false, upload_dir: BASE_UPLOAD_DIR },
  };

  // 1. Check Database (PostgreSQL)
  try {
    const dbStart = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1");
    services.database = {
      status: "up",
      latency_ms: Date.now() - dbStart,
    };
  } catch (err: any) {
    services.database = {
      status: "down",
      error: err.message || "Database connection error",
    };
  }

  // 2. Check Redis
  try {
    const redisStart = Date.now();
    const pingRes = await redis.ping();
    if (pingRes === "PONG") {
      services.redis = {
        status: "up",
        latency_ms: Date.now() - redisStart,
      };
    }
  } catch (err: any) {
    services.redis = {
      status: "down",
      error: err.message || "Redis ping failed",
    };
  }

  // 3. Check BullMQ Job Queues
  try {
    const [ocrCounts, importCounts] = await Promise.all([
      ocrQueue.getJobCounts("waiting", "active", "completed", "failed"),
      importQueue.getJobCounts("waiting", "active"),
    ]);

    services.bullmq = {
      status: "up",
      ocr_waiting: ocrCounts.waiting || 0,
      ocr_active: ocrCounts.active || 0,
      import_waiting: importCounts.waiting || 0,
      import_active: importCounts.active || 0,
    };
  } catch (err: any) {
    services.bullmq = {
      status: "down",
      error: err.message || "Queue connection failed",
    };
  }

  // 4. Check Python OCR Engine
  try {
    const ocrStart = Date.now();
    const venvPaths = [
      path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3"),
      path.resolve(process.cwd(), "python-services/ocr/venv/bin/python"),
      path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python.exe"),
      path.resolve(process.cwd(), "python-services/ocr/venv/Scripts/python"),
    ];
    const foundVenv = venvPaths.find((p) => fs.existsSync(p));
    const pythonExecutable = foundVenv || (process.platform === "win32" ? "python" : "python3");

    await execAsync(`"${pythonExecutable}" -c "import rapidfuzz, PIL; print('OK')"`, {
      timeout: 3000,
    });
    services.python_ocr = {
      status: "up",
      latency_ms: Date.now() - ocrStart,
    };
  } catch (err: any) {
    services.python_ocr = {
      status: "down",
      error: err.message || "Python OCR environment unresponsive",
    };
  }

  // 5. Check Physical Evidence Storage
  try {
    if (!fs.existsSync(BASE_UPLOAD_DIR)) {
      fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });
    }
    fs.accessSync(BASE_UPLOAD_DIR, fs.constants.W_OK);
    services.storage = {
      status: "up",
      writable: true,
      upload_dir: BASE_UPLOAD_DIR,
    };
  } catch (err: any) {
    services.storage = {
      status: "down",
      writable: false,
      upload_dir: BASE_UPLOAD_DIR,
      error: err.message || "Storage directory not writable",
    };
  }

  const isCriticalUp =
    services.database.status === "up" &&
    services.redis.status === "up" &&
    services.storage.status === "up";

  const isDegraded =
    !isCriticalUp ||
    services.bullmq.status !== "up" ||
    services.python_ocr.status !== "up";

  const overallStatus = isCriticalUp && !isDegraded ? "healthy" : "degraded";
  const statusCode = isCriticalUp ? 200 : 503;

  logger.info("Health check executed", {
    module: "HEALTH",
    durationMs: Date.now() - startTime,
    metadata: { overallStatus, services },
  });

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      execution_ms: Date.now() - startTime,
      services,
    },
    { status: statusCode }
  );
}
