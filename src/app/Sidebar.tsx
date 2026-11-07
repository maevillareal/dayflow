import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Apple,
  CalendarDays,
  ChartLine,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  Scissors,
  Settings,
  Shapes,
  Timer,
  Droplets,
} from "lucide-react";
import { fmt } from "../lib/dates";
import { cx, safeLocal, saveLocal } from "../lib/util";
import { useExtension } from "../features/focus/extension";
import { useFocus, fmtClock } from "../features/focus/focus";
import { useToday } from "./providers";
import type { Account } from "../features/auth/AuthGate";

const link = (to: string, Icon: typeof Timer, label: string) => (
  <NavLink to={to} end={to === "/"} title={label} className={({ isActive }) => cx(isActive && "active")}>
    <Icon size={18} />
    <span className="label">{label}</span>
  </NavLink>
);

export function Sidebar({ account }: { account: Account }) {
  const today = useToday();
  const ext = useExtension();
  const focus = useFocus();
  const [collapsed, setCollapsed] = useState(() => safeLocal("df.sidebar.collapsed", false));
  const [catOpen, setCatOpen] = useState(() => safeLocal("df.sidebar.categories", true));
  const toggle = () => {
    setCollapsed((c) => {
      saveLocal("df.sidebar.collapsed", !c);
      return !c;
    });
  };
  return (
    <aside className={cx("sidebar", collapsed && "collapsed")}>
      <div className="datecard" title={fmt(today, "EEEE, MMMM d, yyyy")}>
        <div className="tile">
          <span>{fmt(today, "MMM").toUpperCase()}</span>
          <b>{fmt(today, "d")}</b>
        </div>
        <div className="logo-text">
          <b>{fmt(today, "EEEE")}</b>
          <small>{fmt(today, "MMMM d, yyyy")}</small>
        </div>
      </div>
      <nav className="nav" aria-label="Main">
        {link("/", LayoutDashboard, "Dashboard")}
        {link("/habits", Repeat, "Habit Tracker")}
        <button
          className="grp"
          aria-expanded={catOpen}
          title="Categories"
          onClick={() =>
            setCatOpen((o) => {
              saveLocal("df.sidebar.categories", !o);
              return !o;
            })
          }
        >
          <Shapes size={18} />
          <span className="label">Categories</span>
          {catOpen ? <ChevronDown size={15} className="label grp-chev" /> : <ChevronRight size={15} className="label grp-chev" />}
        </button>
        {catOpen && (
          <div className="sub">
            {link("/selfcare", Scissors, "Self Care")}
            {link("/skincare", Droplets, "Skin Care")}
            {link("/eat", Apple, "Eat Healthy")}
            {link("/focus", Timer, "Focus Mode")}
          </div>
        )}
        {link("/todo", ListChecks, "To-do List")}
        {link("/calendar", CalendarDays, "Calendar")}
        {link("/progress", ChartLine, "Progress & Analytics")}
        {link("/settings", Settings, "Settings")}
      </nav>
      <div className="side-foot">
        {focus.active && (
          <NavLink to="/focus" className="focus-pill" title="Focus session running">
            <Timer size={15} />
            <span className="label">
              {focus.active.phase === "focus" ? "Focus" : "Break"} · {fmtClock(focus.remainingMs)}
            </span>
          </NavLink>
        )}
        <div className="ext-status" title={ext.status.connected ? "Chrome extension connected" : "Chrome extension not connected"}>
          <span className={cx("dot", ext.status.connected && "on")} />
          <span className="label">{ext.status.connected ? (ext.status.active ? "Blocking on" : "Extension connected") : "Extension not connected"}</span>
        </div>
        {account.demo ? (
          <div className="ext-status" title="Demo mode: data stays in this browser">
            <span className="dot demo" />
            <span className="label">Demo mode</span>
          </div>
        ) : (
          <button onClick={() => void account.signOut()} title="Log out">
            <LogOut size={18} />
            <span className="label">Log out</span>
          </button>
        )}
        <button onClick={toggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span className="label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
