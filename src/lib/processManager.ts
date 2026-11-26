import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import {
  createDefaultHostProbe,
  type HostProbePort,
} from "@/server/services/systemTelemetry";

const execAsync = promisify(exec);

const PROJECT_ROOT = path.resolve(process.cwd());
const LOGS_DIR = path.resolve(PROJECT_ROOT, "logs");

export type WorkerControlTarget = "import" | "ocr" | "rust";

export interface TailLogResult {
  fileName: string;
  lines: string[];
  totalLines: number;
  sizeBytes: number;
  lastModified: string;
}

export interface ProcessControlPort {
  tailLogFile(fileName: string, lineCount?: number): Promise<TailLogResult>;
  terminateProcess(
    pid: number,
    force?: boolean
  ): Promise<{ success: boolean; pid: number; signal: string }>;
  restartWorker(
    workerType: WorkerControlTarget
  ): Promise<{ success: boolean; message: string; newPid?: number }>;
  cleanOrphanProcesses(): Promise<{
    killedPids: number[];
    count: number;
    errors: string[];
  }>;
}

type ProcessInspectionPort = Pick<
  HostProbePort,
  "listAppProcesses" | "isOrphanOrZombieProcess"
>;

/**
 * OS process-control and log-tailing adapter sitting behind ProcessControlPort.
 * Uses HostProbePort solely to enforce PID safety guards before signaling processes.
 */
export function createOsProcessControl(
  hostProbe: ProcessInspectionPort = createDefaultHostProbe()
): ProcessControlPort {
  return {
    async tailLogFile(fileName: string, lineCount: number = 100): Promise<TailLogResult> {
      if (
        !fileName ||
        fileName.includes("..") ||
        fileName.includes("/") ||
        fileName.includes("\\")
      ) {
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
          lines: [
            `[SISTEM] Berkas log ${sanitized} belum terbentuk atau belum ada entri tercatat.`,
          ],
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
    },

    async terminateProcess(
      pid: number,
      force: boolean = false
    ): Promise<{ success: boolean; pid: number; signal: string }> {
      if (pid <= 100) {
        throw new Error(
          "DILARANG KERAS: Tidak dapat menghentikan proses vital sistem operasi (PID <= 100)."
        );
      }

      if (pid === process.pid) {
        throw new Error("DILARANG: Tidak dapat menghentikan proses server web sendiri.");
      }

      if (pid === process.ppid) {
        throw new Error("DILARANG: Tidak dapat menghentikan parent proses server web.");
      }

      const runningProcesses = await hostProbe.listAppProcesses();
      const target = runningProcesses.find((p) => p.pid === pid);

      if (!target) {
        throw new Error(`Proses dengan PID ${pid} tidak ditemukan atau tidak aktif.`);
      }

      if (!target.isSafeToKill) {
        throw new Error(
          `Proses ${target.serviceType} (PID ${pid}) dilindungi dan tidak diizinkan untuk dihentikan.`
        );
      }

      if (process.platform === "win32") {
        try {
          await execAsync(`taskkill /PID ${pid} /T /F`);
          return { success: true, pid, signal: "TASKKILL_F" };
        } catch {
          return { success: true, pid, signal: "ALREADY_EXITED" };
        }
      }

      const signal = force ? "SIGKILL" : "SIGTERM";

      try {
        process.kill(pid, signal);
        return { success: true, pid, signal };
      } catch (err: any) {
        if (err.code === "ESRCH") {
          return { success: true, pid, signal: "ALREADY_EXITED" };
        }
        throw new Error(`Gagal mengirim sinyal ${signal} ke PID ${pid}: ${err.message}`);
      }
    },

    async restartWorker(
      workerType: WorkerControlTarget
    ): Promise<{ success: boolean; message: string; newPid?: number }> {
      const currentProcs = await hostProbe.listAppProcesses();

      const targets = currentProcs.filter((p) => {
        if (workerType === "import" && p.serviceType === "IMPORT_WORKER") return true;
        if (workerType === "ocr" && p.serviceType === "OCR_WORKER") return true;
        if (workerType === "rust" && p.serviceType === "RUST_OCR") return true;
        return false;
      });

      for (const proc of targets) {
        try {
          process.kill(proc.pid, "SIGTERM");
        } catch {
          // ignore if already exited
        }
      }

      await new Promise((r) => setTimeout(r, 800));

      fs.mkdirSync(LOGS_DIR, { recursive: true });
      const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
      const isWindows = process.platform === "win32";

      if (workerType === "import") {
        const logFd = fs.openSync(path.join(LOGS_DIR, "worker_import.log"), "a");
        const child = spawn(npmCmd, ["run", "worker:import"], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: ["ignore", logFd, logFd],
          shell: isWindows,
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
        const child = spawn(npmCmd, ["run", "worker:ocr"], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: ["ignore", logFd, logFd],
          shell: isWindows,
        });
        child.unref();
        return {
          success: true,
          message: `Worker OCR berhasil dimulai ulang (PID baru: ${child.pid}).`,
          newPid: child.pid,
        };
      }

      if (workerType === "rust") {
        const rustBin = path.join(
          PROJECT_ROOT,
          "rust-services",
          "goro-engine",
          "target",
          "release",
          isWindows ? "goro-engine.exe" : "goro-engine"
        );

        if (!fs.existsSync(rustBin)) {
          return {
            success: false,
            message: "Binary Rust Native Vision Engine belum ada. Jalankan `npm run rust:build` terlebih dahulu.",
          };
        }

        const logFd = fs.openSync(path.join(LOGS_DIR, "ocr_service.log"), "a");
        const child = spawn(rustBin, ["--host", "127.0.0.1", "--port", "8001"], {
          cwd: PROJECT_ROOT,
          detached: true,
          stdio: ["ignore", logFd, logFd],
          shell: isWindows,
        });
        child.unref();
        return {
          success: true,
          message: `Rust Native Vision Engine berhasil dimulai ulang (PID baru: ${child.pid}).`,
          newPid: child.pid,
        };
      }

      throw new Error(`Tipe worker tidak dikenal: ${workerType}`);
    },

    async cleanOrphanProcesses(): Promise<{
      killedPids: number[];
      count: number;
      errors: string[];
    }> {
      const currentProcs = await hostProbe.listAppProcesses();
      const killedPids: number[] = [];
      const errors: string[] = [];

      for (const proc of currentProcs) {
        if (proc.pid <= 100 || proc.pid === process.pid || proc.pid === process.ppid) {
          continue;
        }

        if (hostProbe.isOrphanOrZombieProcess(proc)) {
          try {
            if (process.platform === "win32") {
              await execAsync(`taskkill /PID ${proc.pid} /T /F`);
            } else {
              process.kill(proc.pid, "SIGTERM");
            }
            killedPids.push(proc.pid);
          } catch (err: any) {
            if (err.code !== "ESRCH") {
              errors.push(`Gagal menghentikan PID ${proc.pid}: ${err.message}`);
            }
          }
        }
      }

      return { killedPids, count: killedPids.length, errors };
    },
  };
}

export const defaultProcessControl = createOsProcessControl();
