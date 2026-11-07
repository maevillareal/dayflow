import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../../data/store";
import type { FocusMode } from "../../data/types";
import type { Category } from "../../lib/categories";
import { safeLocal, saveLocal, uid } from "../../lib/util";
import { useToast } from "../../app/providers";
import { useExtension } from "./extension";

/** The running session lives in localStorage so the timer survives reloads and closing the tab. */
export interface ActiveFocus {
  phase: "focus" | "break";
  mode: Exclude<FocusMode, "scheduled">;
  category: Category;
  task_id: string | null;
  profile_id: string | null;
  planned_min: number;
  break_min: number;
  started_at: number;
  ends_at: number;
  paused_at: number | null;
  paused_ms: number;
}
export type StartOptions = Omit<ActiveFocus, "phase" | "started_at" | "ends_at" | "paused_at" | "paused_ms"> & { domains: string[]; allow: string[] };

type FocusApi = {
  active: ActiveFocus | null;
  remainingMs: number;
  start: (o: StartOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: (status: "ended_early" | "interrupted") => Promise<void>;
  skipBreak: () => void;
};
const FocusCtx = createContext<FocusApi | null>(null);
const KEY = "df.focus.active";

function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, icon: "icons/icon-192.png", tag: "dayflow-focus" });
  } catch {
    /* notifications unavailable */
  }
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const ext = useExtension();
  const toast = useToast();
  const [active, setActiveState] = useState<ActiveFocus | null>(() => safeLocal<ActiveFocus | null>(KEY, null));
  const [now, setNow] = useState(Date.now());
  const activeRef = useRef(active);
  const setActive = useCallback((a: ActiveFocus | null) => {
    activeRef.current = a;
    setActiveState(a);
    saveLocal(KEY, a ?? undefined);
  }, []);

  const record = useCallback(
    (a: ActiveFocus, status: "completed" | "ended_early" | "interrupted", endMs: number) => {
      const actual = status === "completed" ? a.planned_min * 60 : Math.max(0, Math.round((endMs - a.started_at - a.paused_ms - (a.paused_at ? endMs - a.paused_at : 0)) / 1000));
      store.upsert("focus_sessions", [
        {
          id: uid(),
          started_at: new Date(a.started_at).toISOString(),
          ended_at: new Date(endMs).toISOString(),
          planned_min: a.planned_min,
          actual_sec: actual,
          category: a.category,
          task_id: a.task_id,
          mode: a.mode,
          profile_id: a.profile_id,
          status,
        },
      ]);
    },
    [store],
  );

  // Tick once a second while something is running, and handle the end of each phase.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      const a = activeRef.current;
      const n = Date.now();
      setNow(n);
      if (!a || a.paused_at || n < a.ends_at) return;
      if (a.phase === "focus") {
        record(a, "completed", a.ends_at);
        void ext.end();
        notify("Focus session complete", a.break_min ? `Nice work! Enjoy a ${a.break_min}-minute break.` : "Nice work!");
        toast("Focus session complete. Lei is proud of you!");
        setActive(a.break_min ? { ...a, phase: "break", started_at: n, ends_at: n + a.break_min * 60_000, paused_at: null, paused_ms: 0 } : null);
      } else {
        notify("Break's over", "Ready when you are.");
        setActive(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [active, ext, record, setActive, toast]);

  const start = useCallback(
    async (o: StartOptions) => {
      const n = Date.now();
      const { domains, allow, ...rest } = o;
      const a: ActiveFocus = { ...rest, phase: "focus", started_at: n, ends_at: n + o.planned_min * 60_000, paused_at: null, paused_ms: 0 };
      setActive(a);
      setNow(n);
      if (domains.length) await ext.start({ type: "session.start", domains, allow, endsAt: a.ends_at, mode: o.mode });
    },
    [ext, setActive],
  );

  const pause = useCallback(() => {
    const a = activeRef.current;
    if (!a || a.mode === "strict" || a.paused_at) return;
    setActive({ ...a, paused_at: Date.now() });
  }, [setActive]);

  const resume = useCallback(() => {
    const a = activeRef.current;
    if (!a?.paused_at) return;
    const gap = Date.now() - a.paused_at;
    setActive({ ...a, paused_at: null, paused_ms: a.paused_ms + gap, ends_at: a.ends_at + gap });
  }, [setActive]);

  const stop = useCallback(
    async (status: "ended_early" | "interrupted") => {
      const a = activeRef.current;
      if (!a) return;
      if (a.phase === "focus") {
        record(a, status, Date.now());
        await ext.end();
      }
      setActive(null);
    },
    [ext, record, setActive],
  );

  const skipBreak = useCallback(() => setActive(null), [setActive]);

  const remainingMs = active ? Math.max(0, active.ends_at - (active.paused_at ?? now)) : 0;
  return <FocusCtx.Provider value={{ active, remainingMs, start, pause, resume, stop, skipBreak }}>{children}</FocusCtx.Provider>;
}

export function useFocus() {
  const f = useContext(FocusCtx);
  if (!f) throw new Error("useFocus outside FocusProvider");
  return f;
}

export const fmtClock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
