import type { PrismaClient } from "@prisma/client";

/**
 * True when the ULP exists and sits under the given UP3.
 */
export async function isValidUnitPair(
  db: Pick<PrismaClient, "uLP">,
  up3Id: string,
  ulpId: string
): Promise<boolean> {
  const ulp = await db.uLP.findFirst({ where: { id: ulpId, up3Id }, select: { id: true } });
  return ulp !== null;
}
