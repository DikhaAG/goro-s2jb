import { describe, it, expect, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import {
  validateEvidenceMime,
  resolveEvidencePath,
  saveEvidenceFile,
  deleteEvidenceFile,
  getDateBasedSubdir,
  BASE_UPLOAD_DIR,
} from "@/lib/storage";

describe("Storage Engine (src/lib/storage.ts)", () => {
  const testSubdir = getDateBasedSubdir(new Date("2026-05-15"));

  it("should generate correct date-based subdirectory", () => {
    expect(testSubdir).toBe(path.join("evidence", "2026", "05", "15"));
  });

  it("should validate allowed MIME types correctly", () => {
    expect(validateEvidenceMime("image/jpeg", "test.jpg")).toBe(true);
    expect(validateEvidenceMime("image/png", "test.png")).toBe(true);
    expect(validateEvidenceMime("image/webp", "test.webp")).toBe(true);
    expect(validateEvidenceMime("application/pdf", "test.pdf")).toBe(false);
    expect(validateEvidenceMime("image/gif", "test.gif")).toBe(false);
    expect(validateEvidenceMime("text/plain", "test.txt")).toBe(false);
  });

  it("should block path traversal attempts", () => {
    const maliciousPaths = [
      "../../etc/passwd",
      "../evidence/../../../secrets.txt",
      "....//....//etc/shadow",
      "..\\..\\windows\\system32",
    ];

    for (const mal of maliciousPaths) {
      const resolved = resolveEvidencePath(mal);
      expect(resolved.isAllowed).toBe(false);
    }
  });

  it("should allow safe relative paths with valid image extensions", () => {
    const safePath = path.join("evidence", "2026", "10", "28", "eviden_123.jpg");
    const resolved = resolveEvidencePath(safePath);
    expect(resolved.isAllowed).toBe(true);
    expect(resolved.contentType).toBe("image/jpeg");
    expect(resolved.safeAbsolutePath).toBe(path.join(BASE_UPLOAD_DIR, safePath));
  });

  it("should write and delete evidence buffer safely", async () => {
    const testBuffer = Buffer.from("fake-image-bytes-for-unit-test");
    const result = await saveEvidenceFile(testBuffer, "sample.jpg", "image/jpeg");

    expect(result.relativePath).toContain("evidence");
    expect(result.filename).toMatch(/^eviden_\d+_[a-f0-9]+\.jpg$/);
    expect(fs.existsSync(result.absolutePath)).toBe(true);

    const deleted = await deleteEvidenceFile(result.relativePath);
    expect(deleted).toBe(true);
    expect(fs.existsSync(result.absolutePath)).toBe(false);
  });
});
