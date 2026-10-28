import { router, publicProcedure } from "../trpc";
import { z } from "zod";

export const masterRouter = router({
  getUnits: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.uP3.findMany({
      orderBy: { code: "asc" },
      include: {
        ulps: {
          orderBy: { code: "asc" },
        },
      },
    });
  }),

  getUlps: publicProcedure
    .input(
      z
        .object({
          up3Id: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.uLP.findMany({
        where: input?.up3Id ? { up3Id: input.up3Id } : undefined,
        orderBy: { code: "asc" },
        include: {
          up3: true,
        },
      });
    }),

  getVersions: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.appVersion.findMany({
      where: { isActive: true },
      orderBy: { version: "desc" },
    });
  }),

  getTargets: publicProcedure
    .input(
      z
        .object({
          ulpId: z.string().optional(),
          targetDate: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.targetMaster.findMany({
        where: {
          ...(input?.ulpId ? { ulpId: input.ulpId } : {}),
          ...(input?.targetDate ? { targetDate: new Date(input.targetDate) } : {}),
        },
        include: {
          ulp: {
            include: {
              up3: true,
            },
          },
        },
        orderBy: { targetDate: "asc" },
      });
    }),
});
