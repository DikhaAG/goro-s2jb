import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { logAuditEvent } from "../services/auditService";
import { session } from "@/server/session/live";

// Sign-in and sign-out go through better-auth at /api/auth/*; see src/server/session/authHooks.ts.
export const authRouter = router({
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
      const headers: Headers | undefined = ctx.req?.headers;
      if (!headers) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesi tidak ditemukan." });
      }

      const result = await session.changeOwnPassword(
        headers,
        input.currentPassword,
        input.newPassword
      );
      if (result === "wrong_current_password") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Password saat ini salah." });
      }

      await logAuditEvent({
        userId: ctx.user.id,
        action: "AUTH_PASSWORD_CHANGED",
        entityType: "User",
        entityId: ctx.user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      return { success: true, message: "Password berhasil diperbarui." };
    }),
});
