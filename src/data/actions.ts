import type { Category } from "../lib/categories";
import { type DateKey } from "../lib/dates";
import { nowIso, uid } from "../lib/util";
import type { ReminderAction } from "../domain/reminders";
import { productsFor } from "../domain/skincare";
import type { Store } from "./store";
import type { Habit, HabitSchedule, Routine, Settings, Task } from "./types";

/** Check a habit off for a specific date, or undo it. Each check-in is saved against its own date. */
export function toggleCheckin(store: Store, habitId: string, day: DateKey) {
  const existing = store.db.habit_checkins.filter((c) => c.habit_id === habitId && c.date === day);
  if (existing.length) {
    store.remove("habit_checkins", existing.map((c) => c.id));
    return false;
  }
  store.upsert("habit_checkins", [{ id: uid(), habit_id: habitId, date: day }]);
  return true;
}

export function setCheckin(store: Store, habitId: string, day: DateKey) {
  if (!store.db.habit_checkins.some((c) => c.habit_id === habitId && c.date === day)) store.upsert("habit_checkins", [{ id: uid(), habit_id: habitId, date: day }]);
}

export type HabitDraft = Pick<Habit, "name" | "description" | "category" | "start_date"> & Pick<HabitSchedule, "kind" | "days" | "target" | "interval_days">;

export function createHabit(store: Store, d: HabitDraft) {
  const h: Habit = { id: uid(), name: d.name.trim(), description: d.description.trim(), category: d.category, start_date: d.start_date, archived_at: null, sort: store.db.habits.length };
  store.upsert("habits", [h]);
  store.upsert("habit_schedules", [{ id: uid(), habit_id: h.id, effective_from: d.start_date, kind: d.kind, days: d.days, target: d.target, interval_days: d.interval_days }]);
}

/**
 * Edit a habit. A schedule change is saved as a new version starting today,
 * so it never rewrites how earlier days are counted.
 */
export function updateHabit(store: Store, habit: Habit, d: HabitDraft, today: DateKey, current?: HabitSchedule) {
  store.upsert("habits", [{ ...habit, name: d.name.trim(), description: d.description.trim(), category: d.category, start_date: d.start_date }]);
  const changed = !current || current.kind !== d.kind || current.target !== d.target || current.interval_days !== d.interval_days || [...current.days].sort().join() !== [...d.days].sort().join();
  if (!changed) return;
  const sameDay = store.db.habit_schedules.find((s) => s.habit_id === habit.id && s.effective_from === today);
  const from = today < d.start_date ? d.start_date : today;
  store.upsert("habit_schedules", [{ id: sameDay?.id ?? uid(), habit_id: habit.id, effective_from: from, kind: d.kind, days: d.days, target: d.target, interval_days: d.interval_days }]);
}

export const archiveHabit = (store: Store, h: Habit, today: DateKey) => store.upsert("habits", [{ ...h, archived_at: today }]);
export const restoreHabit = (store: Store, h: Habit) => store.upsert("habits", [{ ...h, archived_at: null }]);
export function deleteHabit(store: Store, h: Habit) {
  store.remove("habit_checkins", store.db.habit_checkins.filter((c) => c.habit_id === h.id).map((c) => c.id));
  store.remove("habit_schedules", store.db.habit_schedules.filter((s) => s.habit_id === h.id).map((s) => s.id));
  store.remove("habits", [h.id]);
}

export type TaskDraft = Pick<Task, "title" | "description" | "category" | "priority" | "due_date" | "notes">;
export function saveTask(store: Store, d: TaskDraft, existing?: Task) {
  const base: Task = existing ?? { id: uid(), title: "", description: "", category: "MVG", priority: "Medium", due_date: null, status: "open", notes: "", completed_at: null };
  store.upsert("tasks", [{ ...base, ...d, title: d.title.trim() }]);
}
export function toggleTask(store: Store, t: Task) {
  const done = t.status !== "done";
  store.upsert("tasks", [{ ...t, status: done ? "done" : "open", completed_at: done ? nowIso() : null }]);
  return done;
}

/** Log a self-care item as done today. Its next date then follows from its frequency. */
export function logSelfcare(store: Store, itemId: string, day: DateKey) {
  if (!store.db.selfcare_log.some((l) => l.item_id === itemId && l.date === day)) store.upsert("selfcare_log", [{ id: uid(), item_id: itemId, date: day, notes: "" }]);
  const item = store.db.selfcare_items.find((i) => i.id === itemId);
  if (item?.next_planned) store.upsert("selfcare_items", [{ ...item, next_planned: null }]);
}
export function unlogSelfcare(store: Store, itemId: string, day: DateKey) {
  store.remove("selfcare_log", store.db.selfcare_log.filter((l) => l.item_id === itemId && l.date === day).map((l) => l.id));
}

export function toggleSkincare(store: Store, productId: string, day: DateKey, routine: Routine) {
  const ex = store.db.skincare_log.filter((l) => l.product_id === productId && l.date === day && l.routine === routine);
  if (ex.length) store.remove("skincare_log", ex.map((l) => l.id));
  else store.upsert("skincare_log", [{ id: uid(), product_id: productId, date: day, routine }]);
}
export function completeRoutine(store: Store, day: DateKey, routine: Routine) {
  const have = new Set(store.db.skincare_log.filter((l) => l.date === day && l.routine === routine).map((l) => l.product_id));
  store.upsert(
    "skincare_log",
    productsFor(store.db.skincare_products, day, routine)
      .filter((p) => !have.has(p.id))
      .map((p) => ({ id: uid(), product_id: p.id, date: day, routine })),
  );
}

/** A reminder's "Done" writes the real record, exactly as if the user had ticked it on its page. */
export function completeReminder(store: Store, a: ReminderAction, day: DateKey) {
  if (a.kind === "habit") setCheckin(store, a.habitId, day);
  else if (a.kind === "selfcare") logSelfcare(store, a.itemId, day);
  else completeRoutine(store, day, a.routine);
}

/** Later and Dismiss only change when the reminder shows. They never mark anything done. */
export function setReminderState(store: Store, key: string, patch: { snoozed_until?: string | null; dismissed_on?: DateKey | null }) {
  const ex = store.db.reminder_state.find((r) => r.key === key);
  store.upsert("reminder_state", [{ id: ex?.id ?? uid(), key, snoozed_until: ex?.snoozed_until ?? null, dismissed_on: ex?.dismissed_on ?? null, ...patch }]);
}

export function saveSettings(store: Store, patch: (s: Settings) => Settings, current: Settings, displayName?: string) {
  const p = store.db.profiles[0];
  const next = patch(structuredClone(current));
  store.upsert("profiles", [{ id: p?.id ?? uid(), display_name: displayName ?? p?.display_name ?? "", settings: next }]);
}

export const newHabitDraft = (today: DateKey, category: Category = "MVG"): HabitDraft => ({
  name: "",
  description: "",
  category,
  start_date: today,
  kind: "daily",
  days: [1, 3, 5],
  target: 3,
  interval_days: 2,
});
