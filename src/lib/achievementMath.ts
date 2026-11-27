/**
 * The Laporan Capaian achievement rules. Pure and free of server imports, so the
 * report module and the manager tables compute percentage and status the same way.
 */

export type AchievementStatus = "TERCAPAI" | "TIDAK TERCAPAI";

/** Realisasi as a percentage of target, rounded to one decimal; 0 when there is no target. */
export function achievementPercentage(realization: number, target: number): number {
  return target > 0 ? Math.round((realization / target) * 1000) / 10 : 0;
}

/** Compared on the unrounded counts, so 99.95% is not rounded up into TERCAPAI. */
export function achievementStatus(realization: number, target: number): AchievementStatus {
  return target > 0 && realization >= target ? "TERCAPAI" : "TIDAK TERCAPAI";
}
