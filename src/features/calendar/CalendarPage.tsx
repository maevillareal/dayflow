import { useState } from "react";
import { addMonths } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, Droplets, ListChecks, Repeat, Scissors } from "lucide-react";
import { useFilter, useToday } from "../../app/providers";
import { toggleTask } from "../../data/actions";
import { useCtx, useDB, useStore } from "../../data/store";
import { canCheck, isDone } from "../../domain/schedule";
import { lastDone, nextDue } from "../../domain/selfcare";
import { activesOn } from "../../domain/skincare";
import { TASK_COLORS, inFilter } from "../../lib/categories";
import { addDaysKey, daysBetween, fmt, fromKey, monthStartKey, toKey, weekdayOf, WEEK_ORDER, WEEKDAY_SHORT, type DateKey } from "../../lib/dates";
import { cx } from "../../lib/util";
import { CategoryDropdown, CheckRow, Empty, PageHeader } from "../../components/ui";

/** The planner view: what's coming up on each day (tasks, self-care dates, skincare actives, focus schedules). */
export function CalendarPage() {
  const db = useDB();
  const ctx = useCtx();
  const store = useStore();
  const today = useToday();
  const [filter, setFilter] = useFilter();
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState(today);

  const monthStart = toKey(addMonths(fromKey(monthStartKey(today)), offset));
  const first = fromKey(monthStart);
  const lead = (first.getDay() + 6) % 7;
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: dim }, (_, i) => addDaysKey(monthStart, i));

  const tasksOn = (d: DateKey) => db.tasks.filter((t) => t.due_date === d && inFilter(t.category, filter));
  /** Self-care items planned on a day: the next due date, then every `frequency` days after it. */
  const selfcareOn = (d: DateKey) =>
    inFilter("Self Care", filter)
      ? db.selfcare_items.filter((it) => {
          if (d < today) return db.selfcare_log.some((l) => l.item_id === it.id && l.date === d);
          const next = nextDue(it, db.selfcare_log, today);
          const start = next < today ? today : next;
          const diff = daysBetween(start, d);
          return diff === 0 || (diff > 0 && diff % Math.max(1, it.frequency_days) === 0 && !!(lastDone(db.selfcare_log, it.id) || it.next_planned));
        })
      : [];
  const activesFor = (d: DateKey) => (inFilter("Skin Care", filter) ? activesOn(db.skincare_products, weekdayOf(d)) : []);
  const focusOn = (d: DateKey) => db.focus_schedules.filter((s) => s.enabled && s.weekday === weekdayOf(d));

  const selTasks = tasksOn(sel);
  const selHabits = db.habits.filter((h) => !h.archived_at && inFilter(h.category, filter) && canCheck(h, ctx.idx, sel));

  return (
    <>
      <PageHeader title="Calendar" sub="What's planned for each day." right={<CategoryDropdown value={filter} onChange={setFilter} />} />
      <div className="grid cal-row">
        <div className="card">
          <div className="cal-head">
            <div className="mon">
              <button className="icon-btn sm" onClick={() => setOffset((o) => o - 1)} aria-label="Previous month"><ChevronLeft size={15} /></button>
              <b>{fmt(monthStart, "MMMM yyyy")}</b>
              <button className="icon-btn sm" onClick={() => setOffset((o) => o + 1)} aria-label="Next month"><ChevronRight size={15} /></button>
            </div>
            {offset !== 0 && <button className="link" onClick={() => { setOffset(0); setSel(today); }}>Today</button>}
          </div>
          <div className="cal planner">
            {WEEK_ORDER.map((w) => <div className="wd" key={w}>{WEEKDAY_SHORT[w]}</div>)}
            {Array.from({ length: lead }, (_, i) => <div className="day blank" key={`b${i}`} />)}
            {days.map((d) => {
              const tk = tasksOn(d);
              const sc = selfcareOn(d);
              const ac = activesFor(d);
              const fo = focusOn(d);
              return (
                <button key={d} className={cx("day", d === today && "today", d === sel && "sel", d < today && "past")} onClick={() => setSel(d)}>
                  <div className="n">{fmt(d, "d")}</div>
                  <div className="pills">
                    {tk.slice(0, 2).map((t) => <span key={t.id} className={cx("pill", t.status === "done" && "done")} style={{ borderColor: TASK_COLORS[t.category] }}>{t.title}</span>)}
                    {tk.length > 2 && <span className="pill more">+{tk.length - 2} tasks</span>}
                    {sc.length > 0 && <span className="pill sc">{sc.length === 1 ? sc[0].name : `${sc.length} self-care`}</span>}
                    {ac.length > 0 && <span className="pill sk">{ac.map((a) => a.name).join(" + ")}</span>}
                    {fo.length > 0 && <span className="pill fo">Focus {fo[0].start_time}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3><span className="t">{fmt(sel, "EEEE, MMMM d")}</span>{sel === today && <span className="tag pink">Today</span>}</h3>
          <div className="sec-lab"><ListChecks size={13} />TASKS DUE</div>
          {selTasks.length ? selTasks.map((t) => <CheckRow key={t.id} done={t.status === "done"} onToggle={() => toggleTask(store, t)} title={t.title} sub={`${t.category} · ${t.priority}`} dot={TASK_COLORS[t.category]} />) : <Empty>No tasks due.</Empty>}
          <div className="sec-lab"><Repeat size={13} />HABITS</div>
          {selHabits.length ? (
            <p className="small">{selHabits.filter((h) => isDone(ctx.idx, h.id, sel)).length} of {selHabits.length} {sel > today ? "scheduled" : "done"}{sel > today ? "" : ""}: {selHabits.map((h) => h.name).join(", ")}</p>
          ) : (
            <Empty>No habits scheduled.</Empty>
          )}
          {inFilter("Self Care", filter) && (
            <>
              <div className="sec-lab"><Scissors size={13} />SELF CARE</div>
              {selfcareOn(sel).length ? <p className="small">{selfcareOn(sel).map((i) => i.name).join(", ")}{sel < today ? " (done)" : " (planned)"}</p> : <Empty>Nothing planned.</Empty>}
            </>
          )}
          {inFilter("Skin Care", filter) && (
            <>
              <div className="sec-lab"><Droplets size={13} />EVENING SKIN CARE</div>
              <p className="small">{activesFor(sel).map((a) => a.name).join(" + ") || "Rest night"}</p>
            </>
          )}
          <div className="sec-lab"><CalendarClock size={13} />FOCUS SCHEDULE</div>
          {focusOn(sel).length ? (
            focusOn(sel).map((s) => <p key={s.id} className="small">{s.start_time}–{s.end_time} · {db.focus_profiles.find((p) => p.id === s.profile_id)?.name ?? "Profile"}</p>)
          ) : (
            <Empty>No scheduled blocking.</Empty>
          )}
        </div>
      </div>
    </>
  );
}
