import { describe, expect, it } from "vitest";
import { isHabitDue, canCheck, describeSchedule } from "./schedule";
import { check, ctxOf, fresh, habit, schedule } from "./testkit";

// 2026-11-02 is a Monday; 2026-11-08 is a Sunday.
const MON = "2026-11-02", TUE = "2026-11-03", WED = "2026-11-04", THU = "2026-11-05", FRI = "2026-11-06", SAT = "2026-11-07", SUN = "2026-11-08";

describe("isHabitDue", () => {
  it("daily habits are due every day from their start date", () => {
    const db = fresh();
    const h = habit(db, { start: WED });
    const { idx } = ctxOf(db);
    expect(isHabitDue(h, idx, TUE)).toBe(false);
    expect(isHabitDue(h, idx, WED)).toBe(true);
    expect(isHabitDue(h, idx, SUN)).toBe(true);
  });

  it("specific-weekday habits are due only on those days", () => {
    const db = fresh();
    const h = habit(db, { kind: "weekdays", days: [1, 3, 5] });
    const { idx } = ctxOf(db);
    expect([MON, TUE, WED, THU, FRI, SAT, SUN].map((d) => isHabitDue(h, idx, d))).toEqual([true, false, true, false, true, false, false]);
  });

  it("a schedule change applies from its date on and leaves earlier days alone", () => {
    const db = fresh();
    const h = habit(db, { kind: "daily" });
    schedule(db, h.id, THU, "weekdays", { days: [1] }); // from Thursday: Mondays only
    const { idx } = ctxOf(db);
    expect(isHabitDue(h, idx, TUE)).toBe(true); // still daily before the change
    expect(isHabitDue(h, idx, FRI)).toBe(false);
    expect(isHabitDue(h, idx, "2026-11-09")).toBe(true); // next Monday
  });

  it("archived habits stop being due but keep their history", () => {
    const db = fresh();
    const h = habit(db, { archived: FRI });
    check(db, h.id, MON, TUE);
    const { idx } = ctxOf(db);
    expect(isHabitDue(h, idx, THU)).toBe(true);
    expect(isHabitDue(h, idx, FRI)).toBe(false);
    expect(idx.checks.get(h.id)?.size).toBe(2);
  });

  it("interval habits repeat every N days from the start", () => {
    const db = fresh();
    const h = habit(db, { kind: "interval", interval: 3, start: MON });
    const { idx } = ctxOf(db);
    expect([MON, TUE, WED, THU, FRI, SAT, SUN].map((d) => isHabitDue(h, idx, d))).toEqual([true, false, false, true, false, false, true]);
  });

  it("weekly targets only count a day as missed when the target would become impossible", () => {
    const db = fresh();
    const h = habit(db, { kind: "weekly_target", target: 3 });
    const { idx } = ctxOf(db);
    expect(isHabitDue(h, idx, MON)).toBe(false); // 7 days left for 3 sessions: a rest day is fine
    expect(isHabitDue(h, idx, FRI)).toBe(true); // 3 left, 3 needed
    expect(canCheck(h, idx, MON)).toBe(true);
  });

  it("weekly targets count days they were done, and stop once the target is met", () => {
    const db = fresh();
    const h = habit(db, { kind: "weekly_target", target: 2 });
    check(db, h.id, MON, TUE);
    const { idx } = ctxOf(db);
    expect(isHabitDue(h, idx, MON)).toBe(true);
    expect(isHabitDue(h, idx, SUN)).toBe(false);
  });
});

describe("describeSchedule", () => {
  it("reads naturally", () => {
    const base = { id: "s", habit_id: "h", effective_from: MON, days: [], target: 0, interval_days: 0 };
    expect(describeSchedule({ ...base, kind: "weekdays", days: [5, 1, 3] })).toBe("Mon · Wed · Fri");
    expect(describeSchedule({ ...base, kind: "weekdays", days: [1, 2, 3, 4, 5] })).toBe("Weekdays");
    expect(describeSchedule({ ...base, kind: "weekly_target", target: 3 })).toBe("3× per week");
    expect(describeSchedule({ ...base, kind: "interval", interval_days: 2 })).toBe("Every 2 days");
  });
});
