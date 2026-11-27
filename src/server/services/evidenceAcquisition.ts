import fs from "fs";
import net from "net";
import prisma from "@/lib/prisma";
import { resolveEvidencePath } from "@/lib/storage";
import { systemTelemetry } from "./systemTelemetry";
import type {
  DownloaderEndpoint,
  DownloaderRejectionReason,
  TelemetryEvent,
} from "./systemTelemetry";

export type FetchLike = typeof fetch;

export interface ExternalStreamResult {
  success: boolean;
  buffer?: Buffer;
  mimeType?: string;
  error?: string;
}

export type VerificationAcquisitionResult =
  | {
      ok: true;
      kind: "local_path";
      absolutePath: string;
      mimeType: string;
    }
  | {
      ok: true;
      kind: "buffer";
      buffer: Buffer;
      mimeType: string;
    }
  | {
      ok: false;
      kind: "missing_local" | "external_error";
      error: string;
    };

export type EvidenceBytesResult =
  | {
      ok: true;
      buffer: Buffer;
      mimeType: string;
    }
  | {
      ok: false;
      status: 403 | 404 | 502;
      error: string;
    };

export interface EvidenceAcquisitionDeps {
  fetchFn?: FetchLike;
  prisma?: Pick<typeof prisma, "ratingReview">;
  recordTelemetry?: (event: TelemetryEvent) => Promise<void>;
  timeoutMs?: number;
  streamExternal?: (urlOrPath: string) => Promise<ExternalStreamResult>;
  storageRoot?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((segment) => Number(segment));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;

  if (normalized.startsWith("::ffff:")) {
    const v4Part = normalized.slice("::ffff:".length);
    if (net.isIPv4(v4Part)) {
      return isBlockedIpv4(v4Part);
    }
    const hexParts = v4Part.split(":");
    if (hexParts.length === 2) {
      const hi = parseInt(hexParts[0], 16);
      const lo = parseInt(hexParts[1], 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isBlockedIpv4(ipv4);
      }
    }
  }

  const firstHextet = normalized.split(":")[0] || "";
  const firstVal = parseInt(firstHextet, 16);
  if (!Number.isNaN(firstVal)) {
    // fc00::/7 (ULA) and fe80::/10 (link-local)
    if ((firstVal & 0xfe00) === 0xfc00) return true;
    if ((firstVal & 0xffc0) === 0xfe80) return true;
  }

  return false;
}

/**
 * Blocks non-HTTP(S) schemes, embedded credentials, and loopback/private-network targets (SSRF).
 */
export function validateExternalEvidenceUrl(
  rawUrl: string
): { allowed: true; url: URL } | { allowed: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "Format URL eksternal tidak valid" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { allowed: false, reason: "Protokol URL eksternal tidak diizinkan" };
  }

  if (parsed.username || parsed.password) {
    return { allowed: false, reason: "Kredensial tertanam pada URL eksternal ditolak" };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) {
    return { allowed: false, reason: "Host URL eksternal kosong" };
  }

  if (
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return { allowed: false, reason: "Akses ke host lokal/internal diblokir" };
  }

  if (net.isIPv4(hostname) && isBlockedIpv4(hostname)) {
    return { allowed: false, reason: "Akses ke alamat IP privat/loopback diblokir" };
  }

  if (net.isIPv6(hostname) && isBlockedIpv6(hostname)) {
    return { allowed: false, reason: "Akses ke alamat IPv6 privat/loopback diblokir" };
  }

  return { allowed: true, url: parsed };
}

function classifyCandidateEndpoint(candidateUrl: string): DownloaderEndpoint {
  if (candidateUrl.includes("drive.google.com/uc")) return "endpointUc";
  if (candidateUrl.includes("drive.usercontent.google.com")) return "endpointUserContent";
  if (candidateUrl.includes("lh3.googleusercontent.com")) return "endpointLh3";
  return "directUrl";
}

/**
 * Extracts Google Drive file ID from open?id=, /file/d/, /d/, or uc?id= URLs.
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];

  const fileDMatch = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch?.[1]) return fileDMatch[1];

  return null;
}

/**
 * Checks whether an Eviden Ulasan reference points to an external HTTP/HTTPS URL.
 */
export function isExternalUrl(pathOrUrl: string): boolean {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return false;
  return pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
}

/**
 * Resolves candidate fetch URLs for Google Drive or direct external Eviden Ulasan links.
 */
export function getCandidateImageUrls(url: string): string[] {
  if (!url || typeof url !== "string") return [];
  const trimmed = url.trim();
  if (!trimmed) return [];

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

/**
 * Verifies image magic bytes directly from response body (JPEG, PNG, WebP).
 */
export function detectImageMimeFromBuffer(
  buffer: Buffer
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

async function emitTelemetry(
  deps: EvidenceAcquisitionDeps,
  event: TelemetryEvent
): Promise<void> {
  const recorder = deps.recordTelemetry ?? ((ev) => systemTelemetry.record(ev));
  await recorder(event).catch(() => {});
}

/**
 * Single zero-storage external fetch path shared by Verifikasi Eviden and HTTP proxy streaming.
 * Enforces SSRF guards, candidate endpoint failover, HTML rejection, magic-byte checks, and telemetry.
 */
export async function streamExternalEvidence(
  urlOrPath: string,
  deps: EvidenceAcquisitionDeps = {}
): Promise<ExternalStreamResult> {
  const requestStart = Date.now();
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = deps.fetchFn ?? globalThis.fetch;

  if (!urlOrPath || typeof urlOrPath !== "string") {
    await emitTelemetry(deps, {
      kind: "downloader_stream",
      outcome: "failure",
      latencyMs: Date.now() - requestStart,
    });
    return { success: false, error: "Tautan gambar kosong" };
  }

  const trimmed = urlOrPath.trim();
  if (!isExternalUrl(trimmed)) {
    await emitTelemetry(deps, {
      kind: "downloader_stream",
      outcome: "failure",
      latencyMs: Date.now() - requestStart,
    });
    return { success: false, error: "Bukan tautan URL eksternal" };
  }

  const initialGuard = validateExternalEvidenceUrl(trimmed);
  if (!initialGuard.allowed) {
    await emitTelemetry(deps, {
      kind: "downloader_stream",
      outcome: "failure",
      latencyMs: Date.now() - requestStart,
      rejections: { httpError: 1 },
      incident: { url: trimmed, error: initialGuard.reason },
    });
    return { success: false, error: initialGuard.reason };
  }

  const candidateUrls = getCandidateImageUrls(trimmed);
  const rejections: Partial<Record<DownloaderRejectionReason, number>> = {};
  const addRejection = (reason: DownloaderRejectionReason) => {
    rejections[reason] = (rejections[reason] || 0) + 1;
  };

  for (const candidate of candidateUrls) {
    const candidateGuard = validateExternalEvidenceUrl(candidate);
    if (!candidateGuard.allowed) {
      addRejection("httpError");
      continue;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(candidate, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.url) {
        const finalGuard = validateExternalEvidenceUrl(res.url);
        if (!finalGuard.allowed) {
          addRejection("httpError");
          continue;
        }
      }

      if (!res.ok) {
        addRejection("httpError");
        continue;
      }

      const contentType = res.headers.get("content-type")?.toLowerCase() || "";
      if (contentType.includes("text/html")) {
        addRejection("htmlResponse");
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0) {
        addRejection("invalidMagicBytes");
        continue;
      }

      const detectedMimeType = detectImageMimeFromBuffer(buffer);
      if (!detectedMimeType) {
        addRejection("invalidMagicBytes");
        continue;
      }

      await emitTelemetry(deps, {
        kind: "downloader_stream",
        outcome: "success",
        bytes: buffer.length,
        latencyMs: Date.now() - requestStart,
        endpoint: classifyCandidateEndpoint(candidate),
        rejections,
      });

      return {
        success: true,
        buffer,
        mimeType: detectedMimeType,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError" || controller.signal.aborted) {
        addRejection("timeoutAbort");
      } else {
        addRejection("httpError");
      }
    }
  }

  const errorMsg = `Gagal mengalirkan gambar dari tautan eksternal: ${trimmed}`;
  await emitTelemetry(deps, {
    kind: "downloader_stream",
    outcome: "failure",
    latencyMs: Date.now() - requestStart,
    rejections,
    incident: { url: trimmed, error: errorMsg },
  });

  return {
    success: false,
    error: errorMsg,
  };
}

function resolveLocalEvidence(
  relativePath: string,
  storageRoot?: string
):
  | { ok: true; absolutePath: string; mimeType: string }
  | { ok: false; status: 403 | 404; error: string } {
  const { safeAbsolutePath, isAllowed, contentType } = resolveEvidencePath(
    relativePath,
    storageRoot
  );
  if (!isAllowed) {
    return {
      ok: false,
      status: 403,
      error: "Jalur berkas eviden tidak sah",
    };
  }
  if (!fs.existsSync(safeAbsolutePath)) {
    return {
      ok: false,
      status: 404,
      error: "Berkas lokal tidak ditemukan",
    };
  }

  return {
    ok: true,
    absolutePath: safeAbsolutePath,
    mimeType: contentType,
  };
}

/**
 * Acquires Eviden Ulasan for Verifikasi Eviden: returns safe local path for engine passthrough,
 * or fetches and validates remote bytes in memory with zero disk footprint.
 */
export async function acquireForVerification(
  pathOrUrl: string,
  deps: EvidenceAcquisitionDeps = {}
): Promise<VerificationAcquisitionResult> {
  const trimmed = (pathOrUrl || "").trim();
  if (!trimmed) {
    return {
      ok: false,
      kind: "missing_local",
      error: "Jalur Eviden Ulasan kosong",
    };
  }

  if (isExternalUrl(trimmed)) {
    const streamFn =
      deps.streamExternal ?? ((targetUrl: string) => streamExternalEvidence(targetUrl, deps));
    const streamed = await streamFn(trimmed);
    if (!streamed.success || !streamed.buffer) {
      return {
        ok: false,
        kind: "external_error",
        error: streamed.error || "Gagal streaming",
      };
    }
    return {
      ok: true,
      kind: "buffer",
      buffer: streamed.buffer,
      mimeType: streamed.mimeType || "image/jpeg",
    };
  }

  const local = resolveLocalEvidence(trimmed, deps.storageRoot);
  if (!local.ok) {
    return {
      ok: false,
      kind: "missing_local",
      error: `Berkas lokal Eviden Ulasan tidak ditemukan: ${trimmed}`,
    };
  }

  return {
    ok: true,
    kind: "local_path",
    absolutePath: local.absolutePath,
    mimeType: local.mimeType,
  };
}

/**
 * Loads validated Eviden Ulasan bytes from either local storage or external Google Drive / HTTP links.
 */
export async function acquireBytes(
  pathOrUrl: string,
  deps: EvidenceAcquisitionDeps & { allowExternal?: boolean } = {}
): Promise<EvidenceBytesResult> {
  const trimmed = (pathOrUrl || "").trim();
  if (!trimmed) {
    return { ok: false, status: 404, error: "Eviden ulasan tidak ditemukan" };
  }

  if (!isExternalUrl(trimmed)) {
    const local = resolveLocalEvidence(trimmed, deps.storageRoot);
    if (!local.ok) {
      return local;
    }

    const buffer = await fs.promises.readFile(local.absolutePath);
    return {
      ok: true,
      buffer,
      mimeType: local.mimeType,
    };
  }

  if (deps.allowExternal === false) {
    return {
      ok: false,
      status: 403,
      error: "Jalur berkas eviden tidak sah",
    };
  }

  const streamFn =
    deps.streamExternal ?? ((targetUrl: string) => streamExternalEvidence(targetUrl, deps));
  const streamed = await streamFn(trimmed);

  if (!streamed.success || !streamed.buffer) {
    return {
      ok: false,
      status: 502,
      error: streamed.error || "Gagal mengalirkan gambar dari tautan eksternal",
    };
  }

  return {
    ok: true,
    buffer: streamed.buffer,
    mimeType: streamed.mimeType || "image/jpeg",
  };
}

/**
 * Resolves a RatingReview's stored Eviden Ulasan path/URL and streams validated bytes for HTTP delivery.
 */
export async function loadReviewEvidence(
  reviewId: string,
  deps: EvidenceAcquisitionDeps = {}
): Promise<EvidenceBytesResult> {
  if (!reviewId || !reviewId.trim()) {
    return { ok: false, status: 404, error: "Eviden ulasan tidak ditemukan" };
  }

  const db = deps.prisma ?? prisma;
  const review = await db.ratingReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      evidenceImagePath: true,
    },
  });

  if (!review || !review.evidenceImagePath) {
    return { ok: false, status: 404, error: "Eviden ulasan tidak ditemukan" };
  }

  return acquireBytes(review.evidenceImagePath, deps);
}
