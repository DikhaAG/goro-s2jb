import { describe, it, expect } from "vitest";
import path from "path";
import { processEvidenceOcr } from "@/server/services/ocrService";
import { ValidationStatus } from "@/types";

describe("Python OCR & pHash Adapter (src/server/services/ocrService.ts)", () => {
  const sampleImagePath = path.resolve(process.cwd(), "uploads/test/sample_budi.png");

  it("should process sample image and extract text, pHash, and fuzzy score matching GREEN zone", async () => {
    const result = await processEvidenceOcr(sampleImagePath, "Budi Santoso");

    expect(result.success).toBe(true);
    expect(result.phash).toHaveLength(16); // 64-bit hex is 16 chars
    expect(result.extracted_text.toLowerCase()).toContain("budi");
    expect(result.similarity_score).toBeGreaterThanOrEqual(80.0);
    expect(result.zone).toBe("GREEN");
    expect(result.recommended_status).toBe(ValidationStatus.APPROVED);
    expect(result.execution_time_ms).toBeGreaterThan(0);
  });

  it("should categorize mismatched name as RED zone", async () => {
    const result = await processEvidenceOcr(sampleImagePath, "Siti Rahmawati");

    expect(result.success).toBe(true);
    expect(result.similarity_score).toBeLessThan(50.0);
    expect(result.zone).toBe("RED");
    expect(result.recommended_status).toBe(ValidationStatus.REJECTED);
  });

  it("should gracefully handle non-existent file", async () => {
    const nonExistentPath = path.resolve(process.cwd(), "uploads/test/not_exist.png");
    const result = await processEvidenceOcr(nonExistentPath, "Budi Santoso");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Image file not found");
  });
});
