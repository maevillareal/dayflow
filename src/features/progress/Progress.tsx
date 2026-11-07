import { useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { CalendarCheck, ChevronLeft, ChevronRight, CircleCheck, Flame, Percent, Sparkles, Timer, Trophy } from "lucide-react";
import { useFilter, useToday } from "../../app/providers";
import { useCtx, useDB } from "../../data/store";
import { categoryDay, categoryMarks, dayCount, pctOf, rangeCount, series, showUpStreak } from "../../domain/stats";
import { CATEGORIES, CAT_COLORS, inFilter } from "../../lib/categories";
import { addDaysKey, fmt, fromKey, isoToKey, lastNDays, monthStartKey, toKey, weekStartKey, WEEK_ORDER, WEEKDAY_SHORT } from "../../lib/dates";
import { cx, fmtMin, sum } from "../../lib/util";
import { areaLine, donut, xPlain, yPct } from "../../charts/charts";
import { CategoryDropdown, Empty, PageHeader, Ring, Seg } from "../../components/ui";
import { addMonths } from "date-fns";

const DIM = "#34465F";

export function Progress() {
  const db = useDB();
  const ctx = useCtx();
  const today = useToday();
  const [filter, setFilter] = useFilter();
  const [monthOffset, setMonthOffset] = useState(0);
  const [sel, setSel] = useState(today);
  const [range, setRange] = useState<"7" | "30" | "90">("30");

  /* ---------- calendar ---------- */
  const monthStart = toKey(addMonths(fromKey(monthStartKey(today)), monthOffset));
  const first = fromKey(monthStart);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const monthDays = Array.from({ length: dim }, (_, i) => addDaysKey(monthStart, i));
  const cells = monthDays.map((d) => {
    if (d > today) return { d, future: true, marks: [] as string[], perfect: false };
    const marks = [...categoryMarks(ctx, d)].filter((c) => inFilter(c, filter));
    const c = dayCount(ctx, d, filter);
    return { d, future: false, marks, perfect: c.due > 0 && c.done === c.due };
  });
  const activeDays = cells.filter((c) => c.marks.length).length;

  const selCats = categoryDay(ctx, sel);
  const selRows = CATEGORIES.filter((c) => inFilter(c, filter) && selCats[c].due > 0);
  const selDone = sum(selRows.map((c) => selCats[c].done));
  const selDue = sum(selRows.map((c) => selCats[c].due));
  const selFocus = sum(db.focus_sessions.filter((s) => isoToKey(s.started_at) === sel && inFilter(s.category, filter)).map((s) => s.actual_sec)) / 60;
  const selSelf = db.selfcare_log.filter((l) => l.date === sel).map((l) => db.selfcare_items.find((i) => i.id === l.item_id)?.name).filter(Boolean);
  const selSkin = new Set(db.skincare_log.filter((l) => l.date === sel).map((l) => l.routine));

  /* ---------- trends ---------- */
  const n = Number(range);
  const days = lastNDays(today, n);
  const prev = lastNDays(addDaysKey(today, -n), n);
  const t = useMemo(() => {
    const s = series(ctx, days, filter);
    const nums = s.filter((x): x is number => x !== null);
    const comp = filter === "All" ? series(ctx, prev, "All") : series(ctx, days, "All");
    const sessions = db.focus_sessions.filter((x) => isoToKey(x.started_at) >= days[0] && inFilter(x.category, filter));
    const weekCount = Math.min(8, Math.ceil(n / 7));
    const weeks = Array.from({ length: weekCount }, (_, i) => weekStartKey(addDaysKey(today, -7 * (weekCount - 1 - i))));
    return {
      avg: pctOf(rangeCount(ctx, days, filter)),
      best: nums.length ? Math.max(...nums) : 0,
      streak: showUpStreak(ctx, today, filter),
      focusMin: sum(sessions.map((x) => x.actual_sec)) / 60,
      completed: sessions.filter((x) => x.status === "completed").length,
      interrupted: sessions.filter((x) => x.status !== "completed").length,
      line: areaLine(
        days.map((d) => fmt(d, "MMM d")),
        { label: filter === "All" ? "All Progress" : filter, data: s, color: filter === "All" ? "#F4B8CE" : CAT_COLORS[filter] },
        { label: filter === "All" ? "Previous period" : "All Progress", data: comp, color: "#8A97AB" },
        n > 30 ? 8 : 7,
      ),
      compare: CATEGORIES.map((c) => pctOf(rangeCount(ctx, days, c))),
      weeks,
      focusByCat: CATEGORIES.map((c) => weeks.map((w) => sum(db.focus_sessions.filter((x) => x.category === c && weekStartKey(isoToKey(x.started_at)) === w).map((x) => x.actual_sec)) / 3600)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, filter, range, today]);

  const compareOpts: ChartOptions<"bar"> = {
    indexAxis: "y",
    maintainAspectRatio: false,
    scales: { x: { ...yPct(), grid: { color: "#2b3a4f", drawTicks: false } }, y: { grid: { display: false }, border: { display: false } } },
    plugins: { tooltip: { callbacks: { label: (c) => ` ${c.parsed.x}% of scheduled habits` } } },
  };
  const stackOpts: ChartOptions<"bar"> = {
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    scales: {
      x: { ...xPlain(), stacked: true },
      y: { stacked: true, ticks: { callback: (v) => `${v}h`, padding: 8 }, grid: { color: "#2b3a4f", drawTicks: false }, border: { display: false, dash: [4, 4] } },
    },
    plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtMin((c.parsed.y ?? 0) * 60)}` } } },
  };
  const sessionDonut = donut(["Completed", "Interrupted or ended early"], [t.completed, t.interrupted], ["#F4B8CE", "#5E7391"], "76%");

  return (
    <>
      <PageHeader title="Progress & Analytics" sub="Every dot is a category you showed up for. Unscheduled days are never counted as missed." right={<CategoryDropdown value={filter} onChange={setFilter} />} />
      <div className="grid cal-row">
        <div className="card">
          <div className="cal-head">
            <div className="mon">
              <button className="icon-btn sm" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month"><ChevronLeft size={15} /></button>
              <b>{fmt(monthStart, "MMMM yyyy")}</b>
              <button className="icon-btn sm" disabled={monthOffset >= 0} onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month"><ChevronRight size={15} /></button>
            </div>
            <span className="muted small">{activeDays} active day{activeDays === 1 ? "" : "s"}{filter === "All" ? "" : ` in ${filter}`}</span>
          </div>
          <div className="cal">
            {WEEK_ORDER.map((w) => <div className="wd" key={w}>{WEEKDAY_SHORT[w]}</div>)}
            {Array.from({ length: lead }, (_, i) => <div className="day blank" key={`b${i}`} />)}
            {cells.map((c) =>
              c.future ? (
                <div className="day future" key={c.d}><div className="n">{fmt(c.d, "d")}</div></div>
              ) : (
                <button key={c.d} className={cx("day", c.d === today && "today", c.d === sel && "sel")} onClick={() => setSel(c.d)} aria-label={`${fmt(c.d, "EEEE MMMM d")}: ${c.marks.length ? c.marks.join(", ") : "nothing logged"}`}>
                  <div className="n">{fmt(c.d, "d")}{c.perfect && <Sparkles size={12} />}</div>
                  <div className="dots">{c.marks.map((m) => <i key={m} style={{ background: CAT_COLORS[m as keyof typeof CAT_COLORS] }} title={m} />)}</div>
                </button>
              ),
            )}
          </div>
          <div className="cal-legend">
            {CATEGORIES.filter((c) => inFilter(c, filter)).map((c) => <span key={c}><i style={{ background: CAT_COLORS[c] }} />{c}</span>)}
            <span><Sparkles size={12} color="var(--pink)" />Every habit done</span>
          </div>
        </div>

        <div className="card">
          <h3>
            <span className="t"><CalendarCheck size={16} />{fmt(sel, "EEEE, MMMM d")}</span>
            {sel === today && <span className="tag pink">Today</span>}
          </h3>
          <div className="day-sum">
            <Ring pct={selDue ? Math.round((selDone / selDue) * 100) : 0} size={64} stroke={6} />
            <div>
              <div className="big-num">{selDone} of {selDue}</div>
              <div className="muted small">scheduled habits done</div>
            </div>
          </div>
          {selRows.map((c) => (
            <div className="drow" key={c}>
              <span className="cdot" style={{ background: CAT_COLORS[c] }} />
              <div className="tx"><b>{c}</b><div className="bar"><i style={{ width: `${(selCats[c].done / selCats[c].due) * 100}%`, background: CAT_COLORS[c] }} /></div></div>
              <span className="val">{selCats[c].done}/{selCats[c].due}</span>
            </div>
          ))}
          {!selRows.length && <Empty>No habits were scheduled this day.</Empty>}
          {inFilter("Self Care", filter) && selSelf.length > 0 && <div className="drow"><span className="cdot" style={{ background: CAT_COLORS["Self Care"] }} /><div className="tx"><b>Self care</b></div><span className="val">{selSelf.join(", ")}</span></div>}
          {inFilter("Skin Care", filter) && selSkin.size > 0 && <div className="drow"><span className="cdot" style={{ background: CAT_COLORS["Skin Care"] }} /><div className="tx"><b>Skin care</b></div><span className="val">{[...selSkin].map((r) => (r === "am" ? "Morning" : "Evening")).join(" & ")}</span></div>}
          <div className="drow"><span className="cdot" style={{ background: "var(--slate)" }} /><div className="tx"><b>Focus time</b></div><span className="val">{fmtMin(selFocus)}</span></div>
        </div>
      </div>

      <div className="section-title">
        <h2>Trends</h2>
        <Seg small value={range} options={["7", "30", "90"] as const} onChange={setRange} label={(o) => `${o} days`} />
      </div>
      <div className="grid stats">
        <div className="card stat"><div className="k"><Percent size={14} />Avg completion</div><div className="v">{t.avg}%</div><div className="bar"><i style={{ width: `${t.avg}%` }} /></div></div>
        <div className="card stat"><div className="k"><Trophy size={14} />Best day</div><div className="v">{t.best}%</div></div>
        <div className="card stat"><div className="k"><Flame size={14} />Showing up</div><div className="v">{t.streak} <small>days in a row</small></div></div>
        <div className="card stat"><div className="k"><Timer size={14} />Focus time</div><div className="v">{fmtMin(t.focusMin)}</div></div>
        <div className="card stat"><div className="k"><CircleCheck size={14} />Sessions</div><div className="v">{t.completed} <small>completed</small></div></div>
      </div>
      <div className="grid perf-row" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>
            <span className="t">Completion trend</span>
            <span className="legend"><span><i style={{ background: filter === "All" ? "var(--pink)" : CAT_COLORS[filter] }} />{filter === "All" ? "All Progress" : filter}</span><span><i style={{ background: "var(--slate)" }} />{filter === "All" ? "Previous period" : "All Progress"}</span></span>
          </h3>
          <div className="chart-box sm"><Line data={t.line.data} options={t.line.options} plugins={t.line.plugins} /></div>
        </div>
        <div className="card">
          <h3><span className="t">Focus sessions</span><span className="muted small">Last {n} days</span></h3>
          {t.completed + t.interrupted ? (
            <>
              <div className="donut-box"><Doughnut data={sessionDonut.data} options={sessionDonut.options} /><div className="center"><div><b>{Math.round((t.completed / (t.completed + t.interrupted)) * 100)}%</b><small>completed</small></div></div></div>
              <div className="lg-list">
                <div><span><i style={{ background: "#F4B8CE" }} />Completed</span><b>{t.completed}</b></div>
                <div><span><i style={{ background: "#5E7391" }} />Interrupted or ended early</span><b>{t.interrupted}</b></div>
              </div>
            </>
          ) : (
            <Empty>No focus sessions in this period yet.</Empty>
          )}
        </div>
      </div>
      <div className="grid halves" style={{ marginTop: 16 }}>
        <div className="card">
          <h3><span className="t">Category comparison</span><span className="muted small">Avg completion</span></h3>
          <div className="chart-box sm">
            <Bar data={{ labels: [...CATEGORIES], datasets: [{ data: t.compare, backgroundColor: CATEGORIES.map((c) => (inFilter(c, filter) ? CAT_COLORS[c] : DIM)), borderRadius: 6, borderSkipped: false, barThickness: 14 }] }} options={compareOpts} />
          </div>
        </div>
        <div className="card">
          <h3>
            <span className="t">Focus hours by category</span>
            <span className="legend">{CATEGORIES.map((c) => <span key={c}><i style={{ background: inFilter(c, filter) ? CAT_COLORS[c] : DIM }} />{c}</span>)}</span>
          </h3>
          <div className="chart-box sm">
            <Bar
              data={{ labels: t.weeks.map((w) => `Wk of ${fmt(w, "MMM d")}`), datasets: CATEGORIES.map((c, i) => ({ label: c, data: t.focusByCat[i], backgroundColor: inFilter(c, filter) ? CAT_COLORS[c] : DIM, borderRadius: 4, borderSkipped: false, maxBarThickness: 40 })) }}
              options={stackOpts}
            />
          </div>
        </div>
      </div>
    </>
  );
}
