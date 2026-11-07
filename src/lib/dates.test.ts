import { describe, expect, it } from "vitest";
import { isoToKey, todayKey, zoned } from "./dates";
import { greeting } from "./quotes";

describe("Eastern Time", () => {
  it("rolls the day over at midnight in New York, not on the computer's clock", () => {
    // 03:00 UTC on Nov 8 is 10:00 PM EST on Nov 7.
    expect(todayKey(new Date("2026-11-08T03:00:00Z"))).toBe("2026-11-07");
    expect(todayKey(new Date("2026-11-08T05:30:00Z"))).toBe("2026-11-08");
    expect(isoToKey("2026-11-08T03:00:00Z")).toBe("2026-11-07");
  });

  it("handles daylight saving time (EDT in summer)", () => {
    // 03:30 UTC on Jul 1 is 11:30 PM EDT on Jun 30.
    expect(todayKey(new Date("2026-07-01T03:30:00Z"))).toBe("2026-06-30");
    expect(zoned(new Date("2026-07-01T16:00:00Z")).getHours()).toBe(12);
  });

  it("greets by Eastern hour", () => {
    expect(greeting(new Date("2026-11-08T14:00:00Z"))).toBe("Good morning"); // 9 AM EST
    expect(greeting(new Date("2026-11-08T23:00:00Z"))).toBe("Good evening"); // 6 PM EST
  });
});
