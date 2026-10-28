import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
  signSessionToken,
  getRoleMaxAgeSeconds,
  getDefaultRedirectForRole,
  SESSION_COOKIE_NAME,
  USER_ID_COOKIE_NAME,
} from "@/lib/auth";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
} from "@/lib/rateLimit";
import { logAuditEvent } from "@/server/services/auditService";
import { SessionUser } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    // 1. Anti Brute-Force Rate Limiting (AC-6)
    const rateLimitCheck = await checkLoginRateLimit(clientIp);
    if (!rateLimitCheck.success) {
      const waitMinutes = Math.ceil(
        (rateLimitCheck.retryAfterSeconds || 900) / 60
      );
      return NextResponse.json(
        {
          error: `Batas percobaan login gagal terlampaui. Akses dikunci sementara selama ${waitMinutes} menit.`,
          locked: true,
          retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // 2. Fetch User
    const dbUser = await prisma.user.findUnique({
      where: { username: username.trim() },
      include: { up3: true, ulp: true },
    });

    if (!dbUser || !dbUser.isActive) {
      const failRes = await recordLoginFailure(clientIp);
      await logAuditEvent({
        action: "AUTH_LOGIN_FAILED",
        entityType: "User",
        ipAddress: clientIp,
        userAgent,
        metadata: {
          username,
          reason: !dbUser ? "NOT_FOUND" : "DEACTIVATED",
          remaining: failRes.remaining,
        },
      });

      return NextResponse.json(
        {
          error: failRes.locked
            ? "Terlalu banyak percobaan gagal. Akses diblokir selama 15 menit."
            : `Kredensial tidak valid. Sisa percobaan: ${failRes.remaining}`,
          remaining: failRes.remaining,
          locked: failRes.locked,
        },
        { status: 401 }
      );
    }

    // 3. Verify Password
    const isValid = await verifyPassword(password, dbUser.passwordHash);
    if (!isValid) {
      const failRes = await recordLoginFailure(clientIp);
      await logAuditEvent({
        userId: dbUser.id,
        action: "AUTH_LOGIN_FAILED",
        entityType: "User",
        entityId: dbUser.id,
        ipAddress: clientIp,
        userAgent,
        metadata: {
          username,
          reason: "INVALID_PASSWORD",
          remaining: failRes.remaining,
        },
      });

      return NextResponse.json(
        {
          error: failRes.locked
            ? "Batas 5 kali percobaan gagal tercapai. Akses diblokir 15 menit."
            : `Kata sandi salah. Sisa percobaan: ${failRes.remaining}`,
          remaining: failRes.remaining,
          locked: failRes.locked,
        },
        { status: 401 }
      );
    }

    // 4. Reset Rate Limiter
    await resetLoginRateLimit(clientIp);

    const sessionUser: SessionUser = {
      id: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,
      role: dbUser.role,
      up3Id: dbUser.up3Id,
      ulpId: dbUser.ulpId,
    };

    // 5. Sign JWT Token with role-based duration
    const maxAgeSeconds = getRoleMaxAgeSeconds(dbUser.role);
    const token = await signSessionToken(sessionUser, maxAgeSeconds);

    // 6. Record Audit
    await logAuditEvent({
      userId: dbUser.id,
      action: "AUTH_LOGIN_SUCCESS",
      entityType: "User",
      entityId: dbUser.id,
      ipAddress: clientIp,
      userAgent,
    });

    const redirectUrl = getDefaultRedirectForRole(dbUser.role);
    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      redirectUrl,
    });

    // 7. Set HTTP-Only SameSite Cookies (AC-1)
    const isProduction = process.env.NODE_ENV === "production";

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    });

    response.cookies.set({
      name: USER_ID_COOKIE_NAME,
      value: dbUser.id,
      httpOnly: false, // Accessible to client for quick UI state if needed
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (error: any) {
    console.error("Login API route error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server internal saat autentikasi." },
      { status: 500 }
    );
  }
}
