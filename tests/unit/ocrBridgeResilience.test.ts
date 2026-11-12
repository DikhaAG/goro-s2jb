import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    spawn: spawnMock,
  };
});

import {
  executeOcrBridge,
  getOcrBridgeMetrics,
  resetOcrBridgeMetrics,
} from "@/server/services/ocrBridge";

function createErrorProcess(errCode: string, message: string) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };

  setTimeout(() => {
    const err = new Error(message) as NodeJS.ErrnoException;
    err.code = errCode;
    proc.emit("error", err);
  }, 5);

  return proc;
}

function createSuccessProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };

  setTimeout(() => {
    proc.stdout.emit(
      "data",
      Buffer.from(
        JSON.stringify({
          success: true,
          extracted_text: "ULASAN",
          phash: "0000",
          similarity_score: 90,
          zone: "GREEN",
          recommended_status: "APPROVED",
          execution_time_ms: 50,
        })
      )
    );
    proc.emit("close", 0);
  }, 5);

  return proc;
}

describe("executeOcrBridge resilience", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetOcrBridgeMetrics();
    spawnMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retries transient HTTP errors and HTTP 5xx before falling back to subprocess", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:8001"))
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          extracted_text: "PELAYANAN SANGAT BAIK",
          phash: "abcdef1234567890",
          similarity_score: 92,
          zone: "GREEN",
          recommended_status: "APPROVED",
          execution_time_ms: 85,
        }),
      } as any);

    global.fetch = fetchMock as any;

    const result = await executeOcrBridge(Buffer.from("fake-image"), "Budi");

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(spawnMock).not.toHaveBeenCalled();

    const metrics = getOcrBridgeMetrics();
    expect(metrics.httpSuccessCount).toBe(1);
    expect(metrics.cliFallbackCount).toBe(0);
  });

  it("returns a clear unreachable message instead of raw spawn python3 ENOENT when HTTP fails and fallback binary is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8001"));
    global.fetch = fetchMock as any;

    spawnMock.mockImplementation(() =>
      createErrorProcess("ENOENT", "spawn python3 ENOENT")
    );

    const result = await executeOcrBridge(Buffer.from("fake-image"), "Nofran");

    expect(result.success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(result.error).not.toContain("spawn python3 ENOENT");
    expect(result.error?.toLowerCase()).toContain("tidak dapat dihubungi");
    expect(result.error).toContain("ECONNREFUSED");

    const metrics = getOcrBridgeMetrics();
    expect(metrics.cliFallbackCount).toBe(1);
    expect(metrics.cliFailureCount).toBe(1);
  });

  it("increments cliFallbackCount once when persistent HTTP 5xx falls back to subprocess", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as any);
    global.fetch = fetchMock as any;

    spawnMock.mockImplementation(() => createSuccessProcess());

    const result = await executeOcrBridge(Buffer.from("fake-image"), "Andi");

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(spawnMock).toHaveBeenCalledTimes(1);

    const metrics = getOcrBridgeMetrics();
    expect(metrics.cliFallbackCount).toBe(1);
    expect(metrics.cliSuccessCount).toBe(1);
  });

  it("uses an HTTP timeout >= 90000ms for OCR requests", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        extracted_text: "OK",
        phash: "0000",
        similarity_score: 90,
        zone: "GREEN",
        recommended_status: "APPROVED",
        execution_time_ms: 25,
      }),
    } as any);

    await executeOcrBridge(Buffer.from("fake-image"), "Sari");

    const delays = setTimeoutSpy.mock.calls.map((call) => call[1]);
    expect(delays).toContain(90000);
  });
});
