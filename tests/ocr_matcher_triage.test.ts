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
});
