import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { parseCsvStream, RawReviewRow } from "@/lib/parsers/csvStreamParser";
import fs from "fs";
import path from "path";

describe("Resumable Migration Parser - startRowNumber Fast-Skip (Unit)", () => {
  const testCsvPath = path.join(process.cwd(), "uploads", "test_resumable_sample.csv");

  beforeAll(async () => {
    // Generate CSV with header on line 1, and 30 data rows on lines 2..31
    const lines = [
      "Column 1,Column 2,Column 3,Column 4,Column 5,Column 6,Column 7,Column 8,Column 9,Column 10,Column 11,Column 12,Column 13",
    ];

    for (let i = 1; i <= 30; i++) {
      lines.push(
        `2026-05-15T08:00:00Z,UP3 PALEMBANG,ULP RIVAI,Pengulas ${i},2026-05-15,https://drive.google.com/test_${i},V5.2.79,Pengulas Asli ${i},Pelanggan,Catatan ${i},TIDAK,1,Valid`
      );
    }

    await fs.promises.writeFile(testCsvPath, lines.join("\n"));
  });

  afterAll(async () => {
    if (fs.existsSync(testCsvPath)) {
      await fs.promises.unlink(testCsvPath);
    }
  });

  it("should parse all 30 data rows when startRowNumber is not provided", async () => {
    const receivedRows: RawReviewRow[] = [];

    const result = await parseCsvStream(testCsvPath, {
      batchSize: 50,
      onBatch: async (batch) => {
        receivedRows.push(...batch);
      },
    });

    expect(result.totalProcessed).toBe(30);
    expect(receivedRows.length).toBe(30);
    // Line 1 is header, data rows start at line 2 and end at line 31
    expect(receivedRows[0].rowNumber).toBe(2);
    expect(receivedRows[0].playstoreReviewerName).toBe("Pengulas 1");
    expect(receivedRows[29].rowNumber).toBe(31);
    expect(receivedRows[29].playstoreReviewerName).toBe("Pengulas 30");
  });

  it("should fast-skip already processed rows when startRowNumber is provided", async () => {
    const receivedRows: RawReviewRow[] = [];

    // Skip rows through line 16 (header + first 15 data rows), resuming from line 17 (Pengulas 16)
    const result = await parseCsvStream(testCsvPath, {
      batchSize: 50,
      startRowNumber: 16,
      onBatch: async (batch) => {
        receivedRows.push(...batch);
      },
    });

    expect(result.totalProcessed).toBe(15);
    expect(receivedRows.length).toBe(15);
    // First received row corresponds to line 17
    expect(receivedRows[0].rowNumber).toBe(17);
    expect(receivedRows[0].playstoreReviewerName).toBe("Pengulas 16");
    expect(receivedRows[14].rowNumber).toBe(31);
    expect(receivedRows[14].playstoreReviewerName).toBe("Pengulas 30");
  });

  it("should return zero rows when startRowNumber is >= total file lines", async () => {
    const receivedRows: RawReviewRow[] = [];

    const result = await parseCsvStream(testCsvPath, {
      batchSize: 50,
      startRowNumber: 31,
      onBatch: async (batch) => {
        receivedRows.push(...batch);
      },
    });

    expect(result.totalProcessed).toBe(0);
    expect(receivedRows.length).toBe(0);
  });
});
