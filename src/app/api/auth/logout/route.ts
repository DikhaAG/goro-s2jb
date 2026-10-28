import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, USER_ID_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { logAuditEvent } from "@/server/services/auditService";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";

    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const user = await verifySessionToken(sessionCookie);
      if (user) {
        // Check query or body for force logout
        const url = new URL(request.url);
        let force = url.searchParams.get("force") === "true";
        if (!force) {
          try {
            const body = await request.clone().json();
            if (body && body.force === true) force = true;
          } catch {
            // No json body provided
          }
        }

        // Check if user currently has an active migration in progress
        const activeBatch = await prisma.migrationBatch.findFirst({
          where: {
            uploadedById: user.id,
            status: { in: ["PROCESSING", "PENDING"] },
          },
        });

        if (activeBatch && !force) {
          return NextResponse.json(
            {
              error: "MIGRATION_ACTIVE",
              message:
                "Proses migrasi sedang berlangsung. Harap tunggu hingga migrasi selesai atau jeda migrasi terlebih dahulu sebelum keluar.",
              batchId: activeBatch.id,
            },
            { status: 423 }
          );
        }

        if (activeBatch && force) {
          // Gracefully pause batch when forced logout occurs
          await prisma.migrationBatch.update({
            where: { id: activeBatch.id },
            data: { status: "PAUSED" },
          });
        }

        await logAuditEvent({
          userId: user.id,
          action: "AUTH_LOGOUT",
          entityType: "User",
          entityId: user.id,
          ipAddress: clientIp,
          userAgent,
        });
      }
    }

    const response = NextResponse.json({ success: true });

    // Expire cookies
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set({
      name: USER_ID_COOKIE_NAME,
      value: "",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout API route error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
