import type { DB, Habit } from "../data/types";
import { CATEGORIES, inFilter, type Category, type CategoryFilter } from "../lib/categories";
import { addDaysKey, weekStartKey, type DateKey } from "../lib/dates";
import { buildIndex, doneInWeek, isDone, isHabitDue, scheduleOn, type Index } from "./schedule";

export interface Ctx {
  db: DB;
  idx: Index;
}
export const makeCtx = (db: DB): Ctx => ({ db, idx: buildIndex(db) });

export interface Count {
  due: number;
  done: number;
}

export function dayCount(ctx: Ctx, day: DateKey, filter: CategoryFilter = "All"): Count {
  let due = 0;
  let done = 0;
  for (const h of ctx.db.habits) {
    if (!inFilter(h.category, filter) || !isHabitDue(h, ctx.idx, day)) continue;
    due++;
    if (isDone(ctx.idx, h.id, day)) done++;
  }
  return { due, done };
}

export function rangeCount(ctx: Ctx, days: DateKey[], filter: CategoryFilter = "All"): Count {
  return days.reduce<Count>(
    (acc, d) => {
      const c = dayCount(ctx, d, filter);
      return { due: acc.due + c.due, done: acc.done + c.done };
    },
    { due: 0, done: 0 },
  );
}

export const pctOf = (c: Count) => (c.due ? Math.round((c.done / c.due) * 100) : 0);

/** Daily completion %, or null on days with nothing scheduled (so charts leave a gap instead of a fake 0). */
export const series = (ctx: Ctx, days: DateKey[], filter: CategoryFilter = "All") =>
  days.map((d) => {
    const c = dayCount(ctx, d, filter);
    return c.due ? Math.round((c.done / c.due) * 100) : null;
  });

export function categoryDay(ctx: Ctx, day: DateKey): Record<Category, Count> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, { due: 0, done: 0 }])) as Record<Category, Count>;
  for (const h of ctx.db.habits) {
    if (!isHabitDue(h, ctx.idx, day)) continue;
    out[h.category].due++;
    if (isDone(ctx.idx, h.id, day)) out[h.category].done++;
  }
  return out;
}

/** Categories you showed up for on a day: any habit check-in, self-care log or skincare log. */
export function categoryMarks(ctx: Ctx, day: DateKey): Set<Category> {
  const marks = new Set<Category>();
  const byId = new Map(ctx.db.habits.map((h) => [h.id, h]));
  for (const c of ctx.db.habit_checkins) if (c.date === day) {
    const h = byId.get(c.habit_id);
    if (h) marks.add(h.category);
  }
  if (ctx.db.selfcare_log.some((l) => l.date === day)) marks.add("Self Care");
  if (ctx.db.skincare_log.some((l) => l.date === day)) marks.add("Skin Care");
  return marks;
}

/**
 * Streak for one habit, following its own schedule:
 * days in a row where it was scheduled and done; unscheduled days are skipped,
 * and today not being done yet doesn't break it. Weekly-target habits count weeks that met the target.
 */
export function habitStreak(ctx: Ctx, h: Habit, today: DateKey): number {
  const s = scheduleOn(ctx.idx, h.id, today);
  if (s?.kind === "weekly_target") {
    let n = 0;
    let wk = weekStartKey(today);
    if (doneInWeek(ctx.idx, h.id, wk) >= s.target) n++;
    for (let i = 0; i < 520; i++) {
      wk = addDaysKey(wk, -7);
      if (wk < weekStartKey(h.start_date)) break;
      const target = scheduleOn(ctx.idx, h.id, wk)?.target ?? s.target;
      if (doneInWeek(ctx.idx, h.id, wk) >= target) n++;
      else break;
    }
    return n;
  }
  let n = 0;
  let day = today;
  if (isHabitDue(h, ctx.idx, day) && isDone(ctx.idx, h.id, day)) n++;
  for (let i = 0; i < 3650; i++) {
    day = addDaysKey(day, -1);
    if (day < h.start_date) break;
    if (!isHabitDue(h, ctx.idx, day)) continue;
    if (isDone(ctx.idx, h.id, day)) n++;
    else break;
  }
  return n;
}

/** Days in a row with at least one habit done in the filter. Today only adds; it never breaks the run. */
export function showUpStreak(ctx: Ctx, today: DateKey, filter: CategoryFilter = "All"): number {
  const ids = new Set(ctx.db.habits.filter((h) => inFilter(h.category, filter)).map((h) => h.id));
  const days = new Set(ctx.db.habit_checkins.filter((c) => ids.has(c.habit_id)).map((c) => c.date));
  let n = days.has(today) ? 1 : 0;
  for (let d = addDaysKey(today, -1); days.has(d); d = addDaysKey(d, -1)) n++;
  return n;
}

export const activeHabits = (db: DB) => db.habits.filter((h) => !h.archived_at).sort((a, b) => a.sort - b.sort);
