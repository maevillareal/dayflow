export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const avg = (a: number[]) => (a.length ? Math.round(sum(a) / a.length) : 0);
export const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);
export const fmtMin = (m: number) => {
  if (m > 0 && m < 1) return "<1m";
  m = Math.round(m);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
};
/** Stable 0..1 hash of a string, for varied-but-repeatable picks (messages, demo data). */
export function hash01(s: string) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return (x >>> 0) / 4294967295;
}
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export function safeLocal<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, v: unknown) {
  try {
    if (v === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: preference just won't persist */
  }
}
/** Normalize "https://www.YouTube.com/watch" → "youtube.com". Returns "" when it isn't a usable domain. */
export function normalizeDomain(input: string) {
  let s = input.trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#]/)[0].split(":")[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : "";
}
