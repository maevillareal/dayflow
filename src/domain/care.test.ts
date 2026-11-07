import { describe, expect, it } from "vitest";
import type { SelfCareItem, SkincareProduct } from "../data/types";
import { dueInfo, nextDue } from "./selfcare";
import { activeConflicts, isRestNight, productsFor } from "./skincare";

const product = (p: Partial<SkincareProduct>): SkincareProduct => ({ id: p.name ?? "p", name: "P", type: "", routines: ["pm"], days: [], is_active: false, notes: "", sort: 0, ...p });

describe("skincare", () => {
  const glycolic = product({ name: "Glycolic Acid", is_active: true, days: [3, 6], sort: 3 });
  const tret = product({ name: "Tretinoin", is_active: true, days: [1, 4], sort: 4 });
  const toner = product({ name: "Toner", routines: ["am", "pm"], sort: 0 });

  it("lists each night's products by weekday", () => {
    expect(productsFor([glycolic, tret, toner], "2026-11-02", "pm").map((p) => p.name)).toEqual(["Toner", "Tretinoin"]); // Monday
    expect(productsFor([glycolic, tret, toner], "2026-11-02", "am").map((p) => p.name)).toEqual(["Toner"]);
  });

  it("keeps independent schedules and flags nights where two actives overlap", () => {
    expect(activeConflicts([glycolic, tret, toner])).toEqual([]);
    expect(activeConflicts([glycolic, { ...tret, days: [3] }])).toEqual([3]);
  });

  it("treats a night without actives as a rest night", () => {
    expect(isRestNight([glycolic, tret, toner], "2026-11-08")).toBe(true); // Sunday
    expect(isRestNight([glycolic, tret, toner], "2026-11-04")).toBe(false); // Wednesday
  });
});

describe("self care", () => {
  const item: SelfCareItem = { id: "nail", name: "Nail Cut", frequency_days: 10, next_planned: null, reminder: true, notes: "", sort: 0 };

  it("plans the next date from the last time it was done", () => {
    expect(nextDue(item, [{ id: "1", item_id: "nail", date: "2026-11-01", notes: "" }], "2026-11-08")).toBe("2026-11-11");
    expect(nextDue(item, [], "2026-11-08")).toBe("2026-11-08");
    expect(nextDue({ ...item, next_planned: "2026-11-20" }, [], "2026-11-08")).toBe("2026-11-20");
  });

  it("uses gentle wording instead of 'overdue'", () => {
    expect(dueInfo("2026-11-08", "2026-11-08").label).toBe("Due today");
    expect(dueInfo("2026-11-06", "2026-11-08").label).toBe("Planned 2 days ago");
    expect(dueInfo("2026-11-11", "2026-11-08")).toMatchObject({ label: "Due in 3 days", tone: "soon" });
  });
});
