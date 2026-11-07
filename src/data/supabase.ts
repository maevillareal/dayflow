import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO, SUPABASE_ANON_KEY, SUPABASE_URL } from "../lib/env";
import type { Repo, TableName, Tables } from "./types";

export const supabase: SupabaseClient | null = DEMO
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const PAGE = 1000;

/** Real storage. Row Level Security in the database limits every query to the signed-in user's rows. */
export function supabaseRepo(client: SupabaseClient): Repo {
  return {
    async list<T extends TableName>(table: T) {
      const out: Tables[T][] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client.from(table).select("*").order("id").range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...((data ?? []) as Tables[T][]));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
    async upsert(table, rows) {
      if (!rows.length) return;
      const clean = rows.map((r) => {
        const { created_at: _c, ...rest } = r as Tables[TableName] & { user_id?: string };
        delete (rest as { user_id?: string }).user_id;
        return rest;
      });
      const { error } = await client.from(table).upsert(clean);
      if (error) throw error;
    },
    async remove(table, ids) {
      if (!ids.length) return;
      const { error } = await client.from(table).delete().in("id", ids);
      if (error) throw error;
    },
  };
}
