import { NextRequest } from "next/server";
import { acquireBytes } from "@/server/services/evidenceAcquisition";
import { session } from "@/server/session/live";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    // Layer 3 Authentication Guard: Block public scraping of sensitive evidence files
    const user = await session.getUser(req.headers);

    if (!user) {
      return new Response("Unauthorized: Sesi autentikasi diperlukan untuk mengakses berkas bukti.", {
        status: 401,
      });
    }

    const { path: pathSegments } = await props.params;

    if (!pathSegments || pathSegments.length === 0) {
      return new Response("Bad Request: File path missing", { status: 400 });
    }

    const result = await acquireBytes(pathSegments.join("/"), { allowExternal: false });

    if (!result.ok) {
      return new Response(result.error, { status: result.status });
    }

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error serving evidence file:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
