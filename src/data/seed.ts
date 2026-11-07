import { CATEGORIES, type Category } from "../lib/categories";
import { addDaysKey, lastNDays, weekStartKey, weekdayOf, type DateKey } from "../lib/dates";
import { hash01, uid } from "../lib/util";
import type { DB, Habit, HabitSchedule, Profile, Settings, ScheduleKind } from "./types";
import { isHabitDue, buildIndex } from "../domain/schedule";
import { productsFor } from "../domain/skincare";

export const defaultSettings = (): Settings => ({
  companions: { enabled: true, who: "both", celebrations: true },
  notifications: {
    enabled: false,
    quietStart: "22:00",
    quietEnd: "07:00",
    snoozeMinutes: 30,
    minGapMinutes: 45,
    categories: Object.fromEntries(CATEGORIES.map((c) => [c, true])) as Record<Category, boolean>,
  },
  extensionId: "",
});

type HabitSeed = [name: string, category: Category, kind: ScheduleKind, extra?: Partial<HabitSchedule>];
const HABITS: HabitSeed[] = [
  ["Work on a design project", "MVG", "daily"],
  ["Create or plan content", "MVG", "weekdays", { days: [1, 3, 5] }],
  ["Workout", "Exercise", "weekly_target", { target: 3 }],
  ["Walk for at least 20 minutes", "Exercise", "daily"],
  ["Stretch", "Exercise", "daily"],
  ["Drink 8 glasses of water", "Eat Healthy", "daily"],
  ["Eat fruits & vegetables", "Eat Healthy", "daily"],
  ["Stay within my calorie goal", "Eat Healthy", "daily"],
  ["No added sugar", "No Sugar", "daily"],
];

/** Starter content for a brand-new account. No history: real stats come only from what the user records. */
export function starterData(today: DateKey, displayName: string): Partial<DB> {
  const habits: Habit[] = [];
  const schedules: HabitSchedule[] = [];
  HABITS.forEach(([name, category, kind, extra], i) => {
    const h: Habit = { id: uid(), name, description: "", category, start_date: today, archived_at: null, sort: i };
    habits.push(h);
    schedules.push({ id: uid(), habit_id: h.id, effective_from: today, kind, days: [], target: 0, interval_days: 0, ...extra });
  });
  const profile: Profile = { id: uid(), display_name: displayName, settings: defaultSettings() };
  return {
    profiles: [profile],
    habits,
    habit_schedules: schedules,
    selfcare_items: [
      ["Hair Check", 7],
      ["Eyebrow Trim", 14],
      ["Nail Cut", 10],
      ["Nose Trim", 7],
      ["Shave", 7],
    ].map(([name, f], i) => ({ id: uid(), name: name as string, frequency_days: f as number, next_planned: null, reminder: true, notes: "", sort: i })),
    skincare_products: [
      { name: "Toner", type: "Toner", routines: ["am", "pm"], days: [], is_active: false },
      { name: "Lotion", type: "Moisturizer", routines: ["am", "pm"], days: [], is_active: false },
      { name: "Myra E", type: "Vitamin E", routines: ["am"], days: [], is_active: false },
      { name: "Glycolic Acid", type: "Exfoliant (AHA)", routines: ["pm"], days: [3, 6], is_active: true },
      { name: "Tretinoin", type: "Retinoid", routines: ["pm"], days: [1, 4], is_active: true },
    ].map((p, i) => ({ id: uid(), notes: "", sort: i, ...p })) as DB["skincare_products"],
    focus_profiles: [
      { id: uid(), name: "Deep Work", domains: ["facebook.com", "instagram.com", "tiktok.com", "youtube.com", "reddit.com", "x.com"], allow: [] },
      { id: uid(), name: "Creative Work", domains: ["facebook.com", "tiktok.com", "reddit.com", "x.com"], allow: ["pinterest.com"] },
      { id: uid(), name: "Learning", domains: ["facebook.com", "instagram.com", "tiktok.com", "x.com"], allow: ["youtube.com"] },
    ],
  };
}

/** Demo mode only: ~10 weeks of plausible history so the charts have something to show. */
export function demoHistory(db: DB, today: DateKey): Partial<DB> {
  const start = addDaysKey(today, -70);
  const habits = db.habits.map((h) => ({ ...h, start_date: start }));
  const schedules = db.habit_schedules.map((s) => ({ ...s, effective_from: start }));
  const rate: Record<Category, number> = { MVG: 0.78, Exercise: 0.62, "Self Care": 0.8, "Skin Care": 0.85, "Eat Healthy": 0.66, "No Sugar": 0.72 };
  const checkins: DB["habit_checkins"] = [];
  const idx = buildIndex({ habit_schedules: schedules, habit_checkins: [] });
  for (const day of lastNDays(addDaysKey(today, -1), 70)) {
    for (const h of habits) {
      const kind = schedules.find((s) => s.habit_id === h.id)?.kind;
      if (kind === "weekly_target") {
        if ([1, 3, 6].includes(weekdayOf(day)) && hash01(h.id + day) < 0.8) checkins.push({ id: uid(), habit_id: h.id, date: day });
        continue;
      }
      if (isHabitDue(h, idx, day) && hash01(h.id + day) < rate[h.category]) checkins.push({ id: uid(), habit_id: h.id, date: day });
    }
  }
  // Today: about half done, so the dashboard has something to tick off.
  for (const h of habits.slice(0, 5)) if (hash01(h.id + today) < 0.6) checkins.push({ id: uid(), habit_id: h.id, date: today });

  const selfcare_log: DB["selfcare_log"] = [];
  db.selfcare_items.forEach((it, i) => {
    for (let d = -70 + i * 2; d < -1; d += it.frequency_days) selfcare_log.push({ id: uid(), item_id: it.id, date: addDaysKey(today, d), notes: "" });
  });

  const skincare_log: DB["skincare_log"] = [];
  for (const day of lastNDays(addDaysKey(today, -1), 60)) {
    for (const routine of ["am", "pm"] as const) {
      if (hash01(day + routine) > 0.82) continue;
      for (const p of productsFor(db.skincare_products, day, routine)) skincare_log.push({ id: uid(), product_id: p.id, date: day, routine });
    }
  }

  const focus_sessions: DB["focus_sessions"] = [];
  const cats: Category[] = ["MVG", "MVG", "MVG", "Exercise", "Self Care"];
  for (const day of lastNDays(addDaysKey(today, -1), 42)) {
    const n = Math.floor(hash01("f" + day) * 3);
    for (let k = 0; k < n; k++) {
      const planned = [25, 25, 45, 60][Math.floor(hash01(day + k) * 4)];
      const interrupted = hash01("i" + day + k) < 0.12;
      const start = new Date(`${day}T${String(9 + k * 3).padStart(2, "0")}:00:00`);
      const actual = interrupted ? Math.round(planned * 60 * 0.4) : planned * 60;
      focus_sessions.push({
        id: uid(),
        started_at: start.toISOString(),
        ended_at: new Date(start.getTime() + actual * 1000).toISOString(),
        planned_min: planned,
        actual_sec: actual,
        category: cats[Math.floor(hash01("c" + day + k) * cats.length)],
        task_id: null,
        mode: interrupted ? "strict" : "normal",
        profile_id: db.focus_profiles[0]?.id ?? null,
        status: interrupted ? "interrupted" : "completed",
      });
    }
  }

  const wk = weekStartKey(today);
  const tasks: DB["tasks"] = (
    [
      ["Send Christmas coloring book proofs", "MVG", "High", 0, false],
      ["Book dentist appointment", "Self Care", "Medium", 0, false],
      ["Draft December content plan", "MVG", "Low", 2, false],
      ["Renew domain for portfolio", "MVG", "High", -2, false],
      ["Export KDP cover files", "MVG", "High", -2, true],
      ["Buy new toner", "Skin Care", "Medium", -1, true],
      ["Plan weekly meal prep", "Eat Healthy", "Low", -4, true],
      ["Renew gym pass", "Exercise", "Medium", -3, true],
      ["Clear sweets from the pantry", "No Sugar", "Low", -5, true],
      ["Order fruit delivery", "Eat Healthy", "Low", 4, false],
    ] as [string, Category, "High" | "Medium" | "Low", number, boolean][]
  ).map(([title, category, priority, offset, done]) => {
    const due = addDaysKey(today, offset);
    return {
      id: uid(),
      title,
      description: "",
      category,
      priority,
      due_date: due < wk && done ? addDaysKey(wk, 1) : due,
      status: done ? "done" : "open",
      notes: "",
      completed_at: done ? new Date(`${due}T15:00:00`).toISOString() : null,
    } as DB["tasks"][number];
  });

  return { habits, habit_schedules: schedules, habit_checkins: checkins, selfcare_log, skincare_log, focus_sessions, tasks };
}
