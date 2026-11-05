import { describe, it, expect } from "vitest";
import { execFileSync, execSync } from "child_process";
import path from "path";
import fs from "fs";

describe("OCR Fuzzy Matcher & Tri-Zone Triage (matcher.py / Rust matcher.rs)", () => {
  const isWindows = process.platform === "win32";
  const rustBin = path.resolve(
    process.cwd(),
    "rust-services",
    "goro-engine",
    "target",
    "release",
    isWindows ? "goro-engine.exe" : "goro-engine"
  );
  const hasRust = fs.existsSync(rustBin);

  const pythonExec = path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3");
  const hasPython = fs.existsSync(pythonExec) && fs.existsSync(path.resolve(process.cwd(), "python-services/ocr/matcher.py"));

  function runMatcher(target: string, extracted: string): {
    score: number;
    zone: string;
    status: string;
  } {
    // 1. Prioritize Ultra-Fast Rust Native Fuzzy Matcher
    if (hasRust) {
      const output = execFileSync(
        rustBin,
        ["--match-target", target, "--match-text", extracted],
        { encoding: "utf8" }
      );
      return JSON.parse(output.trim());
    }

    // 2. Fallback to Legacy Python Matcher if present
    if (hasPython) {
      const script = `
import sys, json
sys.path.append("python-services/ocr")
from matcher import calculate_similarity
score, zone, status = calculate_similarity(${JSON.stringify(target)}, ${JSON.stringify(extracted)})
print(json.dumps({"score": score, "zone": zone, "status": status}))
      `;
      const output = execSync(`${pythonExec} -c '${script}'`, {
        encoding: "utf8",
      });
      return JSON.parse(output.trim());
    }

    throw new Error("Neither Rust Native Engine nor Python OCR matcher is available.");
  }

  it("should classify identical name as GREEN zone (APPROVED)", () => {
    const res = runMatcher("Rudi Tabuci", "Rudi Tabuci");
    expect(res.score).toBe(100.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should strip emojis and special symbols and score >= 90% (GREEN / APPROVED)", () => {
    const res = runMatcher("Rudi Tabuci", "⭐🌟 rudi tabuci 🌟⭐");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should classify moderate mismatch (70% - 89.9%) as YELLOW zone (NEEDS_REVIEW)", () => {
    const res = runMatcher("Rudi Tabuci", "Ahmad Tabuci");
    expect(res.score).toBeGreaterThanOrEqual(70.0);
    expect(res.score).toBeLessThan(90.0);
    expect(res.zone).toBe("YELLOW");
    expect(res.status).toBe("NEEDS_REVIEW");
  });

  it("should classify severe mismatch (< 70%) as RED zone (REJECTED)", () => {
    const res = runMatcher("Rudi Tabuci", "Miki Pangkalan Balai");
    expect(res.score).toBeLessThan(70.0);
    expect(res.zone).toBe("RED");
    expect(res.status).toBe("REJECTED");
  });

  it("should recognize names with physical screen crack splits (e.g. 'Tom my' for 'Tommy') as GREEN zone", () => {
    const res = runMatcher("Tommy", "PLN Mobile\nTom my\n26/10/26\nBeli token");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should tolerate optical OCR crack/blur substitutions (e.g. 'T0mmy', 'Tornmy') as GREEN zone", () => {
    const res1 = runMatcher("Tommy", "PLN Mobile\nT0mmy\n26/10/26\nBeli token");
    expect(res1.score).toBeGreaterThanOrEqual(90.0);
    expect(res1.zone).toBe("GREEN");

    const res2 = runMatcher("Tommy", "PLN Mobile\nTornmy\n26/10/26\nBeli token");
    expect(res2.score).toBeGreaterThanOrEqual(90.0);
    expect(res2.zone).toBe("GREEN");
  });

  it("should handle multi-word names with cracked screen noise (e.g. 'Bud1 Sant0so')", () => {
    const res = runMatcher("Budi Santoso", "PLN Mobile\nBud1 Sant0so\n26/10/26");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
  });

  it("should tolerate 1-char edit distance on short names with thin/merged letters (e.g. 'Tiara' vs 'Tara')", () => {
    const res = runMatcher("Tiara", "PLN Mobile\nTara\n26/10/26\nSangat membantu");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should recognize valid single token from multi-word target when no conflicting name exists (e.g. 'Azkia keysah' vs 'Keysah')", () => {
    const res = runMatcher("Azkia keysah", "PLN Mobile\n) Keysah\n26/10/26\nAplikasi bagus");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should recognize prefix/nickname matches for compound Google account names (e.g. 'DICKI' vs 'dickyyuhendra yhd')", () => {
    const res = runMatcher("DICKI", "PLN Mobile\ndickyyuhendra yhd\n26/10/26\nBagus sekali");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });
});
