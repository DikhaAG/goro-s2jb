// UID S2JB runs on WIB, which is UTC+7 all year (no daylight saving), so a fixed offset is exact.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The WIB calendar date of an instant, as "YYYY-MM-DD". */
export function wibDateOf(instant: Date): string {
  return new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's WIB calendar date, as "YYYY-MM-DD". */
export function wibToday(now: Date = new Date()): string {
  return wibDateOf(now);
}

/** The UTC instant at which a WIB calendar date begins. */
export function wibDayStart(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - WIB_OFFSET_MS);
}
