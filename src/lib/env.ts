const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_URL = url ?? "";
export const SUPABASE_ANON_KEY = anon ?? "";
/** Demo mode: no login, data stays in this browser. Used when asked for, or when Supabase isn't configured yet. */
export const DEMO = import.meta.env.VITE_DEMO === "1" || !url || !anon;
/** Fixed by the public key in extension/manifest.json, so it's the same on every machine. */
export const DEFAULT_EXTENSION_ID = (import.meta.env.VITE_EXTENSION_ID as string | undefined) || "llihamdjohpaehpmknhehbcnmllhfgdp";
