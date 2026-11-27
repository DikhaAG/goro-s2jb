import prisma from "@/lib/prisma";
import { createAchievementReport, createReportSyncStamp } from "./achievementReport";

/** The sync stamp on the application Redis, loaded on first use so importing this never opens a connection. */
export const reportSyncStamp = createReportSyncStamp(async () => (await import("@/lib/redis")).default);

/** Laporan Capaian wired to the application database, Redis and the system clock. */
export const achievementReport = createAchievementReport({
  db: prisma,
  now: () => new Date(),
  syncStamp: reportSyncStamp,
});
