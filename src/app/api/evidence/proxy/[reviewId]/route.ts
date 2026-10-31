import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { resolveEvidencePath } from "@/lib/storage";
import { extractGoogleDriveFileId } from "@/server/services/evidenceDownloader";
import fs from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    if (!reviewId) {
      return NextResponse.json({ error: "Missing review ID" }, { status: 400 });
    }

    const review = await prisma.ratingReview.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        evidenceImagePath: true,
      },
    });

    if (!review || !review.evidenceImagePath) {
      return NextResponse.json({ error: "Eviden ulasan tidak ditemukan" }, { status: 404 });
    }

    const pathOrUrl = review.evidenceImagePath.trim();

    // 1. If it's a local file in uploads/
    if (!pathOrUrl.startsWith("http://") && !pathOrUrl.startsWith("https://")) {
      const { safeAbsolutePath, isAllowed, contentType } = resolveEvidencePath(pathOrUrl);
      if (!isAllowed || !fs.existsSync(safeAbsolutePath)) {
        return NextResponse.json({ error: "Berkas lokal tidak ditemukan" }, { status: 404 });
      }

      const fileBuffer = await fs.promises.readFile(safeAbsolutePath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // 2. If it's an external URL (Google Drive / HTTP)
    const fileId = extractGoogleDriveFileId(pathOrUrl);
    const candidateUrls: string[] = fileId
      ? [
          `https://drive.google.com/uc?id=${fileId}&export=download`,
          `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`,
          `https://lh3.googleusercontent.com/d/${fileId}`,
        ]
      : [pathOrUrl];

    for (const url of candidateUrls) {
      try {
        const upstreamRes = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
          redirect: "follow",
        });

        if (!upstreamRes.ok) continue;

        const contentType = upstreamRes.headers.get("content-type")?.toLowerCase() || "";
        if (contentType.includes("text/html")) continue;

        const buffer = await upstreamRes.arrayBuffer();
        if (buffer.byteLength === 0) continue;

        let responseMime = "image/jpeg";
        if (contentType.includes("png")) responseMime = "image/png";
        else if (contentType.includes("webp")) responseMime = "image/webp";

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": responseMime,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      } catch {
        // Try next candidate URL
      }
    }

    return NextResponse.json(
      { error: "Gagal mengalirkan gambar dari tautan eksternal" },
      { status: 502 }
    );
  } catch (err: any) {
    console.error("Evidence proxy error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
