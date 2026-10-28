import fs from "fs";
import path from "path";
import crypto from "crypto";

export const BASE_UPLOAD_DIR = path.resolve(
  process.env.STORAGE_PATH || path.join(process.cwd(), "uploads")
);

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

/**
 * Validates whether the given MIME type and file extension are allowed evidence image types.
 */
export function validateEvidenceMime(mimeType: string, filename?: string): boolean {
  const normalizedMime = mimeType.toLowerCase();
  if (!ALLOWED_MIME_TYPES[normalizedMime]) {
    return false;
  }

  if (filename) {
    const ext = path.extname(filename).toLowerCase();
    const allowedExts = ALLOWED_MIME_TYPES[normalizedMime];
    return allowedExts.includes(ext);
  }

  return true;
}

/**
 * Returns date-based directory structure (YYYY/MM/DD).
 */
export function getDateBasedSubdir(date: Date = new Date()): string {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  return path.join("evidence", yyyy, mm, dd);
}

/**
 * Resolves a relative path safely within BASE_UPLOAD_DIR, preventing path traversal attacks.
 */
export function resolveEvidencePath(relativePath: string): {
  safeAbsolutePath: string;
  isAllowed: boolean;
  contentType: string;
} {
  // Normalize and sanitize path
  const sanitized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.resolve(BASE_UPLOAD_DIR, sanitized);

  // Path traversal check: must start with BASE_UPLOAD_DIR
  const isInside =
    absolutePath.startsWith(BASE_UPLOAD_DIR + path.sep) ||
    absolutePath === BASE_UPLOAD_DIR;

  // Check extension
  const ext = path.extname(absolutePath).toLowerCase();
  const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);

  let contentType = "application/octet-stream";
  if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
  else if (ext === ".png") contentType = "image/png";
  else if (ext === ".webp") contentType = "image/webp";

  return {
    safeAbsolutePath: absolutePath,
    isAllowed: isInside && isAllowedExt,
    contentType,
  };
}

/**
 * Saves an uploaded buffer into the date-based folder structure.
 */
export async function saveEvidenceFile(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  targetDate: Date = new Date()
): Promise<{ relativePath: string; absolutePath: string; filename: string }> {
  if (!validateEvidenceMime(mimeType, originalFilename)) {
    throw new Error(`Unsupported MIME type or extension: ${mimeType}`);
  }

  const dateSubdir = getDateBasedSubdir(targetDate);
  const targetDir = path.join(BASE_UPLOAD_DIR, dateSubdir);

  await fs.promises.mkdir(targetDir, { recursive: true });

  const ext = path.extname(originalFilename).toLowerCase() || ".jpg";
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const timestamp = Date.now();
  const filename = `eviden_${timestamp}_${uniqueId}${ext}`;

  const absolutePath = path.join(targetDir, filename);
  await fs.promises.writeFile(absolutePath, buffer);

  const relativePath = path.join(dateSubdir, filename).replace(/\\/g, "/");

  return {
    relativePath,
    absolutePath,
    filename,
  };
}

/**
 * Deletes an evidence file if exists safely.
 */
export async function deleteEvidenceFile(relativePath: string): Promise<boolean> {
  const { safeAbsolutePath, isAllowed } = resolveEvidencePath(relativePath);
  if (!isAllowed) {
    throw new Error("Invalid or unsafe file path");
  }

  try {
    if (fs.existsSync(safeAbsolutePath)) {
      await fs.promises.unlink(safeAbsolutePath);
      return true;
    }
  } catch (err) {
    console.error("Failed to delete evidence file:", err);
  }
  return false;
}
