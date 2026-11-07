import type { ReminderState, Routine, Settings } from "../data/types";
import { CAT_COMPANION, type Category } from "../lib/categories";
import { todayKey, zoned, type DateKey } from "../lib/dates";
import { hash01 } from "../lib/util";
import { isDone, isHabitDue } from "./schedule";
import { dueInfo, isDueNow, nextDue } from "./selfcare";
import { isRestNight, routineStatus } from "./skincare";
import type { Ctx } from "./stats";

export type ReminderAction = { kind: "habit"; habitId: string } | { kind: "selfcare"; itemId: string } | { kind: "skincare"; routine: Routine };

export interface Reminder {
  key: string;
  who: "dog" | "cat";
  category: Category;
  text: string;
  action: ReminderAction;
  route: string;
}

const pick = (list: string[], seed: string) => list[Math.floor(hash01(seed) * list.length) % list.length];

const HABIT_TEXT: Record<Category, string[]> = {
  MVG: ["How's your creative project going? Time for “{name}”?", "Ready for a little MVG time? “{name}” is waiting.", "Your future self will thank you for “{name}”."],
  Exercise: ["Time to move a little! “{name}” is on today's list.", "Let's go! “{name}” is still open today.", "Even a few minutes counts. How about “{name}”?"],
  "Eat Healthy": ["Quick check: “{name}”?", "Little things add up. How's “{name}” going today?", "Fuel check! “{name}” is still open."],
  "No Sugar": ["Doing okay with “{name}” today? Whole fruit doesn't count.", "You've got this: “{name}”.", "Sweet tooth calling? Remember “{name}”."],
  "Self Care": ["A little self-care goes a long way: “{name}”.", "Taking care of you: “{name}” is still open."],
  "Skin Care": ["Your skin will thank you: “{name}”."],
};

function habitText(name: string, category: Category, seed: string) {
  const n = name.toLowerCase();
  if (n.includes("water")) return pick(["Have you drunk enough water today?", "Hydration check! A glass of water now?"], seed);
  if (n.includes("fruit") || n.includes("vegetable")) return "Have you eaten your fruits and vegetables?";
  if (n.includes("stretch")) return "Time to stretch a little!";
  return pick(HABIT_TEXT[category], seed).replace("{name}", name);
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Quiet hours may cross midnight (22:00 → 07:00). */
export function inQuietHours(now: Date, start: string, end: string) {
  const z = zoned(now);
  const t = z.getHours() * 60 + z.getMinutes();
  const s = toMin(start);
  const e = toMin(end);
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

export function isSuppressed(state: ReminderState | undefined, now: Date, today: DateKey) {
  if (!state) return false;
  if (state.dismissed_on === today) return true;
  return !!state.snoozed_until && new Date(state.snoozed_until) > now;
}

/**
 * Builds the reminders that apply right now. Never includes anything already done,
 * respects dismissals, snoozes, disabled categories and (when asked) quiet hours.
 */
export function buildReminders(ctx: Ctx, now: Date, settings: Settings, opts: { respectQuiet?: boolean } = {}): Reminder[] {
  if (!settings.companions.enabled) return [];
  const n = settings.notifications;
  if (opts.respectQuiet && inQuietHours(now, n.quietStart, n.quietEnd)) return [];
  const today = todayKey(now);
  const states = new Map(ctx.db.reminder_state.map((s) => [s.key, s]));
  const whoFor = (c: Category) => (settings.companions.who === "both" ? CAT_COMPANION[c] : settings.companions.who);
  const out: Reminder[] = [];
  const add = (r: Omit<Reminder, "who">) => {
    if (!n.categories[r.category]) return;
    if (isSuppressed(states.get(r.key), now, today)) return;
    out.push({ ...r, who: whoFor(r.category) });
  };
  const hour = zoned(now).getHours();

  // Skin care: morning routine before noon, evening routine from 6pm.
  const routine: Routine | null = hour >= 5 && hour < 12 ? "am" : hour >= 18 ? "pm" : null;
  if (routine) {
    const st = routineStatus(ctx.db.skincare_products, ctx.db.skincare_log, today, routine);
    if (st.list.length && !st.complete) {
      const left = st.list.filter((p) => !st.done.has(p.id)).map((p) => p.name);
      const text =
        routine === "am"
          ? pick(["Morning glow time! Your AM routine is waiting.", "Don't forget your skincare routine this morning!"], today + "am")
          : isRestNight(ctx.db.skincare_products, today)
            ? `Your evening routine is waiting! It's a rest night, so just ${left.join(" and ").toLowerCase()}.`
            : `Your evening routine is waiting! Tonight: ${left.join(", ")}.`;
      add({ key: `skin:${routine}:${today}`, category: "Skin Care", text, action: { kind: "skincare", routine }, route: "/skincare" });
    }
  }

  // Self care: items due today or planned earlier.
  for (const item of [...ctx.db.selfcare_items].sort((a, b) => a.sort - b.sort)) {
    if (!item.reminder || !isDueNow(item, ctx.db.selfcare_log, today)) continue;
    const info = dueInfo(nextDue(item, ctx.db.selfcare_log, today), today);
    const when = info.days === 0 ? "due today" : info.days === -1 ? "a day past its planned date" : `${-info.days} days past its planned date`;
    const text = pick(
      [`When was your last ${item.name.toLowerCase()}? It's ${when}.`, `A little self-care goes a long way. ${item.name} is ${when}.`],
      item.id + today,
    );
    add({ key: `selfcare:${item.id}:${today}`, category: "Self Care", text, action: { kind: "selfcare", itemId: item.id }, route: "/selfcare" });
  }

  // Habits scheduled today and not done yet.
  for (const h of [...ctx.db.habits].sort((a, b) => a.sort - b.sort)) {
    if (h.archived_at || !isHabitDue(h, ctx.idx, today) || isDone(ctx.idx, h.id, today)) continue;
    add({
      key: `habit:${h.id}:${today}`,
      category: h.category,
      text: habitText(h.name, h.category, h.id + today),
      action: { kind: "habit", habitId: h.id },
      route: "/habits",
    });
  }
  return out;
}

export const CELEBRATIONS = ["Look at you making progress!", "Everything's done for today. Proud of you!", "All caught up. Time to rest!"];
