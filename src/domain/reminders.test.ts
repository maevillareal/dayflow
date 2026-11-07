import { describe, expect, it } from "vitest";
import { buildReminders, inQuietHours } from "./reminders";
import { check, ctxOf, fresh, habit, settings } from "./testkit";

const at = (hhmm: string) => new Date(`2026-11-08T${hhmm}:00`);

describe("buildReminders", () => {
  it("never reminds about a habit that's already done", () => {
    const db = fresh();
    const a = habit(db, { name: "Stretch", category: "Exercise" });
    const b = habit(db, { name: "Work on a design project" });
    check(db, a.id, "2026-11-08");
    const r = buildReminders(ctxOf(db), at("14:00"), settings());
    expect(r.map((x) => x.action)).toEqual([{ kind: "habit", habitId: b.id }]);
  });

  it("hides dismissed reminders for the rest of the day without marking them done", () => {
    const db = fresh();
    const a = habit(db, {});
    db.reminder_state.push({ id: "r", key: `habit:${a.id}:2026-11-08`, snoozed_until: null, dismissed_on: "2026-11-08" });
    expect(buildReminders(ctxOf(db), at("14:00"), settings())).toEqual([]);
    expect(db.habit_checkins).toEqual([]);
  });

  it("brings snoozed reminders back after the snooze ends", () => {
    const db = fresh();
    const a = habit(db, {});
    db.reminder_state.push({ id: "r", key: `habit:${a.id}:2026-11-08`, snoozed_until: at("15:00").toISOString(), dismissed_on: null });
    expect(buildReminders(ctxOf(db), at("14:30"), settings())).toHaveLength(0);
    expect(buildReminders(ctxOf(db), at("15:01"), settings())).toHaveLength(1);
  });

  it("respects quiet hours, disabled categories and the companion switch", () => {
    const db = fresh();
    habit(db, { category: "Exercise" });
    const s = settings();
    expect(buildReminders(ctxOf(db), at("23:00"), s, { respectQuiet: true })).toEqual([]);
    expect(buildReminders(ctxOf(db), at("23:00"), s)).toHaveLength(1);
    s.notifications.categories.Exercise = false;
    expect(buildReminders(ctxOf(db), at("14:00"), s)).toEqual([]);
    s.notifications.categories.Exercise = true;
    s.companions.enabled = false;
    expect(buildReminders(ctxOf(db), at("14:00"), s)).toEqual([]);
  });

  it("assigns Lei or Tobi by category, or one companion for everything", () => {
    const db = fresh();
    habit(db, { category: "Exercise" });
    habit(db, { category: "No Sugar" });
    const s = settings();
    expect(buildReminders(ctxOf(db), at("14:00"), s).map((r) => r.who)).toEqual(["dog", "cat"]);
    s.companions.who = "cat";
    expect(buildReminders(ctxOf(db), at("14:00"), s).map((r) => r.who)).toEqual(["cat", "cat"]);
  });

  it("asks about the evening skincare routine only in the evening", () => {
    const db = fresh();
    db.skincare_products.push({ id: "t", name: "Toner", type: "", routines: ["pm"], days: [], is_active: false, notes: "", sort: 0 });
    expect(buildReminders(ctxOf(db), at("14:00"), settings())).toEqual([]);
    expect(buildReminders(ctxOf(db), at("20:00"), settings())[0].action).toEqual({ kind: "skincare", routine: "pm" });
  });
});

describe("inQuietHours", () => {
  it("handles ranges that cross midnight", () => {
    expect(inQuietHours(at("23:30"), "22:00", "07:00")).toBe(true);
    expect(inQuietHours(at("06:59"), "22:00", "07:00")).toBe(true);
    expect(inQuietHours(at("07:00"), "22:00", "07:00")).toBe(false);
    expect(inQuietHours(at("13:00"), "12:00", "14:00")).toBe(true);
  });
});
