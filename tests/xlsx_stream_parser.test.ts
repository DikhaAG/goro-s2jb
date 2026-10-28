import { describe, it, expect } from "vitest";
import { parseXlsxStream } from "@/lib/parsers/xlsxStreamParser";
import path from "path";

describe("Streaming XLSX Parser (src/lib/parsers/xlsxStreamParser.ts)", () => {
  const referenceXlsxPath = path.resolve(
    process.cwd(),
    "docs/GORO S2JB 2026 (Jawaban).xlsx"
  );

  it("should stream rows from reference Excel Form Responses 1 without loading whole sheet into memory", async () => {
    const batches: any[] = [];

    const result = await parseXlsxStream(referenceXlsxPath, {
      sheetName: "Form Responses 1",
      batchSize: 5,
      maxRows: 15,
      onBatch: async (batch) => {
        batches.push(batch);
      },
    });

    expect(result.totalProcessed).toBeGreaterThanOrEqual(15);
    expect(batches.length).toBeGreaterThanOrEqual(3);

    const firstRow = batches[0][0];
    expect(firstRow.up3Name).toBe("UP3 OGAN ILIR");
    expect(firstRow.ulpName).toBe("ULP TUGU MULYO");
    expect(firstRow.playstoreReviewerName).toBe("Rudi Tabuci");
    expect(firstRow.versionName).toBe("V5.2.79");
    expect(firstRow.validationStatus).toBe("APPROVED");
    expect(firstRow.entryDate).toBeInstanceOf(Date);
  });
});
