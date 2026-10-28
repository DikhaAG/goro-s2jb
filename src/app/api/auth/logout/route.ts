import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, USER_ID_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { logAuditEvent } from "@/server/services/auditService";

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
