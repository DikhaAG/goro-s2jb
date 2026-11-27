import { describe, it, expect } from "vitest";
import path from "path";
import { resolveEvidencePath, BASE_UPLOAD_DIR } from "@/lib/storage";

describe("Storage Engine (src/lib/storage.ts)", () => {
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
});
