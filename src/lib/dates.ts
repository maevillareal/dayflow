import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek } from "date-fns";

/** A local calendar date, "yyyy-MM-dd". Check-ins are stored against these, never against timestamps. */
export type DateKey = string;

export const toKey = (d: Date): DateKey => format(d, "yyyy-MM-dd");
export const fromKey = (k: DateKey): Date => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
/** DAYFLOW runs on Eastern Time (EST/EDT), whatever the computer's clock is set to. */
export const APP_TIME_ZONE = "America/New_York";
/**
 * A Date whose local fields (year, month, day, hours…) show Eastern wall-clock time.
 * Use it only for reading the calendar day or the hour, never for comparing instants.
 */
export function zoned(d: Date = new Date()): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return new Date(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}
export const todayKey = (now = new Date()): DateKey => toKey(zoned(now));
/** Eastern calendar day of an ISO timestamp (timestamps are stored in UTC). */
export const isoToKey = (iso: string): DateKey => toKey(zoned(new Date(iso)));
/** Format a timestamp in Eastern Time, e.g. for focus history. */
export const fmtTime = (d: Date | string | number, opts: Intl.DateTimeFormatOptions) => new Date(d).toLocaleString([], { ...opts, timeZone: APP_TIME_ZONE });
export const addDaysKey = (k: DateKey, n: number): DateKey => toKey(addDays(fromKey(k), n));
/** 0 = Sunday … 6 = Saturday */
export const weekdayOf = (k: DateKey) => fromKey(k).getDay();
export const weekStartKey = (k: DateKey): DateKey => toKey(startOfWeek(fromKey(k), { weekStartsOn: 1 }));
export const monthStartKey = (k: DateKey): DateKey => toKey(startOfMonth(fromKey(k)));
export const daysBetween = (from: DateKey, to: DateKey) => differenceInCalendarDays(fromKey(to), fromKey(from));
/** n keys ending at (and including) `end`, oldest first. */
export const lastNDays = (end: DateKey, n: number): DateKey[] => Array.from({ length: n }, (_, i) => addDaysKey(end, i - (n - 1)));
export const weekKeys = (anyDay: DateKey): DateKey[] => {
  const s = weekStartKey(anyDay);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(s, i));
};
export const fmt = (k: DateKey, pattern: string) => format(fromKey(k), pattern);
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Mon-first order of weekday numbers, for pickers. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function relativeDue(today: DateKey, due: DateKey): string {
  const d = daysBetween(today, due);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d < 0) return `${-d} days ago`;
  if (d < 7) return fmt(due, "EEEE");
  return fmt(due, "MMM d");
}
