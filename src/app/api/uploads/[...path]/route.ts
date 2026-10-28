import { NextRequest } from "next/server";
import fs from "fs";
import { resolveEvidencePath } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
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
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error serving evidence file:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
