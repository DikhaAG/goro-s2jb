import { router, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "_goro_salt_2026").digest("hex");
}

export const authRouter = router({
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { username: input.username },
        include: {
          up3: true,
          ulp: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pengguna tidak ditemukan",
        });
      }

      const hashedPassword = hashPassword(input.password);
      if (user.passwordHash !== hashedPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Kata sandi salah",
        });
      }

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        up3: user.up3 ? { id: user.up3.id, code: user.up3.code, name: user.up3.name } : null,
        ulp: user.ulp ? { id: user.ulp.id, code: user.ulp.code, name: user.ulp.name } : null,
      };
    }),

  getSession: publicProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),
});
