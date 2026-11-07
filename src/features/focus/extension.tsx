import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useDB, useSettings } from "../../data/store";
import { DEFAULT_EXTENSION_ID } from "../../lib/env";
import { APP_TIME_ZONE } from "../../lib/dates";

/**
 * Talks to the DAYFLOW Chrome extension directly from this page (chrome.runtime.sendMessage with the
 * extension's ID). The extension only accepts messages from the origins listed in its manifest's
 * externally_connectable, and validates every message. The app never claims blocking is on
 * unless the extension's reply says so.
 */
export type ExtStatus = { connected: boolean; active: boolean; until: number | null; ruleCount: number; scheduledNow: boolean; version?: string };
const OFF: ExtStatus = { connected: false, active: false, until: null, ruleCount: 0, scheduledNow: false };

type Msg =
  | { type: "ping" }
  | { type: "session.start"; domains: string[]; allow: string[]; endsAt: number; mode: string }
  | { type: "session.end" }
  | { type: "schedules.set"; timeZone: string; schedules: { weekday: number; start: string; end: string; domains: string[]; allow: string[] }[] };

type ChromeRuntime = { sendMessage: (id: string, msg: unknown, cb: (resp: unknown) => void) => void; lastError?: unknown };
const runtime = () => (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;

export function send(extId: string, msg: Msg): Promise<Record<string, unknown> | null> {
  const rt = runtime();
  if (!extId || !rt?.sendMessage) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 1500);
    try {
      rt.sendMessage(extId, msg, (resp) => {
        clearTimeout(timer);
        // Reading lastError marks it handled; a missing/disabled extension lands here.
        if (rt.lastError || !resp || typeof resp !== "object") resolve(null);
        else resolve(resp as Record<string, unknown>);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

const toStatus = (r: Record<string, unknown> | null): ExtStatus =>
  r?.ok
    ? { connected: true, active: !!r.active, until: typeof r.until === "number" ? r.until : null, ruleCount: Number(r.ruleCount) || 0, scheduledNow: !!r.scheduledNow, version: String(r.version ?? "") }
    : OFF;

type Ext = { id: string; status: ExtStatus; refresh: () => Promise<ExtStatus>; start: (m: Extract<Msg, { type: "session.start" }>) => Promise<ExtStatus>; end: () => Promise<ExtStatus> };
const ExtCtx = createContext<Ext>({ id: "", status: OFF, refresh: async () => OFF, start: async () => OFF, end: async () => OFF });

export function ExtensionProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const db = useDB();
  const id = settings.extensionId || DEFAULT_EXTENSION_ID;
  const [status, setStatus] = useState<ExtStatus>(OFF);
  const idRef = useRef(id);
  idRef.current = id;

  const refresh = useCallback(async () => {
    const s = toStatus(await send(idRef.current, { type: "ping" }));
    setStatus(s);
    return s;
  }, []);
  const start = useCallback(async (m: Extract<Msg, { type: "session.start" }>) => {
    const r = await send(idRef.current, m);
    const s = r?.ok ? await refresh() : OFF;
    return s;
  }, [refresh]);
  const end = useCallback(async () => {
    await send(idRef.current, { type: "session.end" });
    return refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(t);
  }, [id, refresh]);

  // Keep the extension's copy of Scheduled Mode in sync whenever it's connected or the schedules change.
  const schedKey = JSON.stringify([db.focus_schedules, db.focus_profiles]);
  useEffect(() => {
    if (!status.connected) return;
    const profiles = new Map(db.focus_profiles.map((p) => [p.id, p]));
    const schedules = db.focus_schedules
      .filter((s) => s.enabled && profiles.has(s.profile_id))
      .map((s) => ({ weekday: s.weekday, start: s.start_time, end: s.end_time, domains: profiles.get(s.profile_id)!.domains, allow: profiles.get(s.profile_id)!.allow }));
    void send(idRef.current, { type: "schedules.set", timeZone: APP_TIME_ZONE, schedules });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.connected, schedKey]);

  return <ExtCtx.Provider value={{ id, status, refresh, start, end }}>{children}</ExtCtx.Provider>;
}
export const useExtension = () => useContext(ExtCtx);
