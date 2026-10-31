import { saveEvidenceFile } from "@/lib/storage";
import fs from "fs";

// Cache for previously downloaded external file IDs (avoids repeated network calls)
const gdriveCache = new Map<string, { relativePath: string; absolutePath: string }>();

/**
 * Extracts Google Drive file ID from various URL patterns.
 * Supports:
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/file/d/FILE_ID/view...
 * - https://drive.google.com/uc?id=FILE_ID...
 * - https://lh3.googleusercontent.com/d/FILE_ID
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  // 1. Param pattern: ?id=... or &id=...
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  // 2. Path pattern: /file/d/... or /d/...
  const fileDMatch = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  return null;
}

/**
 * Checks if a path is an external HTTP/HTTPS URL.
 */
export function isExternalUrl(pathOrUrl: string): boolean {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return false;
  return pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
}

export interface DownloadResult {
  success: boolean;
  relativePath?: string;
  absolutePath?: string;
  error?: string;
}

/**
 * Downloads an evidence image from an external URL (Google Drive or generic HTTP URL)
 * and persists it locally into the date-based upload directory using saveEvidenceFile.
 */
export async function downloadEvidenceImage(
  urlOrPath: string,
  entryDate: Date = new Date(),
  timeoutMs: number = 15000
): Promise<DownloadResult> {
  if (!urlOrPath || typeof urlOrPath !== "string") {
    return { success: false, error: "Tautan gambar kosong" };
  }

  const trimmed = urlOrPath.trim();

  // If already a local relative path, do nothing
  if (!isExternalUrl(trimmed)) {
    return { success: true, relativePath: trimmed };
  }

  const googleDriveFileId = extractGoogleDriveFileId(trimmed);

  // Check in-memory cache first
  if (googleDriveFileId && gdriveCache.has(googleDriveFileId)) {
    const cached = gdriveCache.get(googleDriveFileId)!;
    if (fs.existsSync(cached.absolutePath)) {
      return {
        success: true,
        relativePath: cached.relativePath,
        absolutePath: cached.absolutePath,
      };
    }
  }

  // Candidate URLs for Google Drive or direct download
  const candidateUrls: string[] = googleDriveFileId
    ? [
        `https://drive.google.com/uc?id=${googleDriveFileId}&export=download`,
        `https://drive.usercontent.google.com/download?id=${googleDriveFileId}&export=download&authuser=0`,
        `https://lh3.googleusercontent.com/d/${googleDriveFileId}`,
      ]
    : [trimmed];

  for (const downloadUrl of candidateUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(downloadUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      // If it returned an HTML page instead of an image (e.g. Google Drive access denied page)
      if (contentType.includes("text/html")) {
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        continue;
      }

      // Check magic bytes to confirm valid image format
      let mimeType = "image/jpeg";
      let ext = ".jpg";

      if (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      ) {
        mimeType = "image/jpeg";
        ext = ".jpg";
      } else if (
        buffer.length >= 4 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        mimeType = "image/png";
        ext = ".png";
      } else if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      ) {
        mimeType = "image/webp";
        ext = ".webp";
      } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        mimeType = "image/jpeg";
        ext = ".jpg";
      } else if (contentType.includes("png")) {
        mimeType = "image/png";
        ext = ".png";
      } else if (contentType.includes("webp")) {
        mimeType = "image/webp";
        ext = ".webp";
      } else {
        // Unknown or non-image stream
        continue;
      }

      const originalFilename = googleDriveFileId
        ? `gdrive_${googleDriveFileId}${ext}`
        : `imported_${Date.now()}${ext}`;

      const saved = await saveEvidenceFile(buffer, originalFilename, mimeType, entryDate);

      if (googleDriveFileId) {
        gdriveCache.set(googleDriveFileId, {
          relativePath: saved.relativePath,
          absolutePath: saved.absolutePath,
        });
      }

      return {
        success: true,
        relativePath: saved.relativePath,
        absolutePath: saved.absolutePath,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      // Try next candidate URL
    }
  }

  return {
    success: false,
    error: `Gagal mengunduh gambar dari tautan eksternal: ${trimmed}`,
  };
}
