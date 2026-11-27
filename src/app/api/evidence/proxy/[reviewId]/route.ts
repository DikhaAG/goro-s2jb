import { NextRequest, NextResponse } from "next/server";
import { session } from "@/server/session/live";
import { loadReviewEvidence } from "@/server/services/evidenceAcquisition";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const user = await session.getUser(request.headers);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Sesi autentikasi diperlukan untuk mengakses bukti ulasan." },
        { status: 401 }
      );
    }

    const { reviewId } = await params;
    if (!reviewId) {
      return NextResponse.json({ error: "Missing review ID" }, { status: 400 });
    }

    const result = await loadReviewEvidence(reviewId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Evidence proxy error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
