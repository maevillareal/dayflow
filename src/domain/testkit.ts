// Small builders shared by the domain tests.
import { defaultSettings } from "../data/seed";
import { emptyDB, type DB, type Habit, type HabitSchedule, type ScheduleKind } from "../data/types";
import type { Category } from "../lib/categories";
import type { DateKey } from "../lib/dates";
import { makeCtx } from "./stats";

let n = 0;
const id = (p: string) => `${p}${++n}`;

export function habit(db: DB, opts: { name?: string; category?: Category; start?: DateKey; kind?: ScheduleKind; days?: number[]; target?: number; interval?: number; archived?: DateKey }) {
  const h: Habit = {
    id: id("h"),
    name: opts.name ?? "Habit",
    description: "",
    category: opts.category ?? "MVG",
    start_date: opts.start ?? "2026-01-01",
    archived_at: opts.archived ?? null,
    sort: db.habits.length,
  };
  db.habits.push(h);
  schedule(db, h.id, h.start_date, opts.kind ?? "daily", { days: opts.days, target: opts.target, interval_days: opts.interval });
  return h;
}

export function schedule(db: DB, habitId: string, from: DateKey, kind: ScheduleKind, extra: Partial<HabitSchedule> = {}) {
  db.habit_schedules.push({ id: id("s"), habit_id: habitId, effective_from: from, kind, days: extra.days ?? [], target: extra.target ?? 0, interval_days: extra.interval_days ?? 0 });
}

export const check = (db: DB, habitId: string, ...dates: DateKey[]) => dates.forEach((date) => db.habit_checkins.push({ id: id("c"), habit_id: habitId, date }));

export const fresh = () => emptyDB();
export const ctxOf = (db: DB) => makeCtx(db);
export const settings = defaultSettings;
