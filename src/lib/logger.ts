import fs from "fs";
import path from "path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  module?: string;
  traceId?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
  error?: string;
}

const LOG_DIR = path.join(process.cwd(), "logs");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // Ignore error in serverless or read-only environments
  }
}

function writeToFile(entry: LogEntry) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const logFilePath = path.join(LOG_DIR, `goro-${today}.log`);
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(logFilePath, line, { encoding: "utf8" });
  } catch {
    // Fallback if filesystem write fails
  }
}

function log(
  level: LogLevel,
  message: string,
  extra: {
    module?: string;
    traceId?: string;
    durationMs?: number;
    metadata?: Record<string, any>;
    error?: any;
  } = {}
) {
  const timestamp = new Date().toISOString();
  const entry: LogEntry = {
    level,
    timestamp,
    message,
    module: extra.module || "SYSTEM",
    traceId: extra.traceId,
    durationMs: extra.durationMs,
    metadata: extra.metadata,
    error: extra.error ? (extra.error instanceof Error ? extra.error.stack || extra.error.message : String(extra.error)) : undefined,
  };

  // 1. Write structured JSON to rotating daily log file
  writeToFile(entry);

  // 2. Format console output for stdout / docker logs
  const colorMap = {
    debug: "\x1b[90m", // Gray
    info: "\x1b[36m",  // Cyan
    warn: "\x1b[33m",  // Yellow
    error: "\x1b[31m", // Red
  };
  const reset = "\x1b[0m";
  const modStr = entry.module ? `[\x1b[35m${entry.module}\x1b[0m]` : "";
  const durStr = entry.durationMs !== undefined ? ` \x1b[32m${entry.durationMs}ms\x1b[0m` : "";

  console.log(
    `${colorMap[level]}${level.toUpperCase()}${reset} [${timestamp}] ${modStr} ${message}${durStr}`,
    entry.metadata || "",
    entry.error || ""
  );
}

export const logger = {
  debug: (msg: string, extra?: Parameters<typeof log>[2]) => log("debug", msg, extra),
  info: (msg: string, extra?: Parameters<typeof log>[2]) => log("info", msg, extra),
  warn: (msg: string, extra?: Parameters<typeof log>[2]) => log("warn", msg, extra),
  error: (msg: string, extra?: Parameters<typeof log>[2]) => log("error", msg, extra),
};
