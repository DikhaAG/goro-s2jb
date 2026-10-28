import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("Integrated Observability & Health-Check Suite (AC-5)", () => {
  it("should return HTTP 200 with detailed connectivity metrics for all 5 subsystems", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toBeDefined();
    expect(["healthy", "degraded"]).toContain(data.status);
    expect(data.timestamp).toBeDefined();

    // Verify services breakdown
    expect(data.services).toBeDefined();
    expect(data.services.database.status).toBe("up");
    expect(typeof data.services.database.latency_ms).toBe("number");

    expect(data.services.redis.status).toBe("up");
    expect(typeof data.services.redis.latency_ms).toBe("number");

    expect(data.services.bullmq.status).toBe("up");
    expect(typeof data.services.bullmq.ocr_waiting).toBe("number");

    expect(data.services.python_ocr.status).toBe("up");
    expect(typeof data.services.python_ocr.latency_ms).toBe("number");

    expect(data.services.storage.status).toBe("up");
    expect(data.services.storage.writable).toBe(true);
  });
});
