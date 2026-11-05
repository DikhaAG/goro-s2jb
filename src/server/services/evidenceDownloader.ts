import { saveEvidenceFile } from "@/lib/storage";
import fs from "fs";
import { redis } from "@/lib/redis";

// Cache for previously downloaded external file IDs (avoids repeated network calls)
const gdriveCache = new Map<string, { relativePath: string; absolutePath: string }>();

export interface DownloaderNetworkMetrics {
  totalRequests: number;
  successfulStreams: number;
  failedStreams: number;
  totalBytesStreamed: number;
  averageLatencyMs: number;
  candidateHits: {
    endpointUc: number;
    endpointUserContent: number;
    endpointLh3: number;
    directUrl: number;
  };
  rejectionReasons: {
    htmlResponse: number;
    invalidMagicBytes: number;
    timeoutAbort: number;
    httpError: number;
  };
  cacheStats: {
    hits: number;
    misses: number;
    cachedEntriesCount: number;
  };
  lastIncident?: {
    timestamp: string;
    url: string;
    error: string;
  };
}

let totalLatencyAccumulator = 0;

let networkMetrics: DownloaderNetworkMetrics = {
  totalRequests: 0,
  successfulStreams: 0,
  failedStreams: 0,
  totalBytesStreamed: 0,
  averageLatencyMs: 0,
  candidateHits: {
    endpointUc: 0,
    endpointUserContent: 0,
    endpointLh3: 0,
    directUrl: 0,
  },
  rejectionReasons: {
    htmlResponse: 0,
    invalidMagicBytes: 0,
    timeoutAbort: 0,
    httpError: 0,
  },
  cacheStats: {
    hits: 0,
    misses: 0,
    cachedEntriesCount: 0,
  },
};

function recordCandidateHit(candidateUrl: string) {
  if (candidateUrl.includes("drive.google.com/uc")) {
    networkMetrics.candidateHits.endpointUc++;
  } else if (candidateUrl.includes("drive.usercontent.google.com")) {
    networkMetrics.candidateHits.endpointUserContent++;
  } else if (candidateUrl.includes("lh3.googleusercontent.com")) {
    networkMetrics.candidateHits.endpointLh3++;
  } else {
    networkMetrics.candidateHits.directUrl++;
  }
}

export const REDIS_GDOWNLOADER_METRICS_KEY = "telemetry:gdrive_downloader";

let syncTimeout: NodeJS.Timeout | null = null;

/**
 * Persists live Google Drive downloader telemetry to Redis hash/string.
 * Enables zero-delay observability across different Node.js processes.
 */
export async function syncDownloaderMetricsToRedis(): Promise<void> {
  try {
    if (redis && (redis.status === "ready" || redis.status === "connect")) {
      const data = getDownloaderNetworkMetrics();
      await redis.set(REDIS_GDOWNLOADER_METRICS_KEY, JSON.stringify(data));
    }
  } catch {
    // Non-critical telemetry persistence fallback
  }
}

/**
 * Schedules non-blocking debounced sync to Redis.
 */
export function scheduleDownloaderMetricsSync(): void {
  if (syncTimeout) return;
  syncTimeout = setTimeout(async () => {
    syncTimeout = null;
    await syncDownloaderMetricsToRedis();
  }, 1000);
}

/**
 * Retrieves latest downloader metrics from Redis, falling back to local memory.
 */
export async function fetchDownloaderNetworkMetricsFromRedis(): Promise<DownloaderNetworkMetrics> {
  try {
    if (redis && (redis.status === "ready" || redis.status === "connect")) {
      const raw = await redis.get(REDIS_GDOWNLOADER_METRICS_KEY);
      if (raw) {
        return JSON.parse(raw) as DownloaderNetworkMetrics;
      }
    }
  } catch {
    // Fall back to local memory if Redis call fails
  }
  return getDownloaderNetworkMetrics();
}

export function getDownloaderNetworkMetrics(): DownloaderNetworkMetrics {
  return {
    ...networkMetrics,
    candidateHits: { ...networkMetrics.candidateHits },
    rejectionReasons: { ...networkMetrics.rejectionReasons },
    cacheStats: {
      ...networkMetrics.cacheStats,
      cachedEntriesCount: gdriveCache.size,
    },
    lastIncident: networkMetrics.lastIncident ? { ...networkMetrics.lastIncident } : undefined,
  };
}

export function resetDownloaderMetrics(): void {
  totalLatencyAccumulator = 0;
  networkMetrics = {
    totalRequests: 0,
    successfulStreams: 0,
    failedStreams: 0,
    totalBytesStreamed: 0,
    averageLatencyMs: 0,
    candidateHits: {
      endpointUc: 0,
      endpointUserContent: 0,
      endpointLh3: 0,
      directUrl: 0,
    },
    rejectionReasons: {
      htmlResponse: 0,
      invalidMagicBytes: 0,
      timeoutAbort: 0,
      httpError: 0,
    },
    cacheStats: {
      hits: 0,
      misses: 0,
      cachedEntriesCount: gdriveCache.size,
    },
  };
}

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

/**
 * Resolves candidate download URLs for Google Drive or direct external resources.
 */
export function getCandidateImageUrls(url: string): string[] {
  if (!url || typeof url !== "string") return [];
  const trimmed = url.trim();
  const fileId = extractGoogleDriveFileId(trimmed);
  if (fileId) {
    return [
      `https://drive.google.com/uc?id=${fileId}&export=download`,
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`,
      `https://lh3.googleusercontent.com/d/${fileId}`,
    ];
  }
  return [trimmed];
}

export interface DownloadResult {
  success: boolean;
  relativePath?: string;
  absolutePath?: string;
  error?: string;
}

/**
 * Fetches an image buffer directly from an external URL (Google Drive or HTTP)
 * in memory without persisting it to local disk (zero disk footprint for migration data).
 */
export async function streamEvidenceImageBuffer(
  urlOrPath: string,
  timeoutMs: number = 15000
): Promise<{ success: boolean; buffer?: Buffer; mimeType?: string; error?: string }> {
  networkMetrics.totalRequests++;
  const requestStart = Date.now();

  if (!urlOrPath || typeof urlOrPath !== "string") {
    networkMetrics.failedStreams++;
    return { success: false, error: "Tautan gambar kosong" };
  }

  const trimmed = urlOrPath.trim();
  if (!isExternalUrl(trimmed)) {
    networkMetrics.failedStreams++;
    return { success: false, error: "Bukan tautan URL eksternal" };
  }

  const candidateUrls = getCandidateImageUrls(trimmed);

  for (const candidate of candidateUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(candidate, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        networkMetrics.rejectionReasons.httpError++;
        continue;
      }

      const contentType = res.headers.get("content-type")?.toLowerCase() || "";
      if (contentType.includes("text/html")) {
        networkMetrics.rejectionReasons.htmlResponse++;
        continue;
      }

      const arrayBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      if (buffer.length === 0) {
        networkMetrics.rejectionReasons.invalidMagicBytes++;
        continue;
      }

      let detectedMimeType: string | null = null;
      if (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      ) {
        detectedMimeType = "image/jpeg";
      } else if (
        buffer.length >= 4 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        detectedMimeType = "image/png";
      } else if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      ) {
        detectedMimeType = "image/webp";
      }

      if (!detectedMimeType) {
        // Reject non-image response bodies (e.g. error texts, non-image binaries)
        networkMetrics.rejectionReasons.invalidMagicBytes++;
        continue;
      }

      networkMetrics.successfulStreams++;
      networkMetrics.totalBytesStreamed += buffer.length;
      recordCandidateHit(candidate);

      const latency = Date.now() - requestStart;
      totalLatencyAccumulator += latency;
      networkMetrics.averageLatencyMs = Math.round(
        totalLatencyAccumulator / (networkMetrics.successfulStreams + networkMetrics.failedStreams || 1)
      );

      scheduleDownloaderMetricsSync();

      return {
        success: true,
        buffer,
        mimeType: detectedMimeType,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError" || controller.signal.aborted) {
        networkMetrics.rejectionReasons.timeoutAbort++;
      } else {
        networkMetrics.rejectionReasons.httpError++;
      }
    }
  }

  networkMetrics.failedStreams++;
  const latency = Date.now() - requestStart;
  totalLatencyAccumulator += latency;
  networkMetrics.averageLatencyMs = Math.round(
    totalLatencyAccumulator / (networkMetrics.successfulStreams + networkMetrics.failedStreams || 1)
  );

  const errorMsg = `Gagal streaming gambar dari tautan Google Drive: ${trimmed}`;
  networkMetrics.lastIncident = {
    timestamp: new Date().toISOString(),
    url: trimmed,
    error: errorMsg,
  };

  scheduleDownloaderMetricsSync();

  return {
    success: false,
    error: errorMsg,
  };
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
  if (googleDriveFileId) {
    if (gdriveCache.has(googleDriveFileId)) {
      networkMetrics.cacheStats.hits++;
      const cached = gdriveCache.get(googleDriveFileId)!;
      if (fs.existsSync(cached.absolutePath)) {
        return {
          success: true,
          relativePath: cached.relativePath,
          absolutePath: cached.absolutePath,
        };
      }
    } else {
      networkMetrics.cacheStats.misses++;
    }
  }

  // Candidate URLs for Google Drive or direct download
  const candidateUrls = getCandidateImageUrls(trimmed);

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

      networkMetrics.cacheStats.cachedEntriesCount = gdriveCache.size;
      networkMetrics.totalBytesStreamed += buffer.length;
      recordCandidateHit(downloadUrl);
      scheduleDownloaderMetricsSync();

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
