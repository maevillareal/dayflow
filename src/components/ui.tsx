import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { ALL_ICON, CATEGORIES, CAT_COLORS, CAT_ICONS, type CategoryFilter } from "../lib/categories";
import { WEEK_ORDER, WEEKDAY_SHORT } from "../lib/dates";
import { cx } from "../lib/util";

/* ---------- category dropdown (All Progress + the six categories) ---------- */
export function CategoryDropdown({ value, onChange, pctFor }: { value: CategoryFilter; onChange: (v: CategoryFilter) => void; pctFor?: (c: CategoryFilter) => number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(".dd-item.sel")?.focus({ preventScroll: true }));
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const Icon = value === "All" ? ALL_ICON : CAT_ICONS[value];
  const opts: CategoryFilter[] = ["All", ...CATEGORIES];
  const choose = (v: CategoryFilter) => {
    onChange(v);
    setOpen(false);
    ref.current?.querySelector<HTMLButtonElement>(".dd-btn")?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>(".dd-item") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>(".dd-btn")?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else items[Math.min(items.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[Math.max(0, i - 1)]?.focus();
    }
  };
  const item = (c: CategoryFilter) => {
    const I = c === "All" ? ALL_ICON : CAT_ICONS[c];
    const sel = c === value;
    return (
      <button key={c} role="option" aria-selected={sel} className={cx("dd-item", sel && "sel")} onClick={() => choose(c)}>
        <span className="ii" style={c !== "All" ? { color: CAT_COLORS[c] } : undefined}>
          <I size={15} />
        </span>
        <span className="tx">
          {c === "All" ? "All Progress" : c}
          {c === "All" && <small>Aggregate of all categories</small>}
        </span>
        {pctFor && <span className="pc">{pctFor(c)}%</span>}
        <span className="ck">{sel && <Check size={15} />}</span>
      </button>
    );
  };
  return (
    <div className={cx("dd", open && "open")} ref={ref} onKeyDown={onKey}>
      <button className="dd-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)} title="Category">
        <span className="l">
          <Icon size={16} />
          <span>{value === "All" ? "All" : value}</span>
        </span>
        <ChevronDown size={16} className="chev" />
      </button>
      <div className="dd-menu" role="listbox" id={listId}>
        {item("All")}
        <div className="dd-sep" />
        <div className="dd-cap">CATEGORIES{pctFor ? " · TODAY" : ""}</div>
        {opts.slice(1).map(item)}
      </div>
    </div>
  );
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not(.modal-x)");
    first?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx("modal", wide && "wide")} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn sm modal-x" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, text, confirm, danger, onYes, onNo }: { title: string; text: ReactNode; confirm: string; danger?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <Modal
      title={title}
      onClose={onNo}
      footer={
        <>
          <button className="btn ghost" onClick={onNo}>Cancel</button>
          <button className={cx("btn", danger && "danger")} onClick={onYes}>{confirm}</button>
        </>
      }
    >
      <div className="muted" style={{ lineHeight: 1.55 }}>{text}</div>
    </Modal>
  );
}

/* ---------- small visuals ---------- */
export function Ring({ pct, size = 46, stroke = 5, color = "var(--pink)", label }: { pct: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${pct}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2f4058" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="var(--text)" fontSize={size * 0.24} fontWeight={600} fontFamily="Inter">
        {pct}%
      </text>
    </svg>
  );
}

let sparkN = 0;
export function Spark({ values, w = 90, h = 28, color = "#F4B8CE" }: { values: (number | null)[]; w?: number; h?: number; color?: string }) {
  const [id] = useState(() => `sp${++sparkN}`);
  const vals = values.map((v) => v ?? 0);
  if (vals.length < 2) return <svg width={w} height={h} />;
  const max = Math.max(100, ...vals);
  const P = vals.map((v, i) => [+(i * ((w - 6) / (vals.length - 1)) + 3).toFixed(1), +(h - 3 - (v / max) * (h - 6)).toFixed(1)]);
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1];
    const [x1, y1] = P[i];
    const mx = ((x0 + x1) / 2).toFixed(1);
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  const L = P[P.length - 1];
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${L[0]},${h} L${P[0][0]},${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={L[0]} cy={L[1]} r="2.6" fill={color} />
    </svg>
  );
}

export function Seg<T extends string>({ value, options, onChange, label = (o: T) => o, small }: { value: T; options: readonly T[]; onChange: (v: T) => void; label?: (o: T) => string; small?: boolean }) {
  return (
    <div className={cx("seg", small && "sm")} role="tablist">
      {options.map((o) => (
        <button key={o} role="tab" aria-selected={o === value} className={cx(o === value && "on")} onClick={() => onChange(o)}>
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export function CheckRow({ done, onToggle, title, sub, right, dot }: { done: boolean; onToggle: () => void; title: ReactNode; sub?: ReactNode; right?: ReactNode; dot?: string }) {
  return (
    <div className={cx("check", done && "done")}>
      <button className="box" role="checkbox" aria-checked={done} onClick={onToggle} aria-label={typeof title === "string" ? `Mark ${title}` : "Toggle"}>
        <Check size={13} />
      </button>
      <div className="lbl" onClick={onToggle}>
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </div>
      {right}
      {dot && <span className="cdot" style={{ background: dot }} />}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right && <div className="hdr-actions">{right}</div>}
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="chips">
      {WEEK_ORDER.map((d) => (
        <button type="button" key={d} className={cx("chip", value.includes(d) && "on")} aria-pressed={value.includes(d)} onClick={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])}>
          {WEEKDAY_SHORT[d]}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx("toggle", on && "on")} onClick={() => onChange(!on)} />;
}

export function CategoryTag({ c }: { c: keyof typeof CAT_COLORS }) {
  return (
    <span className="tag">
      <span className="cdot" style={{ background: CAT_COLORS[c] }} />
      {c}
    </span>
  );
}
