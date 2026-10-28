import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { generateExecutiveWorkbook } from "@/lib/export/excelExporter";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // 1. Layer 3 Authentication Guard: Verify active session token
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = token ? await verifySessionToken(token) : null;

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
    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();
    const year = parseInt(searchParams.get("year") || String(date.getFullYear()), 10);
    const month = parseInt(searchParams.get("month") || String(date.getMonth() + 1), 10);
    const up3Id = searchParams.get("up3Id") || undefined;

    const buffer = await generateExecutiveWorkbook({
      date,
      year,
      month,
      up3Id,
    });

    const filename = `GORO_S2JB_Laporan_Eksekutif_${year}_${String(month).padStart(2, "0")}.xlsx`;

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
