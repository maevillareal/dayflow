import type { Routine, SkincareLog, SkincareProduct } from "../data/types";
import { weekdayOf, type DateKey } from "../lib/dates";

export const usesOn = (p: SkincareProduct, weekday: number) => p.days.length === 0 || p.days.includes(weekday);

export function productsFor(products: SkincareProduct[], day: DateKey, routine: Routine) {
  const wd = weekdayOf(day);
  return products.filter((p) => p.routines.includes(routine) && usesOn(p, wd)).sort((a, b) => a.sort - b.sort);
}

export function routineStatus(products: SkincareProduct[], logs: SkincareLog[], day: DateKey, routine: Routine) {
  const list = productsFor(products, day, routine);
  const done = new Set(logs.filter((l) => l.date === day && l.routine === routine).map((l) => l.product_id));
  return { list, done, complete: list.length > 0 && list.every((p) => done.has(p.id)) };
}

/** Weekdays (0 = Sun) where two or more strong actives are scheduled for the evening. DAYFLOW warns and never schedules them together itself. */
export function activeConflicts(products: SkincareProduct[]): number[] {
  const out: number[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const n = products.filter((p) => p.is_active && p.routines.includes("pm") && usesOn(p, wd)).length;
    if (n >= 2) out.push(wd);
  }
  return out;
}

/** An evening with no strong active scheduled. */
export const isRestNight = (products: SkincareProduct[], day: DateKey) =>
  !products.some((p) => p.is_active && p.routines.includes("pm") && usesOn(p, weekdayOf(day)));

export const activesOn = (products: SkincareProduct[], weekday: number) =>
  products.filter((p) => p.is_active && p.routines.includes("pm") && usesOn(p, weekday));
