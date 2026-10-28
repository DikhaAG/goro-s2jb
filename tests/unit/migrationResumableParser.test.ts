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

  describe("parseExcelOrStandardDate edge case parsing", () => {
    it("should parse Indonesian date-only DD/MM/YYYY without flipping day and month", async () => {
      const { parseExcelOrStandardDate } = await import("@/lib/parsers/csvStreamParser");
      const d1 = parseExcelOrStandardDate("02/07/2026");
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getMonth()).toBe(6); // July (0-indexed)
      expect(d1.getDate()).toBe(2);

      const d2 = parseExcelOrStandardDate("25/07/2026");
      expect(d2.getFullYear()).toBe(2026);
      expect(d2.getMonth()).toBe(6);
      expect(d2.getDate()).toBe(25);
    });

    it("should parse Google Form timestamp M/D/YYYY H:mm:ss correctly", async () => {
      const { parseExcelOrStandardDate } = await import("@/lib/parsers/csvStreamParser");
      const dt = parseExcelOrStandardDate("7/2/2026 11:02:22");
      expect(dt.getFullYear()).toBe(2026);
      expect(dt.getMonth()).toBe(6); // July
      expect(dt.getDate()).toBe(2);
      expect(dt.getHours()).toBe(11);
      expect(dt.getMinutes()).toBe(2);
      expect(dt.getSeconds()).toBe(22);
    });

    it("should parse the exact user uploaded CSV sample without date drift or errors", async () => {
      const userSamplePath = path.join(process.cwd(), "uploads", "test_user_sample_fixture.csv");
      const csvContent = [
        "Column 1,Column 2,Column 3,Column 4,Column 5,Column 6,Column 7,Column 8,Column 9,Column 10,Column 11,Column 12,Column 13",
        "7/2/2026 11:02:22,UP3 OGAN ILIR,ULP TUGU MULYO,Rudi Tabuci,02/07/2026,https://drive.google.com/open?id=1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp,V5.2.79,rudi tabuci,Pelanggan,,TIDAK,TRUE,",
        "7/2/2026 13:31:48,UP3 PALEMBANG,ULP PANGKALAN BALAI,Miki,02/07/2026,https://drive.google.com/open?id=157qyJ-yAvYTTnPZcgM1qZ0cXpdfLrQqb,V5.2.79,Miki,Pelanggan,,TIDAK,TRUE,",
        "7/2/2026 13:33:40,UP3 PALEMBANG,ULP PANGKALAN BALAI,Eta,02/07/2026,https://drive.google.com/open?id=1--6-2bJppAlOrXKfNgkP9IzUmagITwk8,V5.2.79,Eta,Pelanggan,,TIDAK,TRUE,",
      ].join("\n");

      await fs.promises.writeFile(userSamplePath, csvContent);

      try {
        const received: RawReviewRow[] = [];
        const res = await parseCsvStream(userSamplePath, {
          onBatch: async (batch) => { received.push(...batch); },
        });

        expect(res.totalProcessed).toBe(3);
        expect(res.totalErrors).toBe(0);

        // Row 1
        expect(received[0].up3Name).toBe("UP3 OGAN ILIR");
        expect(received[0].ulpName).toBe("ULP TUGU MULYO");
        expect(received[0].playstoreReviewerName).toBe("Rudi Tabuci");
        expect(received[0].validationStatus).toBe("APPROVED");
        expect(received[0].isDuplicate).toBe(false);
        expect(received[0].entryDate.getFullYear()).toBe(2026);
        expect(received[0].entryDate.getMonth()).toBe(6); // July
        expect(received[0].entryDate.getDate()).toBe(2);

        // Row 2
        expect(received[1].playstoreReviewerName).toBe("Miki");
        expect(received[1].ulpName).toBe("ULP PANGKALAN BALAI");

        // Row 3
        expect(received[2].playstoreReviewerName).toBe("Eta");
        expect(received[2].ulpName).toBe("ULP PANGKALAN BALAI");
      } finally {
        if (fs.existsSync(userSamplePath)) {
          await fs.promises.unlink(userSamplePath);
        }
      }
    });
  });
});
