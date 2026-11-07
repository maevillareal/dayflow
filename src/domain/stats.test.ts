import { describe, expect, it } from "vitest";
import { categoryMarks, dayCount, habitStreak, series, showUpStreak } from "./stats";
import { check, ctxOf, fresh, habit } from "./testkit";

const MON = "2026-11-02", TUE = "2026-11-03", WED = "2026-11-04", THU = "2026-11-05", FRI = "2026-11-06", SAT = "2026-11-07", SUN = "2026-11-08";

describe("habitStreak", () => {
  it("counts consecutive scheduled days and isn't broken by today being unfinished", () => {
    const db = fresh();
    const h = habit(db, {});
    check(db, h.id, THU, FRI, SAT);
    expect(habitStreak(ctxOf(db), h, SUN)).toBe(3);
    check(db, h.id, SUN);
    expect(habitStreak(ctxOf(db), h, SUN)).toBe(4);
  });

  it("stops at the first missed scheduled day", () => {
    const db = fresh();
    const h = habit(db, {});
    check(db, h.id, MON, TUE, THU, FRI);
    expect(habitStreak(ctxOf(db), h, FRI)).toBe(2);
  });

  it("skips unscheduled days instead of treating them as misses", () => {
    const db = fresh();
    const h = habit(db, { kind: "weekdays", days: [1, 3, 5] });
    check(db, h.id, "2026-10-30", MON, WED, FRI);
    expect(habitStreak(ctxOf(db), h, SUN)).toBe(4);
  });

  it("counts weeks for weekly-target habits", () => {
    const db = fresh();
    const h = habit(db, { kind: "weekly_target", target: 2, start: "2026-10-19" });
    check(db, h.id, "2026-10-20", "2026-10-22", "2026-10-27", "2026-10-29", MON);
    // Current week has 1 of 2 so far: it neither counts nor breaks the run.
    expect(habitStreak(ctxOf(db), h, TUE)).toBe(2);
    check(db, h.id, TUE);
    expect(habitStreak(ctxOf(db), h, TUE)).toBe(3);
  });
});

describe("dayCount and series", () => {
  it("only counts scheduled habits, filtered by category", () => {
    const db = fresh();
    const a = habit(db, { category: "MVG" });
    habit(db, { category: "Exercise", kind: "weekdays", days: [1] });
    check(db, a.id, TUE);
    const ctx = ctxOf(db);
    expect(dayCount(ctx, MON)).toEqual({ due: 2, done: 0 });
    expect(dayCount(ctx, TUE)).toEqual({ due: 1, done: 1 });
    expect(dayCount(ctx, MON, "Exercise")).toEqual({ due: 1, done: 0 });
  });

  it("leaves a gap (null) on days with nothing scheduled", () => {
    const db = fresh();
    const h = habit(db, { kind: "weekdays", days: [1] });
    check(db, h.id, MON);
    expect(series(ctxOf(db), [MON, TUE], "All")).toEqual([100, null]);
  });
});

describe("showUpStreak and categoryMarks", () => {
  it("counts days in a row with at least one check-in", () => {
    const db = fresh();
    const a = habit(db, {});
    const b = habit(db, { category: "Exercise" });
    check(db, a.id, THU, FRI);
    check(db, b.id, SAT);
    expect(showUpStreak(ctxOf(db), SUN)).toBe(3);
    expect(showUpStreak(ctxOf(db), SUN, "Exercise")).toBe(1);
  });

  it("marks categories from habit, self-care and skincare logs", () => {
    const db = fresh();
    const a = habit(db, { category: "No Sugar" });
    check(db, a.id, MON);
    db.selfcare_log.push({ id: "l", item_id: "x", date: MON, notes: "" });
    expect([...categoryMarks(ctxOf(db), MON)].sort()).toEqual(["No Sugar", "Self Care"]);
  });
});
