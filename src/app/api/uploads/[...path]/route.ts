import { NextRequest } from "next/server";
import fs from "fs";
import { resolveEvidencePath } from "@/lib/storage";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    // 1. Layer 3 Authentication Guard: Block public scraping of sensitive evidence files
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return new Response("Unauthorized: Sesi autentikasi diperlukan untuk mengakses berkas bukti.", {
        status: 401,
      });
    }

    const { path: pathSegments } = await props.params;

    if (!pathSegments || pathSegments.length === 0) {
      return new Response("Bad Request: File path missing", { status: 400 });
    }

    const relativePath = pathSegments.join("/");
    const { safeAbsolutePath, isAllowed, contentType } = resolveEvidencePath(relativePath);

    if (!isAllowed) {
      return new Response("Forbidden: Invalid file path or directory traversal detected", {
        status: 403,
      });
    }

    if (!fs.existsSync(safeAbsolutePath)) {
      return new Response("Not Found: Evidence file does not exist", {
        status: 404,
      });
    }

    const fileBuffer = await fs.promises.readFile(safeAbsolutePath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error serving evidence file:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
