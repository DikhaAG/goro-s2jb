import prisma from "@/lib/prisma";
import { createAchievementReport } from "./achievementReport";

/** Laporan Capaian wired to the application database and the system clock. */
export const achievementReport = createAchievementReport({ db: prisma, now: () => new Date() });
