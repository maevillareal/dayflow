import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek } from "date-fns";

/** A local calendar date, "yyyy-MM-dd". Check-ins are stored against these, never against timestamps. */
export type DateKey = string;

export const toKey = (d: Date): DateKey => format(d, "yyyy-MM-dd");
export const fromKey = (k: DateKey): Date => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const todayKey = (now = new Date()): DateKey => toKey(now);
/** Local calendar day of an ISO timestamp (timestamps are stored in UTC). */
export const isoToKey = (iso: string): DateKey => toKey(new Date(iso));
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
