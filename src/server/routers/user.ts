import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc";
import { hashPassword } from "@/lib/auth";
import { logAuditEvent, getAuditLogs } from "../services/auditService";
import { Role } from "@prisma/client";

export const userRouter = router({
  listUsers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.nativeEnum(Role).optional(),
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};

      if (input.role) {
        where.role = input.role;
      }

      if (typeof input.isActive === "boolean") {
        where.isActive = input.isActive;
      }

      if (input.search && input.search.trim().length > 0) {
        const query = input.search.trim();
        where.OR = [
          { username: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ];
      }

      const [total, users] = await Promise.all([
        ctx.prisma.user.count({ where }),
        ctx.prisma.user.findMany({
          where,
          take: input.limit,
          skip: input.offset,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            isActive: true,
            up3Id: true,
            ulpId: true,
            createdAt: true,
            up3: { select: { id: true, code: true, name: true } },
            ulp: { select: { id: true, code: true, name: true } },
          },
        }),
      ]);

      return { total, users };
    }),

  createUser: adminProcedure
    .input(
      z.object({
        username: z.string().trim().min(3, "Username minimal 3 karakter"),
        name: z.string().trim().min(2, "Nama minimal 2 karakter"),
        password: z.string().min(6, "Password minimal 6 karakter"),
        role: z.nativeEnum(Role),
        up3Id: z.string().optional().nullable(),
        ulpId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validation: Petugas Lapangan must have UP3 and ULP
      if (input.role === Role.PETUGAS_LAPANGAN) {
        if (!input.up3Id || !input.ulpId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Petugas Lapangan wajib ditautkan ke UP3 dan ULP penugasan.",
          });
        }
      }

      const existing = await ctx.prisma.user.findUnique({
        where: { username: input.username },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Username '${input.username}' sudah terdaftar.`,
        });
      }

      const passwordHash = await hashPassword(input.password);

      const newUser = await ctx.prisma.user.create({
        data: {
          username: input.username,
          name: input.name,
          passwordHash,
          role: input.role,
          up3Id: input.up3Id || null,
          ulpId: input.ulpId || null,
          isActive: true,
        },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          up3Id: true,
          ulpId: true,
        },
      });

      await logAuditEvent({
        userId: ctx.user.id,
        action: "USER_CREATE",
        entityType: "User",
        entityId: newUser.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          createdUsername: newUser.username,
          role: newUser.role,
          up3Id: newUser.up3Id,
          ulpId: newUser.ulpId,
        },
      });

      return { success: true, user: newUser };
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(2),
        role: z.nativeEnum(Role),
        up3Id: z.string().optional().nullable(),
        ulpId: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.role === Role.PETUGAS_LAPANGAN && (!input.up3Id || !input.ulpId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Petugas Lapangan wajib memiliki UP3 dan ULP penugasan.",
        });
      }

      const updated = await ctx.prisma.user.update({
        where: { id: input.id },
        data: {
          name: input.name,
          role: input.role,
          up3Id: input.up3Id || null,
          ulpId: input.ulpId || null,
          ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
        },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
        },
      });

      await logAuditEvent({
        userId: ctx.user.id,
        action: "USER_UPDATE",
        entityType: "User",
        entityId: updated.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          updatedRole: updated.role,
          isActive: updated.isActive,
        },
      });

      return { success: true, user: updated };
    }),

  toggleStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Anda tidak dapat menonaktifkan akun Anda sendiri.",
        });
      }

      const updated = await ctx.prisma.user.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
        select: { id: true, username: true, isActive: true },
      });

      await logAuditEvent({
        userId: ctx.user.id,
        action: "USER_STATUS_TOGGLE",
        entityType: "User",
        entityId: updated.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          username: updated.username,
          newStatus: updated.isActive ? "ACTIVE" : "INACTIVE",
        },
      });

      return { success: true, user: updated };
    }),

  resetPassword: adminProcedure
    .input(
      z.object({
        id: z.string(),
        newPassword: z.string().min(6).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const passwordToSet = input.newPassword || "PLN_2026_Temp!";
      const passwordHash = await hashPassword(passwordToSet);

      const updated = await ctx.prisma.user.update({
        where: { id: input.id },
        data: { passwordHash },
        select: { id: true, username: true },
      });

      await logAuditEvent({
        userId: ctx.user.id,
        action: "USER_PASSWORD_RESET",
        entityType: "User",
        entityId: updated.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          targetUsername: updated.username,
        },
      });

      return {
        success: true,
        temporaryPassword: passwordToSet,
        message: `Password untuk ${updated.username} berhasil di-reset.`,
      };
    }),

  getUnitOptions: adminProcedure.query(async ({ ctx }) => {
    const up3s = await ctx.prisma.uP3.findMany({
      orderBy: { name: "asc" },
      include: {
        ulps: {
          orderBy: { name: "asc" },
          select: { id: true, code: true, name: true, up3Id: true },
        },
      },
    });

    return { up3s };
  }),

  getAuditLogs: adminProcedure
    .input(
      z.object({
        action: z.string().optional(),
        entityType: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      return getAuditLogs(input);
    }),
});
