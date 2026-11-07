import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { ArrowDown, ArrowUp, Bell, CircleCheck, Flame, ListChecks, MessageCircleHeart, Moon, Plus, Repeat, Sun, Timer, TriangleAlert } from "lucide-react";
import { useFilter, useNow, useToast, useToday } from "../../app/providers";
import { logSelfcare, toggleCheckin, toggleSkincare, toggleTask, unlogSelfcare } from "../../data/actions";
import { useCtx, useDB, useStore } from "../../data/store";
import type { Task } from "../../data/types";
import { canCheck, isDone } from "../../domain/schedule";
import { doneOn, dueInfo, frequencyLabel, nextDue } from "../../domain/selfcare";
import { activeConflicts, isRestNight, routineStatus } from "../../domain/skincare";
import { activeHabits, dayCount, makeCtx, pctOf, series, showUpStreak } from "../../domain/stats";
import { CATEGORIES, CAT_COLORS, inFilter } from "../../lib/categories";
import { addDaysKey, fmt, isoToKey, lastNDays, relativeDue, weekKeys, weekdayOf } from "../../lib/dates";
import { greeting, quoteFor } from "../../lib/quotes";
import { cx, fmtMin, sum } from "../../lib/util";
import { areaLine, multiLine } from "../../charts/charts";
import { CategoryDropdown, CheckRow, Empty, Seg, Spark } from "../../components/ui";
import { ReminderCard } from "../../companions/reminders";
import { TaskModal } from "../todo/TaskModal";

type Tab = "To-do" | "Self Care" | "Skin Care" | "Eat Healthy";
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

export function Dashboard() {
  const db = useDB();
  const ctx = useCtx();
  const store = useStore();
  const today = useToday();
  const now = useNow();
  const toast = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useFilter();
  const [tab, setTab] = useState<Tab>("To-do");
  const [range, setRange] = useState<"Week" | "Month">("Week");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const name = db.profiles[0]?.display_name;
  const habitsToday = activeHabits(db).filter((h) => inFilter(h.category, filter) && canCheck(h, ctx.idx, today));
  const todayCount = dayCount(ctx, today, filter);

  function checkHabit(id: string) {
    const nowDone = toggleCheckin(store, id, today);
    if (!nowDone) return;
    const c = dayCount(makeCtx(store.db), today);
    if (c.due > 0 && c.done === c.due) toast("Lei: Everything's done for today. Look at you making progress!");
  }

  /* ---------- Today card ---------- */
  const tasks = db.tasks
    .filter((t) => inFilter(t.category, filter) && (t.status === "open" ? !t.due_date || t.due_date <= addDaysKey(today, 1) : !!t.completed_at && isoToKey(t.completed_at) === today))
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || (a.due_date ?? "9").localeCompare(b.due_date ?? "9") || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const selfcare = [...db.selfcare_items].sort((a, b) => nextDue(a, db.selfcare_log, today).localeCompare(nextDue(b, db.selfcare_log, today)));
  const am = routineStatus(db.skincare_products, db.skincare_log, today, "am");
  const pm = routineStatus(db.skincare_products, db.skincare_log, today, "pm");
  const eat = activeHabits(db).filter((h) => h.category === "Eat Healthy" && canCheck(h, ctx.idx, today));
  const counts: Record<Tab, number> = {
    "To-do": tasks.filter((t) => t.status === "open").length,
    "Self Care": selfcare.filter((i) => !doneOn(db.selfcare_log, i.id, today) && dueInfo(nextDue(i, db.selfcare_log, today), today).days <= 0).length,
    "Skin Care": am.list.length - am.done.size + pm.list.length - pm.done.size,
    "Eat Healthy": eat.filter((h) => !isDone(ctx.idx, h.id, today)).length,
  };
  const tonightConflict = activeConflicts(db.skincare_products).includes(weekdayOf(today));

  let body: ReactNode;
  if (tab === "To-do") {
    body = tasks.length ? (
      tasks.map((t: Task) => (
        <CheckRow
          key={t.id}
          done={t.status === "done"}
          onToggle={() => toggleTask(store, t)}
          title={t.title}
          sub={`${t.due_date ? relativeDue(today, t.due_date) : "No due date"} · ${t.category}`}
          right={<span className={cx("tag", t.priority === "High" && "high")}>{t.priority}</span>}
        />
      ))
    ) : (
      <Empty>Nothing left to do{filter === "All" ? "" : ` in ${filter}`}. Enjoy the breathing room.</Empty>
    );
  } else if (tab === "Self Care") {
    body = selfcare.length ? (
      selfcare.map((i) => {
        const done = doneOn(db.selfcare_log, i.id, today);
        const info = dueInfo(nextDue(i, db.selfcare_log, today), today);
        return (
          <CheckRow
            key={i.id}
            done={done}
            onToggle={() => (done ? unlogSelfcare(store, i.id, today) : logSelfcare(store, i.id, today))}
            title={i.name}
            sub={`${done ? "Done today" : info.label} · ${frequencyLabel(i.frequency_days)}`}
            right={!done && info.days <= 0 ? <span className="tag pink">{info.days === 0 ? "Today" : "Ready"}</span> : undefined}
          />
        );
      })
    ) : (
      <Empty>No self-care items yet. Add some on the Self Care page.</Empty>
    );
  } else if (tab === "Skin Care") {
    const rows = (st: typeof am, routine: "am" | "pm") =>
      st.list.map((p) => <CheckRow key={routine + p.id} done={st.done.has(p.id)} onToggle={() => toggleSkincare(store, p.id, today, routine)} title={p.name} sub={p.type} />);
    body = (
      <>
        <div className="sec-lab"><Sun size={13} />MORNING</div>
        {am.list.length ? rows(am, "am") : <Empty>No morning products today.</Empty>}
        <div className="sec-lab" style={{ marginTop: 12 }}>
          <Moon size={13} />EVENING {isRestNight(db.skincare_products, today) && <span className="tag pink">Rest night</span>}
        </div>
        {tonightConflict && <div className="warn sm"><TriangleAlert size={14} />Two strong actives are scheduled tonight. Check your schedule on the Skin Care page.</div>}
        {pm.list.length ? rows(pm, "pm") : <Empty>No evening products today.</Empty>}
      </>
    );
  } else {
    body = eat.length ? (
      eat.map((h) => <CheckRow key={h.id} done={isDone(ctx.idx, h.id, today)} onToggle={() => checkHabit(h.id)} title={h.name} />)
    ) : (
      <Empty>No Eat Healthy items scheduled today.</Empty>
    );
  }

  /* ---------- chart ---------- */
  const days = range === "Week" ? weekKeys(today) : lastNDays(today, 30);
  const labels = days.map((d) => (range === "Week" ? fmt(d, "EEE") : fmt(d, "MMM d")));
  const chart = useMemo(() => {
    const visible = days.filter((d) => d <= today);
    const pad = (a: (number | null)[]) => [...a, ...Array(days.length - a.length).fill(null)];
    if (filter === "All")
      return { kind: "multi" as const, ...multiLine(labels, CATEGORIES.map((c) => ({ label: c, data: pad(series(ctx, visible, c)), color: CAT_COLORS[c], hidden: hidden.has(c) })), range === "Week" ? 7 : 6) };
    return { kind: "area" as const, ...areaLine(labels.slice(0, visible.length), { label: filter, data: series(ctx, visible, filter), color: CAT_COLORS[filter] }, undefined, range === "Week" ? 7 : 6) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, filter, range, today, hidden]);

  /* ---------- KPIs ---------- */
  const habitPct = pctOf(todayCount);
  const streak = showUpStreak(ctx, today, filter);
  const wk = weekKeys(today);
  const weekTasks = db.tasks.filter((t) => inFilter(t.category, filter) && ((t.due_date && t.due_date >= wk[0] && t.due_date <= wk[6]) || (!t.due_date && t.completed_at && isoToKey(t.completed_at) >= wk[0])));
  const weekDone = weekTasks.filter((t) => t.status === "done").length;
  const sessions = db.focus_sessions.filter((s) => inFilter(s.category, filter));
  const minOn = (d: string) => sum(sessions.filter((s) => isoToKey(s.started_at) === d).map((s) => s.actual_sec)) / 60;
  const focusDays = lastNDays(today, 7).map(minOn);
  const thisWeek = sum(wk.filter((d) => d <= today).map(minOn));
  const lastWeekSameSpan = sum(wk.filter((d) => d <= today).map((d) => minOn(addDaysKey(d, -7))));
  const change = lastWeekSameSpan ? Math.round(((thisWeek - lastWeekSameSpan) / lastWeekSameSpan) * 100) : null;
  const todaySessions = sessions.filter((s) => isoToKey(s.started_at) === today);

  return (
    <>
      <div className="topbar hero">
        <div className="hero-head">
          <div className="greet">{greeting(now)}{name ? `, ${name}` : ""}</div>
          <div className="motto"><q>{quoteFor(today)}</q></div>
        </div>
        <div className="hdr-actions">
          <button className="icon-btn" title="Notifications and reminders" onClick={() => navigate("/settings#notifications")}><Bell size={17} /></button>
          <button className="icon-btn" title="Companion settings" onClick={() => navigate("/settings#companions")}><MessageCircleHeart size={17} /></button>
          <Link className="btn" to="/focus"><Timer size={16} />Focus mode</Link>
          <CategoryDropdown value={filter} onChange={setFilter} pctFor={(c) => pctOf(dayCount(ctx, today, c))} />
        </div>
      </div>

      <div className="grid" style={{ gap: 16 }}>
        <div className="grid dash-top">
          <div className="card tabcard">
            <h3 style={{ marginBottom: 12 }}>
              <span className="t"><ListChecks size={16} />Today</span>
              <button className="btn sm" onClick={() => setAdding(true)}><Plus size={14} />Add task</button>
            </h3>
            <div className="tabs" role="tablist">
              {(Object.keys(counts) as Tab[]).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} className={cx(tab === t && "on")} onClick={() => setTab(t)}>
                  {t}<span className="cnt">{Math.max(0, counts[t])}</span>
                </button>
              ))}
            </div>
            <div className="scroll" style={{ maxHeight: 330 }}>{body}</div>
          </div>

          <ReminderCard categories={filter === "All" ? undefined : [filter]} />

          <div className="card">
            <h3>
              <span className="t"><Repeat size={16} />Habits</span>
              <span className="muted small">{todayCount.done}/{todayCount.due} today</span>
            </h3>
            <div className="scroll" style={{ marginTop: 6 }}>
              {habitsToday.length ? (
                habitsToday.map((h) => <CheckRow key={h.id} done={isDone(ctx.idx, h.id, today)} onToggle={() => checkHabit(h.id)} title={h.name} dot={CAT_COLORS[h.category]} />)
              ) : (
                <Empty>No habits scheduled today{filter === "All" ? "" : ` in ${filter}`}. <Link className="link" to="/habits">Add one</Link></Empty>
              )}
            </div>
          </div>
        </div>

        <div className="grid dash-bottom">
          <div className="card">
            <h3>
              <span className="t">Habit performance</span>
              <Seg small value={range} options={["Week", "Month"] as const} onChange={setRange} label={(o) => (o === "Week" ? "Weekly" : "Monthly")} />
            </h3>
            <div className="legend" style={{ marginTop: 12 }}>
              {filter === "All" ? (
                CATEGORIES.map((c) => (
                  <button
                    key={c}
                    className={cx("lgchip", hidden.has(c) && "off")}
                    aria-pressed={!hidden.has(c)}
                    onClick={() => setHidden((s) => { const x = new Set(s); if (x.has(c)) x.delete(c); else x.add(c); return x; })}
                  >
                    <i style={{ background: CAT_COLORS[c] }} />{c}
                  </button>
                ))
              ) : (
                <span><i style={{ background: CAT_COLORS[filter] }} />{filter}</span>
              )}
            </div>
            <div className="chart-box">
              {chart.kind === "multi" ? <Line data={chart.data} options={chart.options} /> : <Line data={chart.data} options={chart.options} plugins={chart.plugins} />}
            </div>
          </div>

          <div className="kstack">
            <div className="card kpi hl">
              <div className="kpi-top">
                <span className="lab"><CircleCheck size={14} />Habit completion</span>
                <span className="tag pink"><Flame size={12} />{streak}-day streak</span>
              </div>
              <div className="big">{habitPct}%</div>
              <div className="note">{todayCount.done} of {todayCount.due} habits done today</div>
              <div className="bar"><i style={{ width: `${habitPct}%` }} /></div>
            </div>
            <div className="card kpi">
              <div className="kpi-top">
                <span className="lab"><ListChecks size={14} />Tasks completed</span>
                <span className="muted small">This week</span>
              </div>
              <div className="big">{weekDone}<small>/ {weekTasks.length}</small></div>
              <div className="segbar"><i style={{ flex: weekDone || 0.001 }} /><i className="rest" style={{ flex: weekTasks.length - weekDone || 0.001 }} /></div>
            </div>
            <div className="card kpi dash">
              <div className="kpi-top">
                <span className="lab"><Timer size={14} />Focus time</span>
                {change !== null && (
                  <span className={cx("chip-up", change < 0 && "down")}>{change >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(change)}%</span>
                )}
              </div>
              <div className="kpi-row">
                <div>
                  <div className="big">{fmtMin(focusDays[6])}</div>
                  <div className="note">Today · {todaySessions.length} session{todaySessions.length === 1 ? "" : "s"}</div>
                </div>
                <Spark values={focusDays.map((m) => Math.min(100, (m / Math.max(1, ...focusDays)) * 100))} w={90} h={32} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {adding && <TaskModal defaultCategory={filter === "All" ? undefined : filter} onClose={() => setAdding(false)} />}
    </>
  );
}
