import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockQueryRawUnsafe,
  mockRedisPing,
  mockOcrGetJobCounts,
  mockImportGetJobCounts,
  mockExistsSync,
  mockAccessSync,
} = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  mockRedisPing: vi.fn(),
  mockOcrGetJobCounts: vi.fn(),
  mockImportGetJobCounts: vi.fn(),
  mockExistsSync: vi.fn(),
  mockAccessSync: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}));

vi.mock("@/lib/redis", () => ({
  default: {
    ping: mockRedisPing,
  },
}));

vi.mock("@/server/queues/ocrQueue", () => ({
  ocrQueue: {
    getJobCounts: mockOcrGetJobCounts,
  },
}));

vi.mock("@/server/queues/importQueue", () => ({
  importQueue: {
    getJobCounts: mockImportGetJobCounts,
  },
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const patched = {
    ...actual,
    existsSync: mockExistsSync,
    accessSync: mockAccessSync,
  };
  return {
    ...patched,
    default: patched,
  };
});

import { GET } from "@/app/api/health/route";
import { logger } from "@/lib/logger";
import { BASE_UPLOAD_DIR } from "@/lib/storage";

describe("GET /api/health logging suppression and OCR timeout budget", () => {
  const originalFetch = global.fetch;
  const originalLogHealthEnv = process.env.LOG_HEALTH_CHECKS;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_HEALTH_CHECKS;

    mockQueryRawUnsafe.mockResolvedValue([{ "?column?": 1 }]);
    mockRedisPing.mockResolvedValue("PONG");
    mockOcrGetJobCounts.mockResolvedValue({ waiting: 0, active: 0 });
    mockImportGetJobCounts.mockResolvedValue({ waiting: 0, active: 0 });
    mockExistsSync.mockImplementation((target: unknown) => String(target) === BASE_UPLOAD_DIR);
    mockAccessSync.mockImplementation(() => undefined);

    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    if (originalLogHealthEnv === undefined) {
      delete process.env.LOG_HEALTH_CHECKS;
    } else {
      process.env.LOG_HEALTH_CHECKS = originalLogHealthEnv;
    }
  });

  it("does not emit log entries when all services are healthy", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs info when LOG_HEALTH_CHECKS=true even if healthy", async () => {
    process.env.LOG_HEALTH_CHECKS = "true";
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});

    const res = await GET();
    expect(res.status).toBe(200);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[1]).toMatchObject({
      module: "HEALTH",
      metadata: { overallStatus: "healthy" },
    });
  });

  it("logs warn when OCR engine is degraded", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    global.fetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")) as unknown as typeof fetch;

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.services.python_ocr.status).toBe("down");
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[1]).toMatchObject({
      module: "HEALTH",
      metadata: { overallStatus: "degraded" },
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs error when critical infrastructure (database) is down", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    mockQueryRawUnsafe.mockRejectedValue(new Error("Connection terminated"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.services.database.status).toBe("down");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[1]).toMatchObject({
      module: "HEALTH",
      metadata: { overallStatus: "degraded" },
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("tolerates OCR /health response latency above 2000ms without aborting", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;

    global.fetch = vi.fn().mockImplementation((_url: unknown, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({ ok: true, status: 200 });
        }, 2500);

        init?.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
          },
          { once: true }
        );
      });
    }) as unknown as typeof fetch;

    const responsePromise = GET();
    await vi.advanceTimersByTimeAsync(2500);
    const res = await responsePromise;
    const body = await res.json();

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);
    expect(body.services.python_ocr.status).toBe("up");
    expect(body.status).toBe("healthy");
  });

  it("aborts hung OCR /health requests before Docker 5s deadline and logs degraded warning", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    let capturedSignal: AbortSignal | undefined;

    global.fetch = vi.fn().mockImplementation((_url: unknown, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
          },
          { once: true }
        );
      });
    }) as unknown as typeof fetch;

    const responsePromise = GET();
    await vi.advanceTimersByTimeAsync(3600);
    const res = await responsePromise;
    const body = await res.json();

    expect(capturedSignal?.aborted).toBe(true);
    expect(body.status).toBe("degraded");
    expect(body.services.python_ocr.status).toBe("down");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
