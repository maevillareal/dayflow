import { createStore, get, set, clear } from "idb-keyval";
import type { Repo, TableName, Tables } from "./types";

/** Demo-mode storage: each table is one array in this browser's IndexedDB. */
const store = createStore("dayflow-demo", "tables");

export const localRepo: Repo & { reset(): Promise<void> } = {
  async list<T extends TableName>(table: T) {
    return ((await get(table, store)) as Tables[T][] | undefined) ?? [];
  },
  async upsert<T extends TableName>(table: T, rows: Tables[T][]) {
    const cur = ((await get(table, store)) as Tables[T][] | undefined) ?? [];
    const byId = new Map(cur.map((r) => [r.id, r]));
    for (const r of rows) byId.set(r.id, { ...byId.get(r.id), ...r });
    await set(table, [...byId.values()], store);
  },
  async remove(table, ids) {
    const cur = ((await get(table, store)) as { id: string }[] | undefined) ?? [];
    const drop = new Set(ids);
    await set(table, cur.filter((r) => !drop.has(r.id)), store);
  },
  async reset() {
    await clear(store);
  },
};
