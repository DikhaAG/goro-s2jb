import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getRoleMaxAgeSeconds, getDefaultRedirectForRole } from "@/lib/auth-constants";
import { Role } from "@prisma/client";

describe("Authentication & Password Security Engine (AC-1, AC-2)", () => {
  it("should generate different hashes for identical passwords due to random salt", async () => {
    const raw = "SuperSecret123!";
    const hash1 = await hashPassword(raw);
    const hash2 = await hashPassword(raw);

    expect(hash1).toBeDefined();
    expect(hash2).toBeDefined();
    expect(hash1).not.toBe(hash2);
    expect(hash1.startsWith("$2a$") || hash1.startsWith("$2b$")).toBe(true);
  });

  it("should verify correct password against hash and reject wrong password", async () => {
    const raw = "P@sswordPLN2026";
    const hash = await hashPassword(raw);

    const isMatch = await verifyPassword(raw, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword("WrongPassword!", hash);
    expect(isWrongMatch).toBe(false);
  });

  it("should verify legacy sha256 seeded hash for backward compatibility", async () => {
    // SHA256 format used in prisma/seed.ts
    const crypto = await import("crypto");
    const legacyHash = crypto.createHash("sha256").update("password123_goro_salt_2026").digest("hex");

    const isMatch = await verifyPassword("password123", legacyHash);
    expect(isMatch).toBe(true);

    const isWrong = await verifyPassword("wrongpassword", legacyHash);
    expect(isWrong).toBe(false);
  });

  it("should enforce distinct session duration per role (7 days for field officer, 24h for others)", () => {
    expect(getRoleMaxAgeSeconds(Role.PETUGAS_LAPANGAN)).toBe(7 * 24 * 60 * 60);
    expect(getRoleMaxAgeSeconds(Role.PEGAWAI)).toBe(24 * 60 * 60);
    expect(getRoleMaxAgeSeconds(Role.MANAGER)).toBe(24 * 60 * 60);
    expect(getRoleMaxAgeSeconds(Role.SUPER_ADMIN)).toBe(24 * 60 * 60);
  });

  it("should return the exact dashboard route for each role", () => {
    expect(getDefaultRedirectForRole(Role.PETUGAS_LAPANGAN)).toBe("/intake");
    expect(getDefaultRedirectForRole(Role.PEGAWAI)).toBe("/reviews");
    expect(getDefaultRedirectForRole(Role.MANAGER)).toBe("/reports");
    expect(getDefaultRedirectForRole(Role.SUPER_ADMIN)).toBe("/users");
  });
});
