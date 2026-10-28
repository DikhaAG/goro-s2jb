import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateExecutiveWorkbook } from "@/lib/export/excelExporter";

export async function GET(request: NextRequest) {
  try {
    // 1. RBAC Guard check
    let userId = request.headers.get("x-user-id") || request.cookies.get("goro_user_id")?.value;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || (user.role !== "MANAGER" && user.role !== "SUPER_ADMIN")) {
        return NextResponse.json(
          { error: "Akses ditolak. Hanya Manajer atau Super Admin yang diizinkan." },
          { status: 403 }
        );
      }
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
