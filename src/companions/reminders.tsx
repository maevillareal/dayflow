import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Clock } from "lucide-react";
import { useNow, useToast, useToday } from "../app/providers";
import { completeReminder, setReminderState } from "../data/actions";
import { useCtx, useSettings, useStore } from "../data/store";
import { buildReminders, CELEBRATIONS, type Reminder } from "../domain/reminders";
import { dayCount } from "../domain/stats";
import type { Category } from "../lib/categories";
import { hash01, safeLocal, saveLocal } from "../lib/util";
import { useFocus } from "../features/focus/focus";
import { Companion, COMPANION_LABEL, COMPANION_NAME, type Mood } from "./Companions";

export function useReminders(categories?: Category[]) {
  const ctx = useCtx();
  const settings = useSettings();
  const now = useNow();
  return useMemo(() => buildReminders(ctx, now, settings).filter((r) => !categories || categories.includes(r.category)), [ctx, now, settings, categories]);
}

export function useReminderActions() {
  const store = useStore();
  const settings = useSettings();
  const today = useToday();
  const toast = useToast();
  return {
    done(r: Reminder) {
      completeReminder(store, r.action, today);
      toast(`${COMPANION_NAME[r.who]}: Done! Logged for today.`);
    },
    later(r: Reminder) {
      setReminderState(store, r.key, { snoozed_until: new Date(Date.now() + settings.notifications.snoozeMinutes * 60_000).toISOString() });
      toast(`Okay! ${COMPANION_NAME[r.who]} will check back in ${settings.notifications.snoozeMinutes} minutes.`);
    },
    dismiss(r: Reminder) {
      setReminderState(store, r.key, { dismissed_on: today });
    },
  };
}

function ReminderButtons({ r }: { r: Reminder }) {
  const act = useReminderActions();
  return (
    <div className="acts">
      <button className="btn sm" onClick={() => act.done(r)}>
        <Check size={14} />
        Done
      </button>
      <button className="btn ghost sm" onClick={() => act.later(r)}>
        <Clock size={14} />
        Later
      </button>
      <button className="btn ghost sm" onClick={() => act.dismiss(r)}>Dismiss</button>
    </div>
  );
}

/** Big companion card for the dashboard. */
export function ReminderCard({ categories }: { categories?: Category[] }) {
  const reminders = useReminders(categories);
  const settings = useSettings();
  const ctx = useCtx();
  const today = useToday();
  const r = reminders[0];
  if (!settings.companions.enabled) return null;
  const allDone = (() => {
    const c = dayCount(ctx, today);
    return c.due > 0 && c.done === c.due;
  })();
  const who = r?.who ?? (settings.companions.who === "cat" ? "cat" : "dog");
  const mood: Mood = r ? (r.who === "dog" ? "encouraging" : "curious") : allDone ? "excited" : "happy";
  return (
    <div className="card rem">
      <h3>
        <span className="t">Reminder</span>
        {r && <span className="tag">{r.category}</span>}
        {!r && reminders.length === 0 && <span className="tag ok">All clear</span>}
      </h3>
      <div className="pet">
        <Companion who={who} mood={mood} size={104} />
      </div>
      <div className="who">{COMPANION_LABEL[who]}</div>
      {r ? (
        <>
          <div className="msg">{r.text}</div>
          <ReminderButtons r={r} />
          {reminders.length > 1 && <div className="more muted">+{reminders.length - 1} more reminder{reminders.length > 2 ? "s" : ""} today</div>}
        </>
      ) : (
        <div className="msg">{allDone && settings.companions.celebrations ? CELEBRATIONS[Math.floor(hash01(today) * CELEBRATIONS.length)] : "Nothing needs you right now. Enjoy the breathing room."}</div>
      )}
    </div>
  );
}

/** Small speech-bubble note for a page, showing that page's first reminder or a friendly tip. */
export function CompanionNote({ categories, tip, who: whoTip }: { categories: Category[]; tip: string; who: "dog" | "cat" }) {
  const settings = useSettings();
  const focus = useFocus();
  const r = useReminders(categories)[0];
  if (!settings.companions.enabled) return null;
  const who = r?.who ?? (settings.companions.who === "both" ? whoTip : settings.companions.who);
  return (
    <div className={`note ${focus.active ? "reduce" : ""}`}>
      <Companion who={who} size={64} mood={r ? "curious" : "happy"} />
      <div className="bubble">
        <div className="who">{COMPANION_LABEL[who]}</div>
        <div>{r ? r.text : tip}</div>
        {r && <ReminderButtons r={r} />}
      </div>
    </div>
  );
}

/**
 * Desktop notifications while DAYFLOW is open (in a tab or its installed window).
 * Respects the on/off switch, quiet hours, a minimum gap between notifications,
 * and stays silent during a focus session. Clicking one opens the right page.
 */
export function ReminderNotifier() {
  const ctx = useCtx();
  const settings = useSettings();
  const now = useNow();
  const focus = useFocus();
  const navigate = useNavigate();
  useEffect(() => {
    const n = settings.notifications;
    if (!n.enabled || focus.active || !("Notification" in window) || Notification.permission !== "granted") return;
    const last = safeLocal<number>("df.notify.last", 0);
    if (Date.now() - last < n.minGapMinutes * 60_000) return;
    const seen = safeLocal<Record<string, number>>("df.notify.keys", {});
    const r = buildReminders(ctx, now, settings, { respectQuiet: true }).find((x) => !seen[x.key] || Date.now() - seen[x.key] > 3 * 3600_000);
    if (!r) return;
    try {
      const note = new Notification(`${COMPANION_NAME[r.who]} says`, { body: r.text, tag: r.key, icon: "icons/icon-192.png" });
      note.onclick = () => {
        window.focus();
        navigate(r.route);
        note.close();
      };
      const fresh = Object.fromEntries(Object.entries(seen).filter(([, t]) => Date.now() - t < 86_400_000));
      saveLocal("df.notify.keys", { ...fresh, [r.key]: Date.now() });
      saveLocal("df.notify.last", Date.now());
    } catch {
      /* some browsers only allow notifications from a service worker; in-app reminders still work */
    }
  }, [ctx, settings, now, focus.active, navigate]);
  return null;
}
