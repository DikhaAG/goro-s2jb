export type CsvCell = string | number | null | undefined;

/** Quotes every cell, so commas, quotes, and line breaks inside a value stay in one field. */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(formatCell).join(",")).join("\n");
}

function formatCell(cell: CsvCell): string {
  return `"${String(cell ?? "").replace(/"/g, '""')}"`;
}

/**
 * Downloads rows as a CSV file. A Blob URL keeps characters such as `#` intact,
 * which a data: URI would treat as the start of a fragment and cut off.
 * The leading BOM makes Excel open the file as UTF-8.
 */
export function downloadCsv(filename: string, rows: CsvCell[][]): void {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
