import type { SelfCareItem, SelfCareLog } from "../data/types";
import { addDaysKey, daysBetween, type DateKey } from "../lib/dates";

export function lastDone(logs: SelfCareLog[], itemId: string): DateKey | null {
  let last: DateKey | null = null;
  for (const l of logs) if (l.item_id === itemId && (!last || l.date > last)) last = l.date;
  return last;
}

export const doneOn = (logs: SelfCareLog[], itemId: string, day: DateKey) => logs.some((l) => l.item_id === itemId && l.date === day);

/** A manually planned date wins; otherwise last done + frequency; never done yet means today. */
export function nextDue(item: SelfCareItem, logs: SelfCareLog[], today: DateKey): DateKey {
  if (item.next_planned) return item.next_planned;
  const last = lastDone(logs, item.id);
  return last ? addDaysKey(last, Math.max(1, item.frequency_days)) : today;
}

export type DueTone = "past" | "today" | "soon" | "later";

/** Gentle wording: an item past its planned date isn't "failed", it was just planned earlier. */
export function dueInfo(next: DateKey, today: DateKey): { days: number; label: string; tone: DueTone } {
  const days = daysBetween(today, next);
  if (days === 0) return { days, label: "Due today", tone: "today" };
  if (days < 0) return { days, label: days === -1 ? "Planned for yesterday" : `Planned ${-days} days ago`, tone: "past" };
  if (days === 1) return { days, label: "Due tomorrow", tone: "soon" };
  return { days, label: `Due in ${days} days`, tone: days <= 3 ? "soon" : "later" };
}

export const isDueNow = (item: SelfCareItem, logs: SelfCareLog[], today: DateKey) =>
  !doneOn(logs, item.id, today) && daysBetween(today, nextDue(item, logs, today)) <= 0;

export function frequencyLabel(days: number) {
  if (days === 1) return "Daily";
  if (days === 7) return "Weekly";
  if (days === 14) return "Every 2 weeks";
  if (days % 7 === 0) return `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}
