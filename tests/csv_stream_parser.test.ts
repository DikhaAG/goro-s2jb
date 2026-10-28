import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { parseCsvStream, RawReviewRow } from "@/lib/parsers/csvStreamParser";
import fs from "fs";
import path from "path";

describe("Streaming CSV Parser (src/lib/parsers/csvStreamParser.ts)", () => {
  const testCsvPath = path.join(process.cwd(), "uploads", "test_sample.csv");

  beforeAll(async () => {
    // Generate sample CSV with header, 25 valid rows, and 2 malformed rows
    const lines = [
      "Column 1,Column 2,Column 3,Column 4,Column 5,Column 6,Column 7,Column 8,Column 9,Column 10,Column 11,Column 12,Column 13",
    ];

    for (let i = 1; i <= 25; i++) {
      lines.push(
        `2026-05-15T08:00:00Z,UP3 PALEMBANG,ULP RIVAI,Pengulas ${i},2026-05-15,https://drive.google.com/test_${i},V5.2.79,Pengulas Asli ${i},Pelanggan,Catatan ${i},TIDAK,1,Valid`
      );
    }

    // Add 2 malformed rows (missing UP3 or ULP)
    lines.push("2026-05-15T08:00:00Z,,,Pengulas Rusak 1,2026-05-15,,,,,,,");
    lines.push("2026-05-15T08:00:00Z,UP3 PALEMBANG,,Pengulas Rusak 2,2026-05-15,,,,,,,");

    await fs.promises.writeFile(testCsvPath, lines.join("\n"));
  });

  afterAll(async () => {
    if (fs.existsSync(testCsvPath)) {
      await fs.promises.unlink(testCsvPath);
    }
  });

  it("should process CSV stream in memory-safe batches and isolate error rows", async () => {
    const receivedBatches: RawReviewRow[][] = [];
    const receivedErrors: any[] = [];

    const result = await parseCsvStream(testCsvPath, {
      batchSize: 10,
      onBatch: async (batch) => {
        receivedBatches.push(batch);
      },
      onError: async (err) => {
        receivedErrors.push(err);
      },
    });

    expect(result.totalProcessed).toBe(25);
    expect(result.totalErrors).toBe(2);

    // 25 rows with batchSize 10 means 3 batches (10, 10, 5)
    expect(receivedBatches.length).toBe(3);
    expect(receivedBatches[0].length).toBe(10);
    expect(receivedBatches[1].length).toBe(10);
    expect(receivedBatches[2].length).toBe(5);

    // Verify first row mapping
    const first = receivedBatches[0][0];
    expect(first.up3Name).toBe("UP3 PALEMBANG");
    expect(first.ulpName).toBe("ULP RIVAI");
    expect(first.playstoreReviewerName).toBe("Pengulas 1");
    expect(first.validationStatus).toBe("APPROVED");
    expect(first.isDuplicate).toBe(false);

    // Verify error isolation
    expect(receivedErrors.length).toBe(2);
    expect(receivedErrors[0].reason).toContain("Kolom wajib");
  });
});
