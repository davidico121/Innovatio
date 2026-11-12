export const TZ = "Africa/Lagos";

/** Today's date as YYYY-MM-DD in Lagos time. */
export function todayLagos(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function shiftDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Last n dates, newest first, starting today. */
export function recentDates(n: number): string[] {
  const t = todayLagos();
  return Array.from({ length: n }, (_, i) => shiftDate(t, -i));
}

/** Whether a YYYY-MM-DD date is a Saturday or Sunday. */
export function isWeekend(ymd: string): boolean {
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** A day counts for an IPA on weekdays always, and on weekends only when the IPA says so. */
export function isDueDay(ymd: string, countsWeekends: boolean): boolean {
  return countsWeekends || !isWeekend(ymd);
}
