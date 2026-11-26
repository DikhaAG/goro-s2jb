import fs from "fs";
import * as csv from "fast-csv";
import ExcelJS from "exceljs";
import type { CsvExportReviewRow, RawReviewRow, StopSignal } from "./types";

export const MIGRATION_CSV_HEADERS = [
  "Timestamp",
  "UP3",
  "ULP",
  "Nama Pengulas Play Store",
  "Tanggal Masuk",
  "Tautan Bukti Gambar",
  "Versi Aplikasi",
  "Nama Pengulas Asli",
  "Kategori Pengulas",
  "Catatan Lapangan",
  "Duplikasi",
  "Status Validasi",
  "Catatan Review",
] as const;

function unwrapCellValue(val: unknown): unknown {
  if (typeof val === "object" && val !== null && "result" in val) {
    return (val as { result: unknown }).result;
  }
  return val;
}

function cellText(val: unknown): string {
  const unwrapped = unwrapCellValue(val);
  if (unwrapped === null || unwrapped === undefined) return "";
  return String(unwrapped).trim();
}

/**
 * Parses Excel serial dates, ISO strings, Indonesian DD/MM/YYYY dates, and Google Form M/D/YYYY timestamps.
 */
export function parseExcelOrStandardDate(val: unknown): Date {
  const unwrapped = unwrapCellValue(val);
  if (unwrapped instanceof Date) return unwrapped;
  if (!unwrapped) return new Date();

  const num = Number(unwrapped);
  if (!Number.isNaN(num) && num > 20000 && num < 80000) {
    const ms = (num - 25569) * 86400 * 1000;
    return new Date(ms);
  }

  const str = String(unwrapped).trim();

  // 1. ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (isoMatch) {
    const [, y, m, d, hh, mm, ss] = isoMatch;
    return new Date(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      hh ? parseInt(hh, 10) : 0,
      mm ? parseInt(mm, 10) : 0,
      ss ? parseInt(ss, 10) : 0
    );
  }

  // 2. Date only: DD/MM/YYYY or D/M/YYYY (Indonesian Google Sheets date format)
  const dateOnlyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dateOnlyMatch) {
    const p1 = parseInt(dateOnlyMatch[1], 10);
    const p2 = parseInt(dateOnlyMatch[2], 10);
    const year = parseInt(dateOnlyMatch[3], 10);

    let day: number;
    let month: number;
    if (p1 > 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      month = p1;
      day = p2;
    } else {
      day = p1;
      month = p2;
    }
    return new Date(year, month - 1, day);
  }

  // 3. Date with time: e.g. 7/2/2026 11:02:22 or 25/7/2026 11:02:22
  const dateTimeMatch = str.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
  );
  if (dateTimeMatch) {
    const p1 = parseInt(dateTimeMatch[1], 10);
    const p2 = parseInt(dateTimeMatch[2], 10);
    const year = parseInt(dateTimeMatch[3], 10);
    const hh = parseInt(dateTimeMatch[4], 10);
    const mm = parseInt(dateTimeMatch[5], 10);
    const ss = dateTimeMatch[6] ? parseInt(dateTimeMatch[6], 10) : 0;

    let day: number;
    let month: number;
    if (p1 > 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      month = p1;
      day = p2;
    } else {
      // Google Sheets default timestamp format is M/D/YYYY
      month = p1;
      day = p2;
    }
    return new Date(year, month - 1, day, hh, mm, ss);
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return new Date();
}

/**
 * Detects blank or formula-residue ghost rows (where Timestamp, UP3, ULP, and Reviewer Name are all empty).
 */
export function isGhostOrBlankRow(cells: unknown[]): boolean {
  if (!cells || cells.length === 0) return true;
  if (cells.every((c) => cellText(c) === "")) return true;

  const c0 = cellText(cells[0]);
  const c1 = cellText(cells[1]);
  const c2 = cellText(cells[2]);
  const c3 = cellText(cells[3]);

  return !c0 && !c1 && !c2 && !c3;
}

/**
 * Single canonical 13-column spreadsheet row normalizer shared across CSV and XLSX ingestion.
 */
export function normalizeSpreadsheetRow(
  rowNumber: number,
  cells: unknown[]
):
  | { ok: true; row: RawReviewRow }
  | { ok: false; error: { rowNumber: number; raw: string; reason: string } } {
  const up3Name = cellText(cells[1]);
  const ulpName = cellText(cells[2]);
  const playstoreReviewerName = cellText(cells[3]);

  if (!up3Name || !ulpName || !playstoreReviewerName) {
    return {
      ok: false,
      error: {
        rowNumber,
        raw: JSON.stringify(cells.slice(0, 13)),
        reason: "Kolom wajib (UP3, ULP, atau Nama Pengulas) kosong",
      },
    };
  }

  const dupUpper = cellText(cells[10]).toUpperCase();
  const isDuplicate = dupUpper === "YA" || dupUpper === "1" || dupUpper === "TRUE";

  const statusUpper = cellText(cells[11]).toUpperCase();
  let validationStatus: RawReviewRow["validationStatus"] = "PENDING";
  if (statusUpper === "1" || statusUpper === "TRUE" || statusUpper === "APPROVED") {
    validationStatus = "APPROVED";
  } else if (statusUpper === "0" || statusUpper === "FALSE" || statusUpper === "REJECTED") {
    validationStatus = "REJECTED";
  }

  return {
    ok: true,
    row: {
      rowNumber,
      timestamp: parseExcelOrStandardDate(cells[0]),
      up3Name,
      ulpName,
      playstoreReviewerName,
      entryDate: parseExcelOrStandardDate(cells[4] || cells[0]),
      evidenceImagePath: cellText(cells[5]),
      versionName: cellText(cells[6]) || "V5.2.79",
      originalReviewerName: cellText(cells[7]) || playstoreReviewerName,
      reviewerCategory: cellText(cells[8]) || "Pelanggan",
      fieldNotes: cellText(cells[9]),
      isDuplicate,
      validationStatus,
      reviewRemarks: cellText(cells[12]),
    },
  };
}

export interface StreamSpreadsheetOptions {
  ext: ".csv" | ".xlsx" | ".xls";
  sheetName?: string;
  batchSize?: number;
  maxRows?: number;
  startRowNumber?: number;
  maxConsecutiveEmptyRows?: number;
  checkControlSignal?: () => Promise<StopSignal>;
  onBatch: (batch: RawReviewRow[]) => Promise<void>;
  onError?: (error: { rowNumber: number; raw: string; reason: string }) => Promise<void>;
  onProgress?: (processed: number) => Promise<void>;
}

export interface StreamSpreadsheetResult {
  totalProcessed: number;
  totalErrors: number;
  stopSignal: StopSignal;
}

async function streamCsvFile(
  filePath: string,
  options: StreamSpreadsheetOptions
): Promise<StreamSpreadsheetResult> {
  const batchSize = options.batchSize || 1000;
  const maxConsecutiveEmptyRows = options.maxConsecutiveEmptyRows || 10;
  let batch: RawReviewRow[] = [];
  let totalProcessed = 0;
  let totalErrors = 0;
  let currentRowNumber = 0;
  let consecutiveEmptyRows = 0;
  let stopSignal: StopSignal = "CONTINUE";
  let isEarlyExit = false;

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("error", (streamErr) => {
      reject(streamErr);
    });

    const csvStream = csv
      .parse({ headers: false, trim: true, ignoreEmpty: true })
      .on("error", (error) => {
        reject(error);
      })
      .on("data", async (row: string[]) => {
        if (isEarlyExit) return;
        currentRowNumber++;

        if (options.startRowNumber && currentRowNumber <= options.startRowNumber) {
          return;
        }

        if (
          currentRowNumber === 1 &&
          (row[0]?.toLowerCase().includes("column") || row[0]?.toLowerCase().includes("timestamp"))
        ) {
          return;
        }

        if (isGhostOrBlankRow(row)) {
          consecutiveEmptyRows++;
          if (consecutiveEmptyRows >= maxConsecutiveEmptyRows) {
            isEarlyExit = true;
            csvStream.destroy();
            stream.destroy();

            try {
              if (batch.length > 0) {
                const toProcess = [...batch];
                batch = [];
                await options.onBatch(toProcess);
                if (options.onProgress) {
                  await options.onProgress(totalProcessed);
                }
              }
              resolve({ totalProcessed, totalErrors, stopSignal });
            } catch (err) {
              reject(err);
            }
          }
          return;
        }

        consecutiveEmptyRows = 0;

        try {
          const normalized = normalizeSpreadsheetRow(currentRowNumber, row);
          if (!normalized.ok) {
            totalErrors++;
            if (options.onError) {
              await options.onError(normalized.error);
            }
            return;
          }

          batch.push(normalized.row);
          totalProcessed++;

          if (batch.length >= batchSize || (options.maxRows && totalProcessed >= options.maxRows)) {
            csvStream.pause();

            if (options.checkControlSignal) {
              const signal = await options.checkControlSignal();
              if (signal !== "CONTINUE") {
                stopSignal = signal;
                isEarlyExit = true;
                csvStream.destroy();
                stream.destroy();
                resolve({ totalProcessed, totalErrors, stopSignal });
                return;
              }
            }

            const toProcess = [...batch];
            batch = [];
            await options.onBatch(toProcess);

            if (options.onProgress) {
              await options.onProgress(totalProcessed);
            }

            if (options.maxRows && totalProcessed >= options.maxRows) {
              isEarlyExit = true;
              csvStream.destroy();
              stream.destroy();
              resolve({ totalProcessed, totalErrors, stopSignal });
              return;
            }

            if (options.checkControlSignal) {
              const signal = await options.checkControlSignal();
              if (signal !== "CONTINUE") {
                stopSignal = signal;
                isEarlyExit = true;
                csvStream.destroy();
                stream.destroy();
                resolve({ totalProcessed, totalErrors, stopSignal });
                return;
              }
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
        if (isEarlyExit) return;
        try {
          if (batch.length > 0) {
            if (options.checkControlSignal) {
              const signal = await options.checkControlSignal();
              if (signal !== "CONTINUE") {
                resolve({ totalProcessed, totalErrors, stopSignal: signal });
                return;
              }
            }

            const toProcess = [...batch];
            batch = [];
            await options.onBatch(toProcess);
            if (options.onProgress) {
              await options.onProgress(totalProcessed);
            }
          }
          resolve({ totalProcessed, totalErrors, stopSignal });
        } catch (err) {
          reject(err);
        }
      });

    stream.pipe(csvStream);
  });
}

async function streamXlsxFile(
  filePath: string,
  options: StreamSpreadsheetOptions
): Promise<StreamSpreadsheetResult> {
  const targetSheetName = options.sheetName || "Form Responses 1";
  const batchSize = options.batchSize || 1000;
  const maxConsecutiveEmptyRows = options.maxConsecutiveEmptyRows || 10;
  let batch: RawReviewRow[] = [];
  let totalProcessed = 0;
  let totalErrors = 0;
  let currentRowNumber = 0;
  let consecutiveEmptyRows = 0;
  let stopSignal: StopSignal = "CONTINUE";

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

      if (currentRowNumber === 1) {
        continue;
      }

      if (options.startRowNumber && currentRowNumber <= options.startRowNumber) {
        continue;
      }

      try {
        const values = row.values as unknown[];
        // ExcelJS row.values is 1-indexed; slice(1) aligns it to 0-indexed 13-column layout
        const cells = Array.isArray(values) ? values.slice(1) : [];

        if (!values || values.length < 4 || isGhostOrBlankRow(cells)) {
          consecutiveEmptyRows++;
          if (consecutiveEmptyRows >= maxConsecutiveEmptyRows) {
            break;
          }
          continue;
        }

        consecutiveEmptyRows = 0;

        const normalized = normalizeSpreadsheetRow(currentRowNumber, cells);
        if (!normalized.ok) {
          totalErrors++;
          if (options.onError) {
            await options.onError(normalized.error);
          }
          continue;
        }

        batch.push(normalized.row);
        totalProcessed++;

        if (batch.length >= batchSize) {
          if (options.checkControlSignal) {
            const signal = await options.checkControlSignal();
            if (signal !== "CONTINUE") {
              stopSignal = signal;
              return { totalProcessed, totalErrors, stopSignal };
            }
          }

          const toProcess = [...batch];
          batch = [];
          await options.onBatch(toProcess);

          if (options.onProgress) {
            await options.onProgress(totalProcessed);
          }

          if (options.checkControlSignal) {
            const signal = await options.checkControlSignal();
            if (signal !== "CONTINUE") {
              stopSignal = signal;
              return { totalProcessed, totalErrors, stopSignal };
            }
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

  if (batch.length > 0) {
    if (options.checkControlSignal) {
      const signal = await options.checkControlSignal();
      if (signal !== "CONTINUE") {
        return { totalProcessed, totalErrors, stopSignal: signal };
      }
    }

    const toProcess = [...batch];
    batch = [];
    await options.onBatch(toProcess);
    if (options.onProgress) {
      await options.onProgress(totalProcessed);
    }
  }

  return { totalProcessed, totalErrors, stopSignal };
}

/**
 * Streams a migration CSV or XLSX file through the shared 13-column normalizer.
 */
export async function streamSpreadsheetRows(
  filePath: string,
  options: StreamSpreadsheetOptions
): Promise<StreamSpreadsheetResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Berkas migrasi tidak ditemukan: ${filePath}`);
  }

  if (options.ext === ".csv") {
    return streamCsvFile(filePath, options);
  }
  if (options.ext === ".xlsx" || options.ext === ".xls") {
    return streamXlsxFile(filePath, options);
  }
  throw new Error(`Format berkas migrasi tidak didukung: ${options.ext}`);
}

/**
 * Serializes RatingReview rows back into the canonical 13-column CSV format (UTF-8 BOM for Excel).
 */
export function serializeReviewsToCsv(reviews: CsvExportReviewRow[]): Buffer {
  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines: string[] = [MIGRATION_CSV_HEADERS.join(",")];
  for (const r of reviews) {
    lines.push(
      [
        escapeCsv(r.timestamp?.toISOString() || ""),
        escapeCsv(r.up3?.name || ""),
        escapeCsv(r.ulp?.name || ""),
        escapeCsv(r.playstoreReviewerName || ""),
        escapeCsv(r.entryDate?.toISOString() || ""),
        escapeCsv(r.evidenceImagePath || ""),
        escapeCsv(r.appVersion?.version || ""),
        escapeCsv(r.originalReviewerName || ""),
        escapeCsv(r.reviewerCategory || ""),
        escapeCsv(r.fieldNotes || ""),
        escapeCsv(r.isDuplicate ? "YA" : "TIDAK"),
        escapeCsv(r.validationStatus),
        escapeCsv(r.reviewRemarks || ""),
      ].join(",")
    );
  }

  return Buffer.from("\uFEFF" + lines.join("\r\n"), "utf-8");
}
