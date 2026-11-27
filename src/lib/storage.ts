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

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export type EvidenceImageType = keyof typeof EXTENSION_BY_IMAGE_TYPE;

export interface ConfineOptions {
  allowedExtensions?: readonly string[];
  /** Remaps cross-environment mount paths containing `/uploads/` (e.g. Docker `/app/uploads/...` vs host). */
  remapUploadsMount?: boolean;
}

export interface ConfinedPath {
  safeAbsolutePath: string;
  relativePath: string;
  isAllowed: boolean;
}

export function resolveStorageRoot(root?: string): string {
  return root ? path.resolve(root) : BASE_UPLOAD_DIR;
}

function isInsideRoot(resolvedRoot: string, resolvedCandidate: string): boolean {
  const rel = path.relative(resolvedRoot, resolvedCandidate);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(rel)
  );
}

/**
 * Single path-confinement rule for storage roots: blocks null bytes, root escape,
 * sibling-prefix collisions, and optional extension/cross-host mount constraints.
 */
export function confineToRoot(
  root: string,
  candidatePath: string,
  options: ConfineOptions = {}
): ConfinedPath {
  const trimmed = (candidatePath || "").trim();
  if (!trimmed || trimmed.includes("\0")) {
    return { safeAbsolutePath: "", relativePath: "", isAllowed: false };
  }

  const resolvedRoot = path.resolve(root);
  const normalizedSlashes = trimmed.replace(/\\/g, "/");
  const isAbsInput =
    path.isAbsolute(normalizedSlashes) || /^[a-zA-Z]:\//.test(normalizedSlashes);

  let safeAbsolutePath = "";
  let inside = false;

  if (isAbsInput) {
    const resolvedInput = path.resolve(normalizedSlashes);
    if (isInsideRoot(resolvedRoot, resolvedInput)) {
      safeAbsolutePath = resolvedInput;
      inside = true;
    } else if (options.remapUploadsMount) {
      const marker = "/uploads/";
      const markerIdx = normalizedSlashes.lastIndexOf(marker);
      if (markerIdx !== -1) {
        const suffix = normalizedSlashes.slice(markerIdx + marker.length);
        const remapped = path.resolve(resolvedRoot, suffix);
        if (isInsideRoot(resolvedRoot, remapped)) {
          safeAbsolutePath = remapped;
          inside = true;
        }
      }
    }
    if (!inside) {
      safeAbsolutePath = resolvedInput;
    }
  } else {
    const resolvedRelative = path.resolve(resolvedRoot, normalizedSlashes);
    safeAbsolutePath = resolvedRelative;
    inside = isInsideRoot(resolvedRoot, resolvedRelative);
  }

  if (!inside) {
    return { safeAbsolutePath, relativePath: "", isAllowed: false };
  }

  const ext = path.extname(safeAbsolutePath).toLowerCase();
  const extAllowed =
    !options.allowedExtensions || options.allowedExtensions.includes(ext);

  return {
    safeAbsolutePath,
    relativePath: path.relative(resolvedRoot, safeAbsolutePath).replace(/\\/g, "/"),
    isAllowed: extAllowed,
  };
}

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
  const filename = `eviden_${Date.now()}_${crypto.randomBytes(8).toString("hex")}${EXTENSION_BY_IMAGE_TYPE[type]}`;
  const relativeTarget = path.posix.join("evidence", yyyy, mm, dd, filename);
  const confined = confineToRoot(root, relativeTarget, {
    allowedExtensions: ALLOWED_EXTENSIONS,
  });
  if (!confined.isAllowed) {
    throw new Error("Invalid Eviden Ulasan storage path");
  }
  await fs.promises.mkdir(path.dirname(confined.safeAbsolutePath), { recursive: true });
  await fs.promises.writeFile(confined.safeAbsolutePath, bytes);
  return confined.relativePath;
}

export async function discardEvidenceImage(root: string, relativePath: string): Promise<void> {
  const confined = confineToRoot(root, relativePath);
  if (!confined.isAllowed) return;
  await fs.promises.rm(confined.safeAbsolutePath, { force: true }).catch(() => {});
}

/**
 * Resolves a relative evidence path safely within `root` (defaults to BASE_UPLOAD_DIR),
 * enforcing image extension allowlisting and preventing path traversal.
 */
export function resolveEvidencePath(
  relativePath: string,
  root?: string
): {
  safeAbsolutePath: string;
  relativePath: string;
  isAllowed: boolean;
  contentType: string;
} {
  const confined = confineToRoot(resolveStorageRoot(root), relativePath, {
    allowedExtensions: ALLOWED_EXTENSIONS,
  });
  const ext = path.extname(confined.safeAbsolutePath).toLowerCase();

  return {
    safeAbsolutePath: confined.safeAbsolutePath,
    relativePath: confined.relativePath,
    isAllowed: confined.isAllowed,
    contentType: CONTENT_TYPE_BY_EXTENSION[ext] ?? "application/octet-stream",
  };
}
