import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/validators/intake";

export const NORMALIZED_MAX_DIMENSION = 1920;
export const TARGET_COMPRESSED_BYTES = 2 * 1024 * 1024; // 2 MB target for fast mobile upload & crisp OCR
const JPEG_QUALITY_STEPS = [0.86, 0.78, 0.7, 0.6];

const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_EXTENSIONS = [".heic", ".heif"];

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export interface NormalizedEvidenceImage {
  dataUrl: string;
  filename: string;
  mimeType: string;
  originalSizeBytes: number;
  finalSizeBytes: number;
  width: number;
  height: number;
  wasNormalized: boolean;
  wasHeicConverted: boolean;
}

export type HeicConvertFn = (options: {
  blob: Blob;
  toType?: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

function getLowerExtension(filename?: string): string {
  if (!filename) return "";
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return "";
  return filename.slice(idx).toLowerCase();
}

export function isHeicFile(file: { name?: string; type?: string }): boolean {
  const mime = (file.type || "").toLowerCase().trim();
  if (HEIC_MIME_TYPES.has(mime)) {
    return true;
  }
  return HEIC_EXTENSIONS.includes(getLowerExtension(file.name));
}

export function resolveEffectiveMimeType(file: { name?: string; type?: string }): string {
  const mime = (file.type || "").toLowerCase().trim();
  if (mime === "image/jpg") return "image/jpeg";
  if (mime && mime !== "application/octet-stream") {
    return mime;
  }
  const ext = getLowerExtension(file.name);
  return MIME_BY_EXTENSION[ext] || "";
}

export function isSupportedImageCandidate(file: { name?: string; type?: string }): boolean {
  if (isHeicFile(file)) {
    return true;
  }
  const effectiveMime = resolveEffectiveMimeType(file);
  return ACCEPTED_IMAGE_TYPES.includes(effectiveMime);
}

export function normalizeFilenameForMime(filename: string, mimeType: string): string {
  const targetExt = EXTENSION_BY_MIME[mimeType] || ".jpg";
  const trimmed = (filename || "eviden").trim() || "eviden";
  const lastDot = trimmed.lastIndexOf(".");
  const baseName = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  return `${baseName}${targetExt}`;
}

export function computeNormalizedDimensions(
  width: number,
  height: number,
  maxDimension: number = NORMALIZED_MAX_DIMENSION
): { width: number; height: number; wasResized: boolean } {
  if (width <= 0 || height <= 0) {
    throw new Error("Dimensi gambar tidak valid.");
  }

  const longestSide = Math.max(width, height);
  if (longestSide <= maxDimension) {
    return { width, height, wasResized: false };
  }

  const ratio = maxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    wasResized: true,
  };
}

export async function convertHeicBlobToJpeg(
  blob: Blob,
  customConvertFn?: HeicConvertFn
): Promise<Blob> {
  let convertFn = customConvertFn;
  if (!convertFn) {
    const heicModule = await import("heic2any");
    convertFn = (heicModule.default || heicModule) as unknown as HeicConvertFn;
  }

  const converted = await convertFn({
    blob,
    toType: "image/jpeg",
    quality: 0.9,
  });

  return Array.isArray(converted) ? converted[0] : converted;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Gagal membaca data gambar."));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas gambar dari perangkat."));
    reader.readAsDataURL(blob);
  });
}

async function decodeImageDimensionsAndDraw(
  blob: Blob,
  maxDimension: number
): Promise<{
  width: number;
  height: number;
  targetWidth: number;
  targetHeight: number;
  wasResized: boolean;
  renderToCanvas: () => HTMLCanvasElement;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const { width, height } = bitmap;
      const scaled = computeNormalizedDimensions(width, height, maxDimension);

      return {
        width,
        height,
        targetWidth: scaled.width,
        targetHeight: scaled.height,
        wasResized: scaled.wasResized,
        renderToCanvas: () => {
          const canvas = document.createElement("canvas");
          canvas.width = scaled.width;
          canvas.height = scaled.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            bitmap.close();
            throw new Error("Browser tidak mendukung pemrosesan kanvas gambar.");
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, scaled.width, scaled.height);
          ctx.drawImage(bitmap, 0, 0, scaled.width, scaled.height);
          bitmap.close();
          return canvas;
        },
      };
    } catch {
      // Fall back to HTMLImageElement if createImageBitmap fails on a specific browser
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Berkas gambar rusak atau tidak dapat dibaca browser."));
      el.src = objectUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const scaled = computeNormalizedDimensions(width, height, maxDimension);

    return {
      width,
      height,
      targetWidth: scaled.width,
      targetHeight: scaled.height,
      wasResized: scaled.wasResized,
      renderToCanvas: () => {
        const canvas = document.createElement("canvas");
        canvas.width = scaled.width;
        canvas.height = scaled.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Browser tidak mendukung pemrosesan kanvas gambar.");
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, scaled.width, scaled.height);
        ctx.drawImage(img, 0, 0, scaled.width, scaled.height);
        return canvas;
      },
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gagal mengompresi gambar ke format JPEG."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

export interface NormalizeOptions {
  heicConvertFn?: HeicConvertFn;
  maxDimension?: number;
  targetMaxBytes?: number;
}

/**
 * Normalizes mobile camera captures and gallery screenshots (including iOS HEIC/HEIF
 * and high-megapixel Android/iOS photos) into a web-ready image <= 1920px and <= 5 MB.
 */
export async function normalizeEvidenceImageFile(
  file: File,
  options: NormalizeOptions = {}
): Promise<NormalizedEvidenceImage> {
  const maxDimension = options.maxDimension ?? NORMALIZED_MAX_DIMENSION;
  const targetMaxBytes = options.targetMaxBytes ?? TARGET_COMPRESSED_BYTES;
  const originalSizeBytes = file.size;

  if (!isSupportedImageCandidate(file)) {
    throw new Error("Format file harus JPG, PNG, WebP, atau HEIC/HEIF");
  }

  let workingBlob: Blob = file;
  let effectiveMime = resolveEffectiveMimeType(file);
  let wasHeicConverted = false;

  if (isHeicFile(file)) {
    try {
      workingBlob = await convertHeicBlobToJpeg(file, options.heicConvertFn);
      effectiveMime = "image/jpeg";
      wasHeicConverted = true;
    } catch {
      // Allow native browser decode fallback (e.g., iOS Safari versions supporting HEIC natively)
      wasHeicConverted = true;
    }
  }

  let decoded: Awaited<ReturnType<typeof decodeImageDimensionsAndDraw>>;
  try {
    decoded = await decodeImageDimensionsAndDraw(workingBlob, maxDimension);
  } catch (err) {
    if (isHeicFile(file)) {
      throw new Error("Gagal mengonversi foto HEIC/HEIF. Coba pilih ulang gambar atau gunakan format JPG/PNG.");
    }
    throw err;
  }

  const canKeepOriginal =
    !wasHeicConverted &&
    !decoded.wasResized &&
    ACCEPTED_IMAGE_TYPES.includes(effectiveMime) &&
    workingBlob.size <= targetMaxBytes;

  if (canKeepOriginal) {
    const dataUrl = await blobToDataUrl(workingBlob);
    return {
      dataUrl,
      filename: normalizeFilenameForMime(file.name, effectiveMime),
      mimeType: effectiveMime,
      originalSizeBytes,
      finalSizeBytes: workingBlob.size,
      width: decoded.width,
      height: decoded.height,
      wasNormalized: false,
      wasHeicConverted: false,
    };
  }

  const canvas = decoded.renderToCanvas();
  let compressedBlob: Blob | null = null;

  for (const quality of JPEG_QUALITY_STEPS) {
    const candidate = await canvasToJpegBlob(canvas, quality);
    compressedBlob = candidate;
    if (candidate.size <= targetMaxBytes) {
      break;
    }
  }

  if (!compressedBlob) {
    throw new Error("Gagal menghasilkan gambar JPEG terkompresi.");
  }

  if (compressedBlob.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Ukuran berkas melebihi batas 5 MB setelah kompresi");
  }

  const dataUrl = await blobToDataUrl(compressedBlob);
  return {
    dataUrl,
    filename: normalizeFilenameForMime(file.name, "image/jpeg"),
    mimeType: "image/jpeg",
    originalSizeBytes,
    finalSizeBytes: compressedBlob.size,
    width: decoded.targetWidth,
    height: decoded.targetHeight,
    wasNormalized: true,
    wasHeicConverted,
  };
}

