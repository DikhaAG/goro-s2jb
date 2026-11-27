import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { generateExecutiveWorkbook } from "@/lib/export/excelExporter";
import { session } from "@/server/session/live";
import { achievementReport } from "@/server/services/achievementReport.live";

export async function GET(request: NextRequest) {
  try {
    // 1. Layer 3 Authentication Guard: Verify active session token
    const user = await session.getUser(request.headers);

    if (!user) {
      return NextResponse.json(
        { error: "Autentikasi diperlukan untuk mengunduh laporan eksekutif." },
        { status: 401 }
      );
    }

    // 2. Layer 3 Authorization Guard: Restrict strictly to MANAGER and SUPER_ADMIN
    if (user.role !== Role.MANAGER && user.role !== Role.SUPER_ADMIN) {
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
    const filter = { up3Id: searchParams.get("up3Id") || undefined };
    const [daily, monthly] = await Promise.all([
      achievementReport.daily(parsed.posisi, filter),
      achievementReport.monthly(parsed.posisi, filter),
    ]);

    const buffer = await generateExecutiveWorkbook({ daily, monthly });
    const filename = `GORO_S2JB_Laporan_Eksekutif_${parsed.posisi.date}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("[Excel Export Error]", error);
    return NextResponse.json(
      { error: "Gagal membuat berkas Excel: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
