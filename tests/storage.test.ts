import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  confineToRoot,
  discardEvidenceImage,
  resolveEvidencePath,
  storeEvidenceImage,
} from "@/lib/storage";

describe("Storage Engine (src/lib/storage.ts)", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "goro-storage-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  });

  it("blocks path traversal, null bytes, root-itself, and sibling-prefix escapes", () => {
    const escapingPaths = [
      "",
      ".",
      "../../etc/passwd",
      "../../etc/evil.jpg",
      "../evidence/../../../secrets.txt",
      "..\\..\\windows\\system32",
      "evidence/2026/photo.jpg\0.png",
      `${tempRoot}_evil/photo.jpg`,
      "/etc/passwd",
    ];

    for (const mal of escapingPaths) {
      expect(confineToRoot(tempRoot, mal).isAllowed).toBe(false);
      expect(resolveEvidencePath(mal, tempRoot).isAllowed).toBe(false);
    }

    // Literal '....//' stays inside root (does not collapse to '..') and is still rejected by extension allowlist
    const doubleDotProbe = "....//....//etc/shadow";
    expect(confineToRoot(tempRoot, doubleDotProbe).safeAbsolutePath.startsWith(tempRoot + path.sep)).toBe(true);
    expect(resolveEvidencePath(doubleDotProbe, tempRoot).isAllowed).toBe(false);
  });

  it("allows safe relative, dot-prefixed, and in-root absolute evidence paths", () => {
    const safeRel = path.join("evidence", "2026", "10", "28", "eviden_123.jpg");
    const resolved = resolveEvidencePath(safeRel, tempRoot);
    expect(resolved.isAllowed).toBe(true);
    expect(resolved.contentType).toBe("image/jpeg");
    expect(resolved.relativePath).toBe("evidence/2026/10/28/eviden_123.jpg");
    expect(resolved.safeAbsolutePath).toBe(path.join(tempRoot, safeRel));

    const dotSubdir = confineToRoot(tempRoot, "..data/sample.png");
    expect(dotSubdir.isAllowed).toBe(true);
    expect(dotSubdir.relativePath).toBe("..data/sample.png");

    const absInRoot = resolveEvidencePath(path.join(tempRoot, "evidence", "a.webp"), tempRoot);
    expect(absInRoot.isAllowed).toBe(true);
    expect(absInRoot.contentType).toBe("image/webp");
    expect(absInRoot.relativePath).toBe("evidence/a.webp");
  });

  it("remaps cross-host /uploads/ mounts only when enabled and rejects escaped remaps", () => {
    const remapped = confineToRoot(tempRoot, "/docker/app/uploads/migration/batch.csv", {
      remapUploadsMount: true,
    });
    expect(remapped.isAllowed).toBe(true);
    expect(remapped.safeAbsolutePath).toBe(path.join(tempRoot, "migration", "batch.csv"));

    const escapedRemap = confineToRoot(tempRoot, "/docker/app/uploads/../../etc/passwd", {
      remapUploadsMount: true,
    });
    expect(escapedRemap.isAllowed).toBe(false);
  });

  it("stores and discards evidence images confined to injected temp root", async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const relPath = await storeEvidenceImage(tempRoot, bytes, "image/jpeg", "2026-11-27");
    const absPath = path.join(tempRoot, relPath);

    expect(relPath).toMatch(/^evidence\/2026\/11\/27\/eviden_\d+_[0-9a-f]{16}\.jpg$/);
    expect(fs.readFileSync(absPath)).toEqual(bytes);

    await discardEvidenceImage(tempRoot, relPath);
    expect(fs.existsSync(absPath)).toBe(false);
  });
});
