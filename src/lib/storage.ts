import fs from "fs";
import path from "path";
import crypto from "crypto";

export const BASE_UPLOAD_DIR = path.resolve(
  process.env.STORAGE_PATH || path.join(process.cwd(), "uploads")
);

export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const EXTENSION_BY_IMAGE_TYPE = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

export type EvidenceImageType = keyof typeof EXTENSION_BY_IMAGE_TYPE;

/**
 * Writes an evidence image to `<root>/evidence/YYYY/MM/DD/` and returns its path relative to root.
 * It does not validate: callers pass a type already detected from the bytes.
 */
export async function storeEvidenceImage(
  root: string,
  bytes: Buffer,
  type: EvidenceImageType,
  entryDate: string
): Promise<string> {
  const [yyyy, mm, dd] = entryDate.split("-");
  const relativeDir = path.posix.join("evidence", yyyy, mm, dd);
  const filename = `eviden_${Date.now()}_${crypto.randomBytes(8).toString("hex")}${EXTENSION_BY_IMAGE_TYPE[type]}`;
  await fs.promises.mkdir(path.join(root, relativeDir), { recursive: true });
  await fs.promises.writeFile(path.join(root, relativeDir, filename), bytes);
  return path.posix.join(relativeDir, filename);
}

export async function discardEvidenceImage(root: string, relativePath: string): Promise<void> {
  await fs.promises.rm(path.join(root, relativePath), { force: true }).catch(() => {});
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
