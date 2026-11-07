import type { DB, Habit, HabitSchedule } from "../data/types";
import { addDaysKey, daysBetween, weekStartKey, weekdayOf, type DateKey } from "../lib/dates";

export interface Index {
  /** Per habit, schedule versions sorted oldest first. */
  schedules: Map<string, HabitSchedule[]>;
  checks: Map<string, Set<DateKey>>;
}

export function buildIndex(db: Pick<DB, "habit_schedules" | "habit_checkins">): Index {
  const schedules = new Map<string, HabitSchedule[]>();
  for (const s of db.habit_schedules) {
    const list = schedules.get(s.habit_id) ?? [];
    list.push(s);
    schedules.set(s.habit_id, list);
  }
  for (const list of schedules.values()) list.sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const checks = new Map<string, Set<DateKey>>();
  for (const c of db.habit_checkins) {
    const set = checks.get(c.habit_id) ?? new Set<DateKey>();
    set.add(c.date);
    checks.set(c.habit_id, set);
  }
  return { schedules, checks };
}

/** The schedule version in effect on `day` (the latest one that started on or before it). */
export function scheduleOn(idx: Index, habitId: string, day: DateKey): HabitSchedule | undefined {
  const list = idx.schedules.get(habitId);
  if (!list?.length) return undefined;
  let found: HabitSchedule | undefined;
  for (const s of list) {
    if (s.effective_from <= day) found = s;
    else break;
  }
  // Before the first version existed, the first version applies (covers start_date earlier than effective_from).
  return found ?? list[0];
}

export const isDone = (idx: Index, habitId: string, day: DateKey) => idx.checks.get(habitId)?.has(day) ?? false;

/** Check-ins in the Mon–Sun week containing `day`, counting only days before `day`. */
export function doneEarlierThisWeek(idx: Index, habitId: string, day: DateKey) {
  const set = idx.checks.get(habitId);
  if (!set) return 0;
  let n = 0;
  for (let d = weekStartKey(day); d < day; d = addDaysKey(d, 1)) if (set.has(d)) n++;
  return n;
}

export function doneInWeek(idx: Index, habitId: string, anyDay: DateKey) {
  const set = idx.checks.get(habitId);
  if (!set) return 0;
  let n = 0;
  const s = weekStartKey(anyDay);
  for (let i = 0; i < 7; i++) if (set.has(addDaysKey(s, i))) n++;
  return n;
}

/**
 * Whether a habit counts as scheduled on a day. Unscheduled days never count as missed.
 * Weekly-target habits count on a day when they were done that day, or when skipping that day
 * would make the week's target impossible. So an ordinary rest day isn't a miss.
 */
export function isHabitDue(h: Habit, idx: Index, day: DateKey): boolean {
  if (day < h.start_date) return false;
  if (h.archived_at && day >= h.archived_at) return false;
  const s = scheduleOn(idx, h.id, day);
  if (!s) return false;
  switch (s.kind) {
    case "daily":
      return true;
    case "weekdays":
      return s.days.includes(weekdayOf(day));
    case "interval": {
      const base = s.effective_from > h.start_date ? s.effective_from : h.start_date;
      const n = daysBetween(base, day);
      return n >= 0 && n % Math.max(1, s.interval_days) === 0;
    }
    case "weekly_target": {
      if (isDone(idx, h.id, day)) return true;
      const need = s.target - doneEarlierThisWeek(idx, h.id, day);
      const daysLeft = 7 - ((weekdayOf(day) + 6) % 7);
      return need > 0 && need >= daysLeft;
    }
  }
}

/** Whether the habit can be checked off on this day at all (scheduled, or a weekly-target habit not yet at target). */
export function canCheck(h: Habit, idx: Index, day: DateKey): boolean {
  if (day < h.start_date) return false;
  if (h.archived_at && day >= h.archived_at) return false;
  const s = scheduleOn(idx, h.id, day);
  if (s?.kind === "weekly_target") return true;
  return isHabitDue(h, idx, day);
}

export function describeSchedule(s: HabitSchedule | undefined): string {
  if (!s) return "No schedule";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  switch (s.kind) {
    case "daily":
      return "Daily";
    case "weekdays": {
      const d = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      if (d.length === 5 && !d.includes(0) && !d.includes(6)) return "Weekdays";
      if (d.length === 2 && d.includes(0) && d.includes(6)) return "Weekends";
      return d.map((x) => names[x]).join(" · ") || "No days picked";
    }
    case "weekly_target":
      return `${s.target}× per week`;
    case "interval":
      return s.interval_days === 1 ? "Daily" : `Every ${s.interval_days} days`;
  }
}
