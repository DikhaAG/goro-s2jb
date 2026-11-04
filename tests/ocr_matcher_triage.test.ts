import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

describe("OCR Fuzzy Matcher & Tri-Zone Triage (matcher.py)", () => {
  const pythonExec = path.resolve(process.cwd(), "python-services/ocr/venv/bin/python3");

  function runPythonMatcher(target: string, extracted: string): {
    score: number;
    zone: string;
    status: string;
  } {
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

  it("should classify identical name as GREEN zone (APPROVED)", () => {
    const res = runPythonMatcher("Rudi Tabuci", "Rudi Tabuci");
    expect(res.score).toBe(100.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should strip emojis and special symbols and score >= 90% (GREEN / APPROVED)", () => {
    const res = runPythonMatcher("Rudi Tabuci", "⭐🌟 rudi tabuci 🌟⭐");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should classify moderate mismatch (70% - 89.9%) as YELLOW zone (NEEDS_REVIEW)", () => {
    const res = runPythonMatcher("Rudi Tabuci", "Ahmad Tabuci");
    expect(res.score).toBeGreaterThanOrEqual(70.0);
    expect(res.score).toBeLessThan(90.0);
    expect(res.zone).toBe("YELLOW");
    expect(res.status).toBe("NEEDS_REVIEW");
  });

  it("should classify severe mismatch (< 70%) as RED zone (REJECTED)", () => {
    const res = runPythonMatcher("Rudi Tabuci", "Miki Pangkalan Balai");
    expect(res.score).toBeLessThan(70.0);
    expect(res.zone).toBe("RED");
    expect(res.status).toBe("REJECTED");
  });

  it("should recognize names with physical screen crack splits (e.g. 'Tom my' for 'Tommy') as GREEN zone", () => {
    const res = runPythonMatcher("Tommy", "PLN Mobile\nTom my\n26/10/26\nBeli token");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should tolerate optical OCR crack/blur substitutions (e.g. 'T0mmy', 'Tornmy') as GREEN zone", () => {
    const res1 = runPythonMatcher("Tommy", "PLN Mobile\nT0mmy\n26/10/26\nBeli token");
    expect(res1.score).toBeGreaterThanOrEqual(90.0);
    expect(res1.zone).toBe("GREEN");

    const res2 = runPythonMatcher("Tommy", "PLN Mobile\nTornmy\n26/10/26\nBeli token");
    expect(res2.score).toBeGreaterThanOrEqual(90.0);
    expect(res2.zone).toBe("GREEN");
  });

  it("should handle multi-word names with cracked screen noise (e.g. 'Bud1 Sant0so')", () => {
    const res = runPythonMatcher("Budi Santoso", "PLN Mobile\nBud1 Sant0so\n26/10/26");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
  });

  it("should tolerate 1-char edit distance on short names with thin/merged letters (e.g. 'Tiara' vs 'Tara')", () => {
    const res = runPythonMatcher("Tiara", "PLN Mobile\nTara\n26/10/26\nSangat membantu");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should recognize valid single token from multi-word target when no conflicting name exists (e.g. 'Azkia keysah' vs 'Keysah')", () => {
    const res = runPythonMatcher("Azkia keysah", "PLN Mobile\n) Keysah\n26/10/26\nAplikasi bagus");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });

  it("should recognize prefix/nickname matches for compound Google account names (e.g. 'DICKI' vs 'dickyyuhendra yhd')", () => {
    const res = runPythonMatcher("DICKI", "PLN Mobile\ndickyyuhendra yhd\n26/10/26\nBagus sekali");
    expect(res.score).toBeGreaterThanOrEqual(90.0);
    expect(res.zone).toBe("GREEN");
    expect(res.status).toBe("APPROVED");
  });
});
