import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  classifyServiceType,
  getSystemResources,
  tailLogFile,
  terminateProcess,
  checkPortConnectivity,
  resolveServiceEndpoint,
  detectServicePorts,
  resetPortLatencyHistory,
} from "@/lib/processManager";
import fs from "fs";
import net from "net";
import path from "path";

describe("processManager Utility Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetPortLatencyHistory();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("1. classifyServiceType & Safety Whitelist", () => {
    it("should classify import worker as safe to kill", () => {
      const res = classifyServiceType("tsx watch src/server/workers/importWorker.ts");
      expect(res.serviceType).toBe("IMPORT_WORKER");
      expect(res.isSafeToKill).toBe(true);
    });

    it("should classify ocr worker as safe to kill", () => {
      const res = classifyServiceType("npm run worker:ocr");
      expect(res.serviceType).toBe("OCR_WORKER");
      expect(res.isSafeToKill).toBe(true);
    });

    it("should classify rust goro-engine as safe to kill", () => {
      const res = classifyServiceType("./rust-services/goro-engine/target/release/goro-engine --host 127.0.0.1 --port 8001");
      expect(res.serviceType).toBe("RUST_OCR");
      expect(res.isSafeToKill).toBe(true);
    });

    it("should classify python uvicorn as safe to kill", () => {
      const res = classifyServiceType("python -m uvicorn main:app --port 8001");
      expect(res.serviceType).toBe("PYTHON_OCR");
      expect(res.isSafeToKill).toBe(true);
    });

    it("should protect core database services from accidental termination", () => {
      const redis = classifyServiceType("/opt/homebrew/opt/redis/bin/redis-server");
      expect(redis.serviceType).toBe("REDIS");
      expect(redis.isSafeToKill).toBe(false);

      const postgres = classifyServiceType("/opt/homebrew/opt/postgresql@18/bin/postgres");
      expect(postgres.serviceType).toBe("POSTGRES");
      expect(postgres.isSafeToKill).toBe(false);
    });

    it("should protect next.js web server from terminating itself", () => {
      const server = classifyServiceType("next-server (v15.2.0)");
      expect(server.serviceType).toBe("WEB_SERVER");
      expect(server.isSafeToKill).toBe(false);
    });
  });

  describe("2. getSystemResources Telemetry", () => {
    it("should return valid hardware and OS metrics", () => {
      const res = getSystemResources();
      expect(res.cpuCount).toBeGreaterThan(0);
      expect(typeof res.cpuModel).toBe("string");
      expect(res.totalMemBytes).toBeGreaterThan(0);
      expect(res.freeMemBytes).toBeGreaterThan(0);
      expect(res.memUsagePercent).toBeGreaterThanOrEqual(0);
      expect(res.memUsagePercent).toBeLessThanOrEqual(100);
      expect(res.systemUptimeSeconds).toBeGreaterThan(0);
      expect(res.nodeMemory.heapUsed).toBeGreaterThan(0);
      expect(["darwin", "linux", "win32"]).toContain(res.platform);
    });
  });

  describe("3. tailLogFile & Security Path Traversal Guard", () => {
    it("should block path traversal attempts outside logs directory", async () => {
      await expect(tailLogFile("../package.json")).rejects.toThrow(
        "Akses tidak sah ke berkas di luar direktori logs/."
      );
    });

    it("should handle non-existent log file gracefully", async () => {
      const result = await tailLogFile("non_existent_service.log");
      expect(result.fileName).toBe("non_existent_service.log");
      expect(result.totalLines).toBe(0);
      expect(result.lines[0]).toContain("belum terbentuk");
    });

    it("should read real log lines when file exists", async () => {
      const testLogPath = path.resolve(process.cwd(), "logs", "test_unit.log");
      fs.mkdirSync(path.dirname(testLogPath), { recursive: true });
      fs.writeFileSync(testLogPath, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n");

      try {
        const result = await tailLogFile("test_unit.log", 3);
        expect(result.fileName).toBe("test_unit.log");
        expect(result.lines.length).toBeLessThanOrEqual(4);
        expect(result.lines).toContain("Line 5");
      } finally {
        if (fs.existsSync(testLogPath)) {
          fs.unlinkSync(testLogPath);
        }
      }
    });
  });

  describe("4. terminateProcess Guardrails", () => {
    it("should reject termination of essential OS processes with PID <= 100", async () => {
      await expect(terminateProcess(1)).rejects.toThrow("DILARANG KERAS: Tidak dapat menghentikan proses vital sistem operasi");
      await expect(terminateProcess(50)).rejects.toThrow("DILARANG KERAS: Tidak dapat menghentikan proses vital sistem operasi");
    });

    it("should reject terminating self process PID", async () => {
      await expect(terminateProcess(process.pid)).rejects.toThrow(
        "DILARANG: Tidak dapat menghentikan proses server web sendiri."
      );
    });
  });

  describe("5. checkPortConnectivity", () => {
    it("should return latency and reachability", async () => {
      // Port 59999 should not be listening
      const result = await checkPortConnectivity(59999, "127.0.0.1", 100);
      expect(result.isReachable).toBe(false);
    });
  });

  describe("6. resolveServiceEndpoint & Multi-Container Port Detection", () => {
    it("should parse Docker hostnames and custom ports from connection URLs", () => {
      expect(
        resolveServiceEndpoint(
          "postgresql://goro_admin:goro_secret_2026@postgres:5432/goro_s2jb?schema=public",
          "127.0.0.1",
          5432
        )
      ).toEqual({ host: "postgres", port: 5432 });

      expect(
        resolveServiceEndpoint("redis://redis:6379", "127.0.0.1", 6379)
      ).toEqual({ host: "redis", port: 6379 });

      expect(
        resolveServiceEndpoint("http://ocr-engine:8001", "127.0.0.1", 8001)
      ).toEqual({ host: "ocr-engine", port: 8001 });
    });

    it("should normalize wildcard bind addresses and fallback safely on invalid URLs", () => {
      expect(
        resolveServiceEndpoint("http://0.0.0.0:8001", "127.0.0.1", 8001)
      ).toEqual({ host: "127.0.0.1", port: 8001 });

      expect(
        resolveServiceEndpoint("https://ocr.internal", "127.0.0.1", 8001)
      ).toEqual({ host: "ocr.internal", port: 443 });

      expect(resolveServiceEndpoint(undefined, "127.0.0.1", 5432)).toEqual({
        host: "127.0.0.1",
        port: 5432,
      });

      expect(resolveServiceEndpoint("not-a-valid-url", "127.0.0.1", 6379)).toEqual({
        host: "127.0.0.1",
        port: 6379,
      });
    });

    it("should probe configured DATABASE_URL, REDIS_URL, OCR_SERVICE_URL, and PORT endpoints", async () => {
      const startServer = (): Promise<{ server: net.Server; port: number }> =>
        new Promise((resolve, reject) => {
          const srv = net.createServer();
          srv.once("error", reject);
          srv.listen(0, "127.0.0.1", () => {
            const addr = srv.address();
            if (addr && typeof addr === "object") {
              resolve({ server: srv, port: addr.port });
            } else {
              reject(new Error("Failed to get ephemeral port"));
            }
          });
        });

      const started = await Promise.all([
        startServer(),
        startServer(),
        startServer(),
        startServer(),
      ]);

      try {
        const [pgSrv, redisSrv, ocrSrv, webSrv] = started;
        vi.stubEnv("DATABASE_URL", `postgresql://user:pass@127.0.0.1:${pgSrv.port}/goro_s2jb`);
        vi.stubEnv("REDIS_URL", `redis://127.0.0.1:${redisSrv.port}`);
        vi.stubEnv("OCR_SERVICE_URL", `http://127.0.0.1:${ocrSrv.port}`);
        vi.stubEnv("PORT", String(webSrv.port));

        const results = await detectServicePorts();
        expect(results).toHaveLength(4);
        expect(results.map((r) => r.port)).toEqual([
          pgSrv.port,
          redisSrv.port,
          ocrSrv.port,
          webSrv.port,
        ]);
        expect(results.every((r) => r.status === "UP")).toBe(true);
      } finally {
        await Promise.all(
          started.map(
            ({ server }) =>
              new Promise<void>((resolve) => server.close(() => resolve()))
          )
        );
      }
    });
  });
});
