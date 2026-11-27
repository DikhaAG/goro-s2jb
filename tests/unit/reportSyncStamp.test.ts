import { describe, it, expect, vi } from "vitest";
import { createReportSyncStamp } from "@/server/services/achievementReport";

function memoryStore() {
  const store = new Map<string, string>();
  return {
    status: "ready",
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
  };
}

describe("Laporan Capaian: sync stamp", () => {
  it("records when Laporan Capaian data last changed and reads it back", async () => {
    const now = new Date("2099-03-10T18:30:00Z");
    const stamp = createReportSyncStamp(() => memoryStore(), () => now);
    const shared = memoryStore();
    const sharedStamp = createReportSyncStamp(() => shared, () => now);

    expect(await sharedStamp.lastUpdated()).toBeNull();
    await sharedStamp.markUpdated();
    expect(await sharedStamp.lastUpdated()).toBe(String(now.getTime()));
    expect(await stamp.lastUpdated()).toBeNull();
  });

  it("accepts a store that loads lazily", async () => {
    const shared = memoryStore();
    const stamp = createReportSyncStamp(async () => shared);
    await stamp.markUpdated();
    expect(await stamp.lastUpdated()).not.toBeNull();
  });

  it("is best effort: a missing, closed, failing or unloadable store never throws", async () => {
    const missing = createReportSyncStamp(() => null);
    await expect(missing.markUpdated()).resolves.toBeUndefined();
    await expect(missing.lastUpdated()).resolves.toBeNull();

    const bare = createReportSyncStamp(() => ({}));
    await expect(bare.markUpdated()).resolves.toBeUndefined();
    await expect(bare.lastUpdated()).resolves.toBeNull();

    const closed = memoryStore();
    closed.status = "end";
    await createReportSyncStamp(() => closed).markUpdated();
    expect(closed.set).not.toHaveBeenCalled();

    const failing = createReportSyncStamp(() => ({
      get: vi.fn().mockRejectedValue(new Error("Redis down")),
      set: vi.fn().mockRejectedValue(new Error("Redis down")),
    }));
    await expect(failing.markUpdated()).resolves.toBeUndefined();
    await expect(failing.lastUpdated()).resolves.toBeNull();

    const unloadable = createReportSyncStamp(async () => {
      throw new Error("cannot import redis");
    });
    await expect(unloadable.markUpdated()).resolves.toBeUndefined();
    await expect(unloadable.lastUpdated()).resolves.toBeNull();
  });
});
