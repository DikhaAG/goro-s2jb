import { initTRPC, TRPCError } from "@trpc/server";
import { Context } from "./context";
import { Role } from "@prisma/client";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Autentikasi diperlukan untuk mengakses sumber daya ini.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const isFieldOfficer = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const allowed: Role[] = [Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN];
  if (!allowed.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Hanya Petugas Lapangan atau Super Admin yang diizinkan.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const isOperator = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const allowed: Role[] = [Role.PEGAWAI, Role.SUPER_ADMIN];
  if (!allowed.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Hanya Pegawai Operator atau Super Admin yang diizinkan.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const isExecutive = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const allowed: Role[] = [Role.MANAGER, Role.SUPER_ADMIN];
  if (!allowed.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Hanya Manager atau Super Admin yang diizinkan.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.user.role !== Role.SUPER_ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Akses eksklusif Super Admin.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = publicProcedure.use(isAuthed);
export const fieldProcedure = publicProcedure.use(isFieldOfficer);
export const operatorProcedure = publicProcedure.use(isOperator);
export const executiveProcedure = publicProcedure.use(isExecutive);
export const adminProcedure = publicProcedure.use(isAdmin);
