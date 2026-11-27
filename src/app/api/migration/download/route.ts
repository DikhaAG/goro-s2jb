import { NextRequest, NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";
import { session } from "@/server/session/live";
import { migrationBatch } from "@/server/services/migrationBatch";

export async function GET(req: NextRequest) {
  try {
    const user = await session.getUser(req.headers);

    if (!user) {
      return new NextResponse(
        "Unauthorized: Sesi login diperlukan untuk mengunduh berkas migrasi.",
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");

    if (!batchId) {
      return new NextResponse(
        "Bad Request: batchId parameter wajib disertakan.",
        { status: 400 }
      );
    }

    const result = await migrationBatch.download(user, batchId);

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"`,
        "Content-Length": result.buffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    if (error instanceof TRPCError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
          ? 404
          : 400;
      return new NextResponse(error.message, { status });
    }
    console.error("Download migration file error:", error);
    return new NextResponse(error.message || "Gagal mengunduh berkas", { status: 500 });
  }
}
