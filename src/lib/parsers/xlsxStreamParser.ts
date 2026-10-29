import ExcelJS from "exceljs";
import { RawReviewRow, parseExcelOrStandardDate } from "./csvStreamParser";

export function isGhostOrBlankXlsxRow(values: any[]): boolean {
  if (!values || values.length === 0) return true;

  // In ExcelJS, values is 1-indexed (index 0 is undefined or null).
  // Column 1 = Timestamp, Column 2 = UP3, Column 3 = ULP, Column 4 = Reviewer Name
  const c1 = String(values[1] || "").trim();
  const c2 = String(values[2] || "").trim();
  const c3 = String(values[3] || "").trim();
  const c4 = String(values[4] || "").trim();

  return !c1 && !c2 && !c3 && !c4;
}

export async function parseXlsxStream(
  filePath: string,
  options: {
    sheetName?: string;
    batchSize?: number;
    maxRows?: number;
    startRowNumber?: number;
    maxConsecutiveEmptyRows?: number;
    onBatch: (batch: RawReviewRow[]) => Promise<void>;
    onError?: (error: { rowNumber: number; raw: any; reason: string }) => Promise<void>;
    onProgress?: (processed: number) => Promise<void>;
  }
): Promise<{ totalProcessed: number; totalErrors: number }> {
  const targetSheetName = options.sheetName || "Form Responses 1";
  const batchSize = options.batchSize || 1000;
  const maxConsecutiveEmptyRows = options.maxConsecutiveEmptyRows || 10;
  let batch: RawReviewRow[] = [];
  let totalProcessed = 0;
  let totalErrors = 0;
  let currentRowNumber = 0;
  let consecutiveEmptyRows = 0;

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: "emit",
    sharedStrings: "cache",
    worksheets: "emit",
  });

  for await (const worksheetReader of workbookReader) {
    const sheet = worksheetReader as any;
    if (sheet.name !== targetSheetName) {
      continue;
    }

    for await (const row of worksheetReader) {
      currentRowNumber++;

      // Skip header row
      if (currentRowNumber === 1) {
        continue;
      }

      // Fast-skip already processed rows if resuming from a checkpoint
      if (options.startRowNumber && currentRowNumber <= options.startRowNumber) {
        continue;
      }

      try {
        const values = row.values as any[];
        if (!values || values.length < 4 || isGhostOrBlankXlsxRow(values)) {
          consecutiveEmptyRows++;
          if (consecutiveEmptyRows >= maxConsecutiveEmptyRows) {
            break;
          }
          continue;
        }

        // Reset consecutive empty rows counter since we encountered a non-empty row
        consecutiveEmptyRows = 0;

        const up3 = String(values[2] || "").trim();
        const ulp = String(values[3] || "").trim();
        const playstoreName = String(values[4] || "").trim();

        if (!up3 || !ulp || !playstoreName) {
          totalErrors++;
          if (options.onError) {
            await options.onError({
              rowNumber: currentRowNumber,
              raw: JSON.stringify(values.slice(1, 14)),
              reason: "Kolom wajib (UP3, ULP, atau Nama Pengulas) kosong",
            });
          }
          continue;
        }

        // Handle duplicate column (formula object or string)
        let dupVal = values[11];
        if (typeof dupVal === "object" && dupVal !== null && "result" in dupVal) {
          dupVal = dupVal.result;
        }
        const isDuplicate =
          String(dupVal || "").toUpperCase() === "YA" ||
          String(dupVal || "") === "1" ||
          String(dupVal || "").toUpperCase() === "TRUE";

        // Handle validation status
        let valStatus = values[12];
        if (typeof valStatus === "object" && valStatus !== null && "result" in valStatus) {
          valStatus = valStatus.result;
        }
        let validationStatus: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW" = "PENDING";
        const valStatusStr = String(valStatus || "").toUpperCase();
        if (valStatusStr === "1" || valStatusStr === "TRUE" || valStatusStr === "APPROVED") {
          validationStatus = "APPROVED";
        } else if (valStatusStr === "0" || valStatusStr === "FALSE" || valStatusStr === "REJECTED") {
          validationStatus = "REJECTED";
        }

        const parsedRow: RawReviewRow = {
          rowNumber: currentRowNumber,
          timestamp: parseExcelOrStandardDate(values[1]),
          up3Name: up3,
          ulpName: ulp,
          playstoreReviewerName: playstoreName,
          entryDate: parseExcelOrStandardDate(values[5] || values[1]),
          evidenceImagePath: String(values[6] || "").trim(),
          versionName: String(values[7] || "V5.2.79").trim(),
          originalReviewerName: String(values[8] || playstoreName).trim(),
          reviewerCategory: String(values[9] || "Pelanggan").trim(),
          fieldNotes: String(values[10] || "").trim(),
          isDuplicate,
          validationStatus,
          reviewRemarks: String(values[13] || "").trim(),
        };

        batch.push(parsedRow);
        totalProcessed++;

        if (batch.length >= batchSize) {
          const toProcess = [...batch];
          batch = [];
          await options.onBatch(toProcess);

          if (options.onProgress) {
            await options.onProgress(totalProcessed);
          }
        }

        if (options.maxRows && totalProcessed >= options.maxRows) {
          break;
        }
      } catch (err: any) {
        totalErrors++;
        if (options.onError) {
          await options.onError({
            rowNumber: currentRowNumber,
            raw: JSON.stringify(row.values),
            reason: err.message || "Gagal memproses baris Excel",
          });
        }
      }
    }
  }

  // Final remaining batch
  if (batch.length > 0) {
    const toProcess = [...batch];
    batch = [];
    await options.onBatch(toProcess);
    if (options.onProgress) {
      await options.onProgress(totalProcessed);
    }
  }

  return { totalProcessed, totalErrors };
}
