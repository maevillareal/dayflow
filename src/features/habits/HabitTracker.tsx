import { useState } from "react";
import { Archive, ArchiveRestore, Check, ChevronLeft, ChevronRight, Flame, Pencil, Percent, Plus, Target, Trash2 } from "lucide-react";
import { useFilter, useToday } from "../../app/providers";
import { archiveHabit, deleteHabit, restoreHabit, toggleCheckin } from "../../data/actions";
import { useCtx, useDB, useStore } from "../../data/store";
import type { Habit } from "../../data/types";
import { canCheck, describeSchedule, doneInWeek, isDone, isHabitDue, scheduleOn } from "../../domain/schedule";
import { dayCount, habitStreak, pctOf, rangeCount } from "../../domain/stats";
import { CATEGORIES, CAT_COLORS, CAT_ICONS, inFilter } from "../../lib/categories";
import { addDaysKey, fmt, weekKeys, weekStartKey } from "../../lib/dates";
import { cx } from "../../lib/util";
import { CategoryDropdown, Confirm, Empty, PageHeader, Spark, Toggle } from "../../components/ui";
import { CompanionNote } from "../../companions/reminders";
import { HabitModal } from "./HabitModal";

export function HabitTracker() {
  const db = useDB();
  const ctx = useCtx();
  const store = useStore();
  const today = useToday();
  const [filter, setFilter] = useFilter();
  const [anchor, setAnchor] = useState(today);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);

  const days = weekKeys(anchor);
  const isThisWeek = weekStartKey(anchor) === weekStartKey(today);
  const pastDays = days.filter((d) => d <= today);
  const habits = db.habits.filter((h) => inFilter(h.category, filter) && (showArchived ? !!h.archived_at : !h.archived_at)).sort((a, b) => a.sort - b.sort);
  const active = db.habits.filter((h) => !h.archived_at && inFilter(h.category, filter));
  const weekPct = pctOf(rangeCount(ctx, pastDays, filter));
  const streaks = active.map((h) => habitStreak(ctx, h, today));
  const weekly = active.filter((h) => scheduleOn(ctx.idx, h.id, today)?.kind === "weekly_target");
  const weeklyMet = weekly.filter((h) => doneInWeek(ctx.idx, h.id, today) >= (scheduleOn(ctx.idx, h.id, today)?.target ?? 1)).length;
  const archivedCount = db.habits.filter((h) => h.archived_at && inFilter(h.category, filter)).length;

  const trend = (h: Habit) =>
    Array.from({ length: 8 }, (_, i) => {
      const wk = weekKeys(addDaysKey(today, -7 * (7 - i))).filter((d) => d <= today);
      let due = 0;
      let done = 0;
      for (const d of wk) if (isHabitDue(h, ctx.idx, d)) { due++; if (isDone(ctx.idx, h.id, d)) done++; }
      return due ? Math.round((done / due) * 100) : null;
    });

  const groups = CATEGORIES.filter((c) => inFilter(c, filter)).map((c) => ({ c, rows: habits.filter((h) => h.category === c) })).filter((g) => g.rows.length);

  return (
    <>
      <PageHeader
        title="Habit Tracker"
        sub={<>Week of {fmt(days[0], "MMM d")} – {fmt(days[6], "MMM d")} · dashed days aren't scheduled and never count as missed</>}
        right={
          <>
            <CategoryDropdown value={filter} onChange={setFilter} />
            <button className="btn" onClick={() => setEditing("new")}><Plus size={16} />New habit</button>
          </>
        }
      />
      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat"><div className="k"><Percent size={14} />{isThisWeek ? "This week" : "That week"}</div><div className="v">{weekPct}%</div><div className="bar"><i style={{ width: `${weekPct}%` }} /></div></div>
        <div className="card stat"><div className="k"><Flame size={14} />Best current streak</div><div className="v">{Math.max(0, ...streaks)} <small>days</small></div></div>
        <div className="card stat"><div className="k"><Target size={14} />Weekly targets met</div><div className="v">{weeklyMet}<small> / {weekly.length}</small></div></div>
        <div className="card stat"><div className="k"><Archive size={14} />Archived</div><div className="v">{archivedCount} <small>history kept</small></div></div>
      </div>

      <div className="card">
        <div className="table-tools">
          <div className="week-nav">
            <button className="icon-btn sm" onClick={() => setAnchor(addDaysKey(anchor, -7))} aria-label="Previous week"><ChevronLeft size={15} /></button>
            <b>{fmt(days[0], "MMM d")} – {fmt(days[6], "MMM d")}</b>
            <button className="icon-btn sm" disabled={isThisWeek} onClick={() => setAnchor(addDaysKey(anchor, 7))} aria-label="Next week"><ChevronRight size={15} /></button>
            {!isThisWeek && <button className="link" onClick={() => setAnchor(today)}>This week</button>}
          </div>
          <label className="inline-toggle"><Toggle on={showArchived} onChange={setShowArchived} label="Show archived habits" />Show archived</label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="habit-table">
            <thead>
              <tr>
                <th>Habit</th>
                {days.map((d) => <th key={d} className={cx(d === today && "today")}>{fmt(d, "EEE d")}</th>)}
                <th>Streak</th>
                <th>8-week trend</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const Icon = CAT_ICONS[g.c];
                const c = dayCount(ctx, today, g.c);
                return [
                  <tr key={g.c} className="grp-row">
                    <td colSpan={11}>
                      <span>
                        <span className="cdot" style={{ background: CAT_COLORS[g.c] }} />
                        <Icon size={15} />
                        <b>{g.c}</b>
                        <span className="muted">{g.rows.length} habit{g.rows.length > 1 ? "s" : ""}{!showArchived && ` · ${c.done}/${c.due} done today`}</span>
                      </span>
                    </td>
                  </tr>,
                  ...g.rows.map((h) => {
                    const s = scheduleOn(ctx.idx, h.id, today);
                    return (
                      <tr key={h.id}>
                        <td className="hname">
                          <b>{h.name}</b>
                          <small>{describeSchedule(s)}{s?.kind === "weekly_target" && isThisWeek ? ` · ${doneInWeek(ctx.idx, h.id, today)}/${s.target} this week` : ""}</small>
                        </td>
                        {days.map((d) => {
                          const done = isDone(ctx.idx, h.id, d);
                          const can = canCheck(h, ctx.idx, d);
                          const future = d > today;
                          if (future || (!can && !done)) return <td key={d}><span className={cx("cell", "off", future && "future")} title={future ? "Not yet" : "Not scheduled"} /></td>;
                          return (
                            <td key={d}>
                              <button className={cx("cell", done && "on")} aria-pressed={done} aria-label={`${h.name}, ${fmt(d, "EEEE MMM d")}`} onClick={() => toggleCheckin(store, h.id, d)}>
                                {done && <Check size={14} />}
                              </button>
                            </td>
                          );
                        })}
                        <td><span className="tag pink"><Flame size={12} />{habitStreak(ctx, h, today)}</span></td>
                        <td><div className="center-flex"><Spark values={trend(h)} w={84} h={26} color={CAT_COLORS[h.category]} /></div></td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-btn sm" title="Edit" onClick={() => setEditing(h)}><Pencil size={14} /></button>
                            {h.archived_at ? (
                              <button className="icon-btn sm" title="Restore" onClick={() => restoreHabit(store, h)}><ArchiveRestore size={14} /></button>
                            ) : (
                              <button className="icon-btn sm" title="Archive (keeps history)" onClick={() => archiveHabit(store, h, today)}><Archive size={14} /></button>
                            )}
                            <button className="icon-btn sm" title="Delete" onClick={() => setDeleting(h)}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
          {!groups.length && <Empty>{showArchived ? "No archived habits." : `No habits${filter === "All" ? "" : ` in ${filter}`} yet. Tap “New habit” to add one.`}</Empty>}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <CompanionNote categories={["MVG", "Exercise", "No Sugar"]} who="dog" tip="Tip: tap any past day in the grid to fix a check-in you forgot. Each one is saved to its own date." />
      </div>

      {editing && <HabitModal habit={editing === "new" ? undefined : editing} schedule={editing === "new" ? undefined : scheduleOn(ctx.idx, editing.id, today)} defaultCategory={filter === "All" ? undefined : filter} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm
          title="Delete habit?"
          danger
          confirm="Delete for good"
          text={<>This permanently deletes “{deleting.name}” and all of its check-ins. If you just want to stop tracking it, <b>archive</b> it instead: that keeps its history.</>}
          onNo={() => setDeleting(null)}
          onYes={() => { deleteHabit(store, deleting); setDeleting(null); }}
        />
      )}
    </>
  );
}
