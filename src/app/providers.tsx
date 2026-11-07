import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CategoryFilter } from "../lib/categories";
import { isCategory } from "../lib/categories";
import { todayKey } from "../lib/dates";
import { safeLocal, saveLocal } from "../lib/util";

/* ---------- toasts ---------- */
type Toast = { id: number; text: string };
const ToastCtx = createContext<(text: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const show = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-2), { id, text }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- clock: re-renders every 30s so "today" rolls over at midnight ---------- */
const ClockCtx = createContext<Date>(new Date());
export function ClockProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    const vis = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return <ClockCtx.Provider value={now}>{children}</ClockCtx.Provider>;
}
export const useNow = () => useContext(ClockCtx);
export const useToday = () => todayKey(useNow());

/* ---------- global category filter (All Progress or one category) ---------- */
const FilterCtx = createContext<[CategoryFilter, (f: CategoryFilter) => void]>(["All", () => {}]);
export function FilterProvider({ children }: { children: ReactNode }) {
  const [f, setF] = useState<CategoryFilter>(() => {
    const v = safeLocal<string>("df.filter", "All");
    return v === "All" || isCategory(v) ? v : "All";
  });
  const set = useCallback((v: CategoryFilter) => {
    setF(v);
    saveLocal("df.filter", v);
  }, []);
  return <FilterCtx.Provider value={[f, set]}>{children}</FilterCtx.Provider>;
}
export const useFilter = () => useContext(FilterCtx);
