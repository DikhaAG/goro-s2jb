import fs from "fs";
import * as csv from "fast-csv";

export interface RawReviewRow {
  rowNumber: number;
  timestamp: Date;
  up3Name: string;
  ulpName: string;
  playstoreReviewerName: string;
  entryDate: Date;
  evidenceImagePath: string;
  versionName: string;
  originalReviewerName: string;
  reviewerCategory: string;
  fieldNotes: string;
  isDuplicate: boolean;
  validationStatus: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  reviewRemarks: string;
}

export function parseExcelOrStandardDate(val: any): Date {
  if (val instanceof Date) return val;
  if (!val) return new Date();

  const num = Number(val);
  if (!isNaN(num) && num > 20000 && num < 80000) {
    // Excel serial date formula
    const ms = (num - 25569) * 86400 * 1000;
    return new Date(ms);
  }

  const str = String(val).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return new Date();
}

export async function parseCsvStream(
  filePath: string,
  options: {
    batchSize?: number;
    onBatch: (batch: RawReviewRow[]) => Promise<void>;
    onError?: (error: { rowNumber: number; raw: any; reason: string }) => Promise<void>;
    onProgress?: (processed: number) => Promise<void>;
  }
): Promise<{ totalProcessed: number; totalErrors: number }> {
  const batchSize = options.batchSize || 1000;
  let batch: RawReviewRow[] = [];
  let totalProcessed = 0;
  let totalErrors = 0;
  let currentRowNumber = 0;

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);

    const csvStream = csv
      .parse({ headers: false, trim: true, ignoreEmpty: true })
      .on("error", (error) => {
        console.error("CSV Stream parsing error:", error);
        reject(error);
      })
      .on("data", async (row: string[]) => {
        currentRowNumber++;

        // Skip header row if first column is "Column 1" or "Timestamp"
        if (
          currentRowNumber === 1 &&
          (row[0]?.toLowerCase().includes("column") || row[0]?.toLowerCase().includes("timestamp"))
        ) {
          return;
        }

        try {
          // Validate minimum required columns
          if (!row[1] || !row[2] || !row[3]) {
            totalErrors++;
            if (options.onError) {
              await options.onError({
                rowNumber: currentRowNumber,
                raw: JSON.stringify(row),
                reason: "Kolom wajib (UP3, ULP, atau Nama Pengulas) kosong",
              });
            }
            return;
          }

          const isDuplicate =
            row[10]?.trim().toUpperCase() === "YA" ||
            row[10]?.trim() === "1" ||
            row[10]?.trim().toUpperCase() === "TRUE";

          let validationStatus: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW" = "PENDING";
          const statusCol = row[11]?.trim().toUpperCase();
          if (statusCol === "1" || statusCol === "TRUE" || statusCol === "APPROVED") {
            validationStatus = "APPROVED";
          } else if (statusCol === "0" || statusCol === "FALSE" || statusCol === "REJECTED") {
            validationStatus = "REJECTED";
          }

          const parsedRow: RawReviewRow = {
            rowNumber: currentRowNumber,
            timestamp: parseExcelOrStandardDate(row[0]),
            up3Name: row[1]?.trim() || "",
            ulpName: row[2]?.trim() || "",
            playstoreReviewerName: row[3]?.trim() || "",
            entryDate: parseExcelOrStandardDate(row[4] || row[0]),
            evidenceImagePath: row[5]?.trim() || "",
            versionName: row[6]?.trim() || "V5.2.79",
            originalReviewerName: row[7]?.trim() || row[3]?.trim() || "",
            reviewerCategory: row[8]?.trim() || "Pelanggan",
            fieldNotes: row[9]?.trim() || "",
            isDuplicate,
            validationStatus,
            reviewRemarks: row[12]?.trim() || "",
          };

          batch.push(parsedRow);
          totalProcessed++;

          // When batch is full, pause stream, process batch, then resume
          if (batch.length >= batchSize) {
            csvStream.pause();
            const toProcess = [...batch];
            batch = [];
            await options.onBatch(toProcess);

            if (options.onProgress) {
              await options.onProgress(totalProcessed);
            }
            csvStream.resume();
          }
        } catch (err: any) {
          totalErrors++;
          if (options.onError) {
            await options.onError({
              rowNumber: currentRowNumber,
              raw: JSON.stringify(row),
              reason: err.message || "Gagal memproses baris CSV",
            });
          }
        }
      })
      .on("end", async () => {
        try {
          // Process final remaining items in batch
          if (batch.length > 0) {
            const toProcess = [...batch];
            batch = [];
            await options.onBatch(toProcess);
            if (options.onProgress) {
              await options.onProgress(totalProcessed);
            }
          }
          resolve({ totalProcessed, totalErrors });
        } catch (err) {
          reject(err);
        }
      });

    stream.pipe(csvStream);
  });
}
