import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { session } from "@/server/session/live";
import { isExportFormat } from "@/server/services/achievementReport";
import { achievementReport } from "@/server/services/achievementReport.live";

const EXECUTIVE_ROLES: readonly Role[] = [Role.MANAGER, Role.SUPER_ADMIN];

/** GET /api/export/excel (workbook download) and /api/export/pdf (printable page) for the Laporan Capaian. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  if (!isExportFormat(format)) {
    return NextResponse.json({ error: "Format laporan tidak dikenal." }, { status: 404 });
  }

  try {
    // Route handlers sit outside the proxy, so this guard is the only one in front of the export.
    const user = await session.getUser(request.headers);
    if (!user) {
      return NextResponse.json(
        { error: "Autentikasi diperlukan untuk mengunduh laporan." },
        { status: 401 }
      );
    }
    if (!EXECUTIVE_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Manajer atau Super Admin yang diizinkan." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = achievementReport.parsePosisi(searchParams.get("posisiTanggal") ?? undefined);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const doc = await achievementReport.exportDocument(format, parsed.posisi, {
      up3Id: searchParams.get("up3Id") || undefined,
    });
    const headers: Record<string, string> = {
      "Content-Type": doc.contentType,
      "Cache-Control": "no-store, max-age=0",
    };
    if (doc.filename) headers["Content-Disposition"] = `attachment; filename="${doc.filename}"`;

    const body = typeof doc.body === "string" ? doc.body : new Uint8Array(doc.body);
    return new Response(body, { status: 200, headers });
  } catch (error) {
    console.error(`[Laporan Capaian export ${format}]`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Gagal membuat berkas laporan: ${message}` }, { status: 500 });
  }
}
