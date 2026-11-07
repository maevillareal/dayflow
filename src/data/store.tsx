import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { makeCtx } from "../domain/stats";
import { defaultSettings } from "./seed";
import { emptyDB, TABLES, type DB, type Repo, type Settings, type TableName, type Tables } from "./types";

type Snap = { db: DB; status: "loading" | "ready" | "error"; error: string };

/**
 * All of the user's data lives in memory (it's small) and every change is applied
 * immediately, then saved in order in the background. If a save fails, the user is told
 * and the data is reloaded from storage so the screen never shows something unsaved as saved.
 */
export class Store {
  private snap: Snap = { db: emptyDB(), status: "loading", error: "" };
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    public repo: Repo,
    private onError: (msg: string) => void,
  ) {}

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;
  get db() {
    return this.snap.db;
  }
  private set(next: Partial<Snap>) {
    this.snap = { ...this.snap, ...next };
    this.listeners.forEach((l) => l());
  }

  async load(seed?: (db: DB) => Partial<DB> | null) {
    try {
      const lists = await Promise.all(TABLES.map(async (t) => [t, await this.repo.list(t)] as const));
      let db = Object.fromEntries(lists) as unknown as DB;
      const extra = seed?.(db);
      if (extra) {
        for (const t of TABLES) {
          const rows = extra[t] as Tables[typeof t][] | undefined;
          if (rows?.length) await this.repo.upsert(t, rows);
        }
        db = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await this.repo.list(t)] as const))) as unknown as DB;
      }
      this.set({ db, status: "ready", error: "" });
    } catch (e) {
      this.set({ status: "error", error: messageOf(e) });
    }
  }

  private persist(op: () => Promise<void>) {
    this.queue = this.queue.then(op).catch((e) => {
      this.onError(`Couldn't save that change: ${messageOf(e)}. Reloading your data.`);
      void this.load();
    });
  }

  upsert<T extends TableName>(table: T, rows: Tables[T][]) {
    if (!rows.length) return;
    const byId = new Map((this.db[table] as Tables[T][]).map((r) => [r.id, r]));
    for (const r of rows) byId.set(r.id, { ...byId.get(r.id), ...r });
    this.set({ db: { ...this.db, [table]: [...byId.values()] } });
    this.persist(() => this.repo.upsert(table, rows));
  }

  remove(table: TableName, ids: string[]) {
    if (!ids.length) return;
    const drop = new Set(ids);
    this.set({ db: { ...this.db, [table]: (this.db[table] as { id: string }[]).filter((r) => !drop.has(r.id)) } });
    this.persist(() => this.repo.remove(table, ids));
  }
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));

const StoreCtx = createContext<Store | null>(null);
export const StoreProvider = ({ store, children }: { store: Store; children: ReactNode }) => <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;

export function useStore() {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
export function useSnap() {
  const s = useStore();
  return useSyncExternalStore(s.subscribe, s.getSnapshot);
}
export const useDB = () => useSnap().db;
export function useCtx() {
  const db = useDB();
  return useMemo(() => makeCtx(db), [db]);
}
export function useSettings(): Settings {
  const db = useDB();
  const s = db.profiles[0]?.settings;
  return useMemo(() => {
    const d = defaultSettings();
    if (!s) return d;
    return {
      ...d,
      ...s,
      companions: { ...d.companions, ...s.companions },
      notifications: { ...d.notifications, ...s.notifications, categories: { ...d.notifications.categories, ...s.notifications?.categories } },
    };
  }, [s]);
}
