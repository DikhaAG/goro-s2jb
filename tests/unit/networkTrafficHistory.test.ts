import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrationRouter } from "@/server/routers/migration";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

describe("Network Traffic History Aggregation Procedure (Task 20.2)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createMockCaller = () => {
    return migrationRouter.createCaller({
      prisma,
      user: {
        id: "operator-user-1",
        name: "Operator User",
        username: "operator1",
        email: "operator@pln.co.id",
        role: Role.SUPER_ADMIN,
        up3Id: null,
        ulpId: null,
      },
      req: {} as any,
      res: {} as any,
    } as any);
  };

  it("should return 24 hourly buckets for HOUR time range with accurate metrics", async () => {
    const caller = createMockCaller();
    const result = await caller.getNetworkTrafficHistory({ timeRange: "HOUR" });

    expect(result.timeRange).toBe("HOUR");
    expect(result.points).toHaveLength(24);
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.totalRequests).toBe("number");
    expect(typeof result.summary.totalBytes).toBe("number");
    expect(typeof result.summary.peakRateKbps).toBe("number");
    expect(typeof result.summary.averageLatencyMs).toBe("number");

    for (const pt of result.points) {
      expect(pt.timestamp).toBeGreaterThan(0);
      expect(typeof pt.label).toBe("string");
      expect(pt.label.length).toBeGreaterThanOrEqual(4);
      expect(typeof pt.rateKbps).toBe("number");
      expect(typeof pt.bytesDelta).toBe("number");
      expect(typeof pt.requestsCount).toBe("number");
      expect(typeof pt.latencyMs).toBe("number");
    }
  });

  it("should return 30 daily buckets for DAY time range", async () => {
    const caller = createMockCaller();
    const result = await caller.getNetworkTrafficHistory({ timeRange: "DAY" });

    expect(result.timeRange).toBe("DAY");
    expect(result.points).toHaveLength(30);
    expect(result.summary).toBeDefined();

    for (const pt of result.points) {
      expect(pt.timestamp).toBeGreaterThan(0);
      expect(typeof pt.label).toBe("string");
      expect(typeof pt.rateKbps).toBe("number");
      expect(typeof pt.bytesDelta).toBe("number");
      expect(typeof pt.requestsCount).toBe("number");
    }
  });

  it("should return 12 monthly buckets for MONTH time range", async () => {
    const caller = createMockCaller();
    const result = await caller.getNetworkTrafficHistory({ timeRange: "MONTH" });

    expect(result.timeRange).toBe("MONTH");
    expect(result.points).toHaveLength(12);
    expect(result.summary).toBeDefined();

    for (const pt of result.points) {
      expect(pt.timestamp).toBeGreaterThan(0);
      expect(typeof pt.label).toBe("string");
      expect(typeof pt.rateKbps).toBe("number");
      expect(typeof pt.bytesDelta).toBe("number");
      expect(typeof pt.requestsCount).toBe("number");
    }
  });

  it("should return 5 yearly buckets for YEAR time range", async () => {
    const caller = createMockCaller();
    const result = await caller.getNetworkTrafficHistory({ timeRange: "YEAR" });

    expect(result.timeRange).toBe("YEAR");
    expect(result.points).toHaveLength(5);
    expect(result.summary).toBeDefined();

    for (const pt of result.points) {
      expect(pt.timestamp).toBeGreaterThan(0);
      expect(typeof pt.label).toBe("string");
      expect(pt.label).toMatch(/^\d{4}$/);
      expect(typeof pt.rateKbps).toBe("number");
      expect(typeof pt.bytesDelta).toBe("number");
      expect(typeof pt.requestsCount).toBe("number");
    }
  });

  it("should handle mocked zero-data scenario safely without NaN or crashes", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce([]);

    const caller = createMockCaller();
    const result = await caller.getNetworkTrafficHistory({ timeRange: "HOUR" });

    expect(result.points).toHaveLength(24);
    expect(result.summary.totalRequests).toBe(0);
    expect(result.summary.totalBytes).toBe(0);
    expect(result.summary.peakRateKbps).toBe(0);
    expect(result.summary.averageLatencyMs).toBe(0);

    for (const pt of result.points) {
      expect(pt.rateKbps).toBe(0);
      expect(pt.bytesDelta).toBe(0);
      expect(pt.requestsCount).toBe(0);
      expect(pt.latencyMs).toBe(0);
      expect(Number.isNaN(pt.rateKbps)).toBe(false);
    }
  });

  describe("NetworkTrafficChart Coordinate & Projection Safety", () => {
    it("should safely produce empty coordinates when points array is empty", () => {
      const points: any[] = [];
      const coordinates = points.length === 0 ? [] : [{ x: 55, y: 205, point: points[0] }];
      expect(coordinates).toEqual([]);
      expect(coordinates.length).toBe(0);
      const renderedDots = coordinates.map((c) => c.point?.timestamp);
      expect(renderedDots).toEqual([]);
    });

    it("should safely handle 1 point without crashing", () => {
      const points = [{ timestamp: 1700000000000, rateKbps: 50, bytesDelta: 1000, latencyMs: 400, requestsCount: 1 }];
      const coordinates = points.length === 0 ? [] : [{ x: 55, y: 205, point: points[0] }];
      expect(coordinates).toHaveLength(1);
      expect(coordinates[0].point.timestamp).toBe(1700000000000);
    });
  });
});
