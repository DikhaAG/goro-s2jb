import { exec, spawn } from "child_process";
import { promisify } from "util";
import net from "net";
import os from "os";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export type ServiceType =
  | "POSTGRES"
  | "REDIS"
  | "PYTHON_OCR"
  | "IMPORT_WORKER"
  | "OCR_WORKER"
  | "WEB_SERVER"
  | "CLI_TASK"
  | "OTHER";

export interface ServicePortInfo {
  name: string;
  port: number;
  serviceType: ServiceType;
  status: "UP" | "DOWN" | "DEGRADED";
  latencyMs?: number;
  pid?: number;
  processCommand?: string;
  error?: string;
}

export interface ManagedProcess {
  pid: number;
  ppid: number;
  cpuPercent: number;
  memPercent: number;
  rssKb: number;
  status: string;
  elapsedTime: string;
  command: string;
  serviceType: ServiceType;
  isSafeToKill: boolean;
}

export interface SystemResources {
  cpuCount: number;
  cpuModel: string;
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemBytes: number;
  memUsagePercent: number;
  processUptimeSeconds: number;
  systemUptimeSeconds: number;
  nodeMemory: NodeJS.MemoryUsage;
  platform: string;
  arch: string;
}

export interface TailLogResult {
  fileName: string;
  lines: string[];
  totalLines: number;
  sizeBytes: number;
  lastModified: string;
}

const PROJECT_ROOT = path.resolve(process.cwd());
const LOGS_DIR = path.resolve(PROJECT_ROOT, "logs");

/**
 * Checks TCP socket connectivity to determine latency and reachability of a service port.
 */
export async function checkPortConnectivity(
  port: number,
  host: string = "127.0.0.1",
  timeoutMs: number = 800
): Promise<{ isReachable: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    let resolved = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      if (resolved) return;
      resolved = true;
      const latencyMs = Date.now() - startTime;
      cleanup();
      resolve({ isReachable: true, latencyMs });
    });

    socket.once("timeout", () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ isReachable: false, latencyMs: timeoutMs });
    });

    socket.once("error", () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ isReachable: false, latencyMs: 0 });
    });

    socket.connect(port, host);
  });
}

/**
 * Finds the process PID currently binding a given network port using lsof.
 */
export async function getPidForPort(port: number): Promise<number | null> {
  try {
    const { stdout } = await execAsync(`lsof -ti :${port} -sTCP:LISTEN 2>/dev/null || lsof -ti :${port} 2>/dev/null`);
    const pids = stdout
      .trim()
      .split("\n")
      .map((p) => parseInt(p.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    return pids.length > 0 ? pids[0] : null;
  } catch {
    return null;
  }
}

/**
 * Inspects all 5 core services to determine port binding, connectivity latency, and PID.
 */
export async function detectServicePorts(): Promise<ServicePortInfo[]> {
  const serviceDefs: Array<{ name: string; port: number; serviceType: ServiceType }> = [
    { name: "PostgreSQL Database", port: 5432, serviceType: "POSTGRES" },
    { name: "Redis In-Memory Broker", port: 6379, serviceType: "REDIS" },
    { name: "Python OCR Microservice", port: 8001, serviceType: "PYTHON_OCR" },
    { name: "Next.js Web Application", port: 3000, serviceType: "WEB_SERVER" },
  ];

  const results: ServicePortInfo[] = await Promise.all(
    serviceDefs.map(async (svc) => {
      const conn = await checkPortConnectivity(svc.port);
      const pid = await getPidForPort(svc.port);

      let status: "UP" | "DOWN" | "DEGRADED" = "DOWN";
      if (conn.isReachable) {
        status = conn.latencyMs > 300 ? "DEGRADED" : "UP";
      }

      let processCommand: string | undefined;
      if (pid) {
        try {
          const { stdout } = await execAsync(`ps -p ${pid} -o command= 2>/dev/null`);
          processCommand = stdout.trim() || undefined;
        } catch {
          // ignore error fetching command
        }
      }

      return {
        name: svc.name,
        port: svc.port,
        serviceType: svc.serviceType,
        status,
        latencyMs: conn.isReachable ? conn.latencyMs : undefined,
        pid: pid || undefined,
        processCommand,
      };
    })
  );

  return results;
}

/**
 * Classifies an OS process based on command string into an application ServiceType.
 */
export function classifyServiceType(command: string): { serviceType: ServiceType; isSafeToKill: boolean } {
  const lower = command.toLowerCase();

  if (lower.includes("importworker.ts") || lower.includes("worker:import")) {
    return { serviceType: "IMPORT_WORKER", isSafeToKill: true };
  }
  if (lower.includes("ocrworker.ts") || lower.includes("worker:ocr")) {
    return { serviceType: "OCR_WORKER", isSafeToKill: true };
  }
  if (lower.includes("uvicorn") && lower.includes("main:app")) {
    return { serviceType: "PYTHON_OCR", isSafeToKill: true };
  }
  if (lower.includes("scripts/start-mac.sh") || lower.includes("scripts/start-windows.ps1")) {
    return { serviceType: "CLI_TASK", isSafeToKill: true };
  }
  if (lower.includes("next dev") || lower.includes("next-server") || lower.includes("next start")) {
    // Killing the web server itself through its own API will drop the connection immediately
    return { serviceType: "WEB_SERVER", isSafeToKill: false };
  }
  if (lower.includes("redis-server")) {
    return { serviceType: "REDIS", isSafeToKill: false };
  }
  if (lower.includes("postgres")) {
    return { serviceType: "POSTGRES", isSafeToKill: false };
  }
  if (lower.includes("goro-s2jb")) {
    return { serviceType: "CLI_TASK", isSafeToKill: true };
  }

  return { serviceType: "OTHER", isSafeToKill: false };
}

/**
 * Lists running processes on the host operating system filtered specifically for GORO S2JB ecosystem.
 */
export async function listAppProcesses(): Promise<ManagedProcess[]> {
  try {
    // Format: PID, PPID, %CPU, %MEM, RSS (KB), STAT, ETIME, COMMAND
    const { stdout } = await execAsync("ps -axo pid,ppid,pcpu,pmem,rss,stat,etime,command 2>/dev/null");
    const lines = stdout.trim().split("\n");

    if (lines.length <= 1) return [];

    const processes: ManagedProcess[] = [];
    const currentPid = process.pid;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Extract fixed columns up to command
      const match = line.match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
      if (!match) continue;

      const pid = parseInt(match[1], 10);
      const ppid = parseInt(match[2], 10);
      const cpuPercent = parseFloat(match[3]);
      const memPercent = parseFloat(match[4]);
      const rssKb = parseInt(match[5], 10);
      const status = match[6];
      const elapsedTime = match[7];
      const command = match[8];

      // Whitelist filter: only include processes tied to this project or related services
      const isRelated =
        command.includes("goro-s2jb") ||
        command.includes("importWorker.ts") ||
        command.includes("ocrWorker.ts") ||
        command.includes("worker:import") ||
        command.includes("worker:ocr") ||
        (command.includes("uvicorn") && command.includes("main:app")) ||
        command.includes("redis-server") ||
        command.includes("postgres");

      if (!isRelated) continue;

      const { serviceType, isSafeToKill } = classifyServiceType(command);

      // Current running Node.js process must NEVER be safe to kill from within itself
      const safe = isSafeToKill && pid !== currentPid && pid > 100;

      processes.push({
        pid,
        ppid,
        cpuPercent,
        memPercent,
        rssKb,
        status,
        elapsedTime,
        command,
        serviceType,
        isSafeToKill: safe,
      });
    }

    // Sort by CPU usage descending
    return processes.sort((a, b) => b.cpuPercent - a.cpuPercent);
  } catch (error) {
    console.error("Error executing ps command:", error);
    return [];
  }
}

/**
 * Returns overall hardware and operating system telemetry.
 */
export function getSystemResources(): SystemResources {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 10000) / 100;

  return {
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model || "Unknown CPU",
    totalMemBytes: totalMem,
    freeMemBytes: freeMem,
    usedMemBytes: usedMem,
    memUsagePercent,
    processUptimeSeconds: Math.floor(process.uptime()),
    systemUptimeSeconds: Math.floor(os.uptime()),
    nodeMemory: process.memoryUsage(),
    platform: os.platform(),
    arch: os.arch(),
  };
}

/**
 * Safely reads the last N lines of a log file located within the project's logs/ directory.
 * Includes strict path traversal protection.
 */
export async function tailLogFile(fileName: string, lineCount: number = 100): Promise<TailLogResult> {
  // Path traversal guard
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("Akses tidak sah ke berkas di luar direktori logs/.");
  }

  const sanitized = path.basename(fileName);
  const targetPath = path.resolve(LOGS_DIR, sanitized);

  if (!targetPath.startsWith(LOGS_DIR)) {
    throw new Error("Akses tidak sah ke berkas di luar direktori logs/.");
  }

  if (!fs.existsSync(targetPath)) {
    return {
      fileName: sanitized,
      lines: [`[SISTEM] Berkas log ${sanitized} belum terbentuk atau belum ada entri tercatat.`],
      totalLines: 0,
      sizeBytes: 0,
      lastModified: new Date().toISOString(),
    };
  }

  const stats = fs.statSync(targetPath);
  const maxLines = Math.max(1, Math.min(lineCount, 500));

  try {
    const content = fs.readFileSync(targetPath, "utf-8");
    const allLines = content.split("\n");
    const recentLines = allLines.slice(-maxLines);

    return {
      fileName: sanitized,
      lines: recentLines,
      totalLines: allLines.length,
      sizeBytes: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  } catch (err: any) {
    return {
      fileName: sanitized,
      lines: [`[ERROR] Gagal membaca berkas log: ${err?.message || "Kesalahan I/O"}`],
      totalLines: 0,
      sizeBytes: stats.size,
      lastModified: stats.mtime.toISOString(),
    };
  }
}

/**
 * Terminates a background process safely with whitelist validation and signal selection.
 */
export async function terminateProcess(
  pid: number,
  force: boolean = false
): Promise<{ success: boolean; pid: number; signal: string }> {
  if (pid <= 100) {
    throw new Error("DILARANG KERAS: Tidak dapat menghentikan proses vital sistem operasi (PID <= 100).");
  }

  if (pid === process.pid) {
    throw new Error("DILARANG: Tidak dapat menghentikan proses server web sendiri.");
  }

  const runningProcesses = await listAppProcesses();
  const target = runningProcesses.find((p) => p.pid === pid);

  if (!target) {
    throw new Error(`Proses dengan PID ${pid} tidak ditemukan atau tidak aktif.`);
  }

  if (!target.isSafeToKill) {
    throw new Error(`Proses ${target.serviceType} (PID ${pid}) dilindungi dan tidak diizinkan untuk dihentikan.`);
  }

  const signal = force ? "SIGKILL" : "SIGTERM";

  try {
    process.kill(pid, signal);
    return { success: true, pid, signal };
  } catch (err: any) {
    // If permission issue or process already exited
    if (err.code === "ESRCH") {
      return { success: true, pid, signal: "ALREADY_EXITED" };
    }
    throw new Error(`Gagal mengirim sinyal ${signal} ke PID ${pid}: ${err.message}`);
  }
}

/**
 * Restarts or launches an application worker in background.
 */
export async function restartWorker(
  workerType: "import" | "ocr" | "python"
): Promise<{ success: boolean; message: string; newPid?: number }> {
  const currentProcs = await listAppProcesses();

  // 1. Terminate existing instances
  const targets = currentProcs.filter((p) => {
    if (workerType === "import" && p.serviceType === "IMPORT_WORKER") return true;
    if (workerType === "ocr" && p.serviceType === "OCR_WORKER") return true;
    if (workerType === "python" && p.serviceType === "PYTHON_OCR") return true;
    return false;
  });

  for (const proc of targets) {
    try {
      process.kill(proc.pid, "SIGTERM");
    } catch {
      // ignore if already exited
    }
  }

  // Brief delay to allow sockets to release
  await new Promise((r) => setTimeout(r, 800));

  // 2. Spawn new instance
  fs.mkdirSync(LOGS_DIR, { recursive: true });

  if (workerType === "import") {
    const logFd = fs.openSync(path.join(LOGS_DIR, "worker_import.log"), "a");
    const child = spawn("npm", ["run", "worker:import"], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
    child.unref();
    return {
      success: true,
      message: `Worker Impor berhasil dimulai ulang (PID baru: ${child.pid}).`,
      newPid: child.pid,
    };
  }

  if (workerType === "ocr") {
    const logFd = fs.openSync(path.join(LOGS_DIR, "worker_ocr.log"), "a");
    const child = spawn("npm", ["run", "worker:ocr"], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
    child.unref();
    return {
      success: true,
      message: `Worker OCR berhasil dimulai ulang (PID baru: ${child.pid}).`,
      newPid: child.pid,
    };
  }

  if (workerType === "python") {
    const logFd = fs.openSync(path.join(LOGS_DIR, "ocr_service.log"), "a");
    const ocrDir = path.join(PROJECT_ROOT, "python-services", "ocr");
    let pythonBin = path.join(ocrDir, "venv", "bin", "python");
    if (!fs.existsSync(pythonBin)) {
      pythonBin = "python3";
    }

    const child = spawn(
      pythonBin,
      ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001", "--log-level", "info"],
      {
        cwd: ocrDir,
        detached: true,
        stdio: ["ignore", logFd, logFd],
      }
    );
    child.unref();
    return {
      success: true,
      message: `Microservice Python OCR berhasil dimulai ulang (PID baru: ${child.pid}).`,
      newPid: child.pid,
    };
  }

  throw new Error(`Tipe worker tidak dikenal: ${workerType}`);
}

/**
 * Scans and cleans orphan or hanging background processes matching start-mac.sh or detached workers.
 */
export async function cleanOrphanProcesses(): Promise<{ killedPids: number[]; count: number }> {
  const currentProcs = await listAppProcesses();
  const killedPids: number[] = [];

  for (const proc of currentProcs) {
    // Only kill safe-to-kill CLI tasks or workers with PPID 1 or defunct status
    const isDetachedCli = proc.serviceType === "CLI_TASK" && proc.isSafeToKill;
    const isDefunct = proc.status.includes("Z");

    if (isDetachedCli || isDefunct) {
      try {
        process.kill(proc.pid, "SIGTERM");
        killedPids.push(proc.pid);
      } catch {
        // ignore
      }
    }
  }

  return { killedPids, count: killedPids.length };
}
