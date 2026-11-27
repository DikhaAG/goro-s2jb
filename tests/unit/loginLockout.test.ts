import { describe, it, expect, beforeEach } from "vitest";
import { createRateLimits, type RateLimits } from "@/server/rateLimits";

describe("Penguncian Login", () => {
  let limits: RateLimits;
  const ip = "10.20.30.40";

  beforeEach(() => {
    limits = createRateLimits();
  });

  it("locks a username+IP pair after 5 failures within 15 minutes", async () => {
    for (let i = 0; i < 4; i++) {
      const status = await limits.loginLockout.recordFailure({ username: "petugas_a", ip });
      expect(status.locked).toBe(false);
    }

    const fifth = await limits.loginLockout.recordFailure({ username: "petugas_a", ip });
    expect(fifth).toMatchObject({ locked: true, remaining: 0 });
    expect(fifth.retryAfterSeconds).toBeGreaterThan(14 * 60);

    const check = await limits.loginLockout.check({ username: "petugas_a", ip });
    expect(check.locked).toBe(true);
  });

  it("does not lock another username from the same IP", async () => {
    for (let i = 0; i < 5; i++) {
      await limits.loginLockout.recordFailure({ username: "petugas_a", ip });
    }

    const other = await limits.loginLockout.check({ username: "petugas_b", ip });
    expect(other).toMatchObject({ locked: false, remaining: 5 });
  });

  it("treats usernames that differ only in case or spacing as the same account", async () => {
    for (const username of ["Admin", "admin ", " ADMIN", "admin", "aDmIn"]) {
      await limits.loginLockout.recordFailure({ username, ip });
    }

    const check = await limits.loginLockout.check({ username: "admin", ip });
    expect(check.locked).toBe(true);
  });

  it("locks the whole IP after 50 failures spread across usernames", async () => {
    for (let i = 0; i < 50; i++) {
      await limits.loginLockout.recordFailure({ username: `spray_${i}`, ip });
    }

    const fresh = await limits.loginLockout.check({ username: "never_tried", ip });
    expect(fresh.locked).toBe(true);
    expect(fresh.retryAfterSeconds).toBeGreaterThan(0);

    const otherIp = await limits.loginLockout.check({ username: "never_tried", ip: "10.0.0.9" });
    expect(otherIp.locked).toBe(false);
  });

  it("clears the username+IP counter after a successful sign-in", async () => {
    for (let i = 0; i < 4; i++) {
      await limits.loginLockout.recordFailure({ username: "petugas_a", ip });
    }
    await limits.loginLockout.reset({ username: "petugas_a", ip });

    const check = await limits.loginLockout.check({ username: "petugas_a", ip });
    expect(check).toMatchObject({ locked: false, remaining: 5 });
  });
});

describe("upload quota", () => {
  it("allows 60 uploads per minute per user and rejects the 61st", async () => {
    const limits = createRateLimits();
    for (let i = 0; i < 60; i++) {
      expect((await limits.uploadQuota.consume("usr_field")).allowed).toBe(true);
    }

    const over = await limits.uploadQuota.consume("usr_field");
    expect(over.allowed).toBe(false);
    expect(over.retryAfterSeconds).toBeGreaterThan(0);

    expect((await limits.uploadQuota.consume("usr_other")).allowed).toBe(true);
  });
});

describe("Penguncian Login without a trusted client IP", () => {
  it("locks by username alone and never applies the per-IP limit", async () => {
    const limits = createRateLimits();
    for (let i = 0; i < 50; i++) {
      await limits.loginLockout.recordFailure({ username: `spray_${i}`, ip: null });
    }
    expect((await limits.loginLockout.check({ username: "never_tried", ip: null })).locked).toBe(false);
    expect((await limits.loginLockout.check({ username: "spray_0", ip: null })).locked).toBe(false);

    for (let i = 0; i < 4; i++) {
      await limits.loginLockout.recordFailure({ username: "spray_0", ip: null });
    }
    expect((await limits.loginLockout.check({ username: "spray_0", ip: null })).locked).toBe(true);
  });
});
