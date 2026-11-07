import { daysBetween, zoned, type DateKey } from "./dates";

export const QUOTES = [
  "Consistency over perfection.",
  "Progress over pressure.",
  "Small steps still move you forward.",
  "Take care of yourself first.",
  "Show up, even a little.",
  "Gentle is still progress.",
  "You don't have to do it all today.",
  "Rest is part of the routine.",
];

/** One quote per day, the same all day. */
export const quoteFor = (day: DateKey) => QUOTES[((daysBetween("2026-01-01", day) % QUOTES.length) + QUOTES.length) % QUOTES.length];

export function greeting(now: Date) {
  const h = zoned(now).getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
