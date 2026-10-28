import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
  verifyPassword,
  hashPassword,
  signSessionToken,
  getDefaultRedirectForRole,
} from "@/lib/auth";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
} from "@/lib/rateLimit";
import { logAuditEvent } from "../services/auditService";
import { SessionUser } from "@/types";

export const authRouter = router({
  login: publicProcedure
    .input(
      z.object({
        username: z.string().trim().min(1, "Username wajib diisi"),
        password: z.string().min(1, "Password wajib diisi"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clientIp = ctx.ipAddress || "127.0.0.1";

      // 1. Anti Brute-Force Rate Limiting Shield (AC-6)
      const rateLimitStatus = await checkLoginRateLimit(clientIp);
      if (!rateLimitStatus.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Terlalu banyak percobaan login gagal. Akses diblokir sementara. Silakan coba lagi dalam ${Math.ceil(
            (rateLimitStatus.retryAfterSeconds || 900) / 60
          )} menit.`,
        });
      }

      // 2. Fetch User by Username
      const dbUser = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        include: {
          up3: true,
          ulp: true,
        },
      });

      if (!dbUser || !dbUser.isActive) {
        const failStatus = await recordLoginFailure(clientIp);
        await logAuditEvent({
          action: "AUTH_LOGIN_FAILED",
          entityType: "User",
          ipAddress: clientIp,
          userAgent: ctx.userAgent,
          metadata: {
            username: input.username,
            reason: !dbUser ? "USER_NOT_FOUND" : "USER_DEACTIVATED",
            remaining: failStatus.remaining,
          },
        });

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: failStatus.locked
            ? "Akun/IP terkunci selama 15 menit karena 5 kali percobaan gagal."
            : "Kredensial tidak valid atau akun dinonaktifkan.",
        });
      }

      // 3. Verify Password Hash (Bcrypt / Argon2 / Legacy fallback)
      const isPasswordValid = await verifyPassword(
        input.password,
        dbUser.passwordHash
      );

      if (!isPasswordValid) {
        const failStatus = await recordLoginFailure(clientIp);
        await logAuditEvent({
          userId: dbUser.id,
          action: "AUTH_LOGIN_FAILED",
          entityType: "User",
          entityId: dbUser.id,
          ipAddress: clientIp,
          userAgent: ctx.userAgent,
          metadata: {
            username: input.username,
            reason: "INVALID_PASSWORD",
            remaining: failStatus.remaining,
          },
        });

        if (failStatus.locked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Batas percobaan gagal terlampaui (5 kali). Akses diblokir sementara selama 15 menit.",
          });
        }

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `Kata sandi salah. Sisa percobaan: ${failStatus.remaining}`,
        });
      }

      // 4. Login Successful: Reset rate limiter
      await resetLoginRateLimit(clientIp);

      const sessionUser: SessionUser = {
        id: dbUser.id,
        username: dbUser.username,
        name: dbUser.name,
        role: dbUser.role,
        up3Id: dbUser.up3Id,
        ulpId: dbUser.ulpId,
      };

      // 5. Issue JWT Session Token
      const token = await signSessionToken(sessionUser);

      // 6. Record Audit Log (AC-7)
      await logAuditEvent({
        userId: dbUser.id,
        action: "AUTH_LOGIN_SUCCESS",
        entityType: "User",
        entityId: dbUser.id,
        ipAddress: clientIp,
        userAgent: ctx.userAgent,
      });

      return {
        success: true,
        token,
        user: sessionUser,
        id: dbUser.id,
        username: dbUser.username,
        name: dbUser.name,
        role: dbUser.role,
        ulp: dbUser.ulp ? { id: dbUser.ulp.id, code: dbUser.ulp.code, name: dbUser.ulp.name } : null,
        up3: dbUser.up3 ? { id: dbUser.up3.id, code: dbUser.up3.code, name: dbUser.up3.name } : null,
        redirectUrl: getDefaultRedirectForRole(dbUser.role),
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await logAuditEvent({
      userId: ctx.user.id,
      action: "AUTH_LOGOUT",
      entityType: "User",
      entityId: ctx.user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { success: true };
  }),

  getSession: publicProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      user: ctx.user,
    };
  }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pengguna tidak ditemukan." });
      }

      const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password saat ini salah.",
        });
      }

      const newHash = await hashPassword(input.newPassword);
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      await logAuditEvent({
        userId: user.id,
        action: "AUTH_PASSWORD_CHANGED",
        entityType: "User",
        entityId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return { success: true, message: "Password berhasil diperbarui." };
    }),
});
