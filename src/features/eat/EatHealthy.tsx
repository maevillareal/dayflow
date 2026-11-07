import { useState } from "react";
import { Info, Plus } from "lucide-react";
import { useToday } from "../../app/providers";
import { createHabit, newHabitDraft, toggleCheckin } from "../../data/actions";
import { useCtx, useDB, useStore } from "../../data/store";
import { canCheck, isDone, isHabitDue } from "../../domain/schedule";
import { pctOf, rangeCount } from "../../domain/stats";
import { CAT_COLORS, type Category } from "../../lib/categories";
import { fmt, weekKeys } from "../../lib/dates";
import { cx } from "../../lib/util";
import { CheckRow, Empty, PageHeader } from "../../components/ui";
import { CompanionNote } from "../../companions/reminders";

/** Eat Healthy and No Sugar are simple daily checklists (habits in those two categories). */
function Checklist({ category, note }: { category: Category; note?: string }) {
  const db = useDB();
  const ctx = useCtx();
  const store = useStore();
  const today = useToday();
  const [name, setName] = useState("");
  const week = weekKeys(today);
  const items = db.habits.filter((h) => h.category === category && !h.archived_at).sort((a, b) => a.sort - b.sort);
  const todayItems = items.filter((h) => canCheck(h, ctx.idx, today));
  const weekPct = pctOf(rangeCount(ctx, week.filter((d) => d <= today), category));
  const add = () => {
    if (!name.trim()) return;
    createHabit(store, { ...newHabitDraft(today, category), name: name.trim() });
    setName("");
  };
  return (
    <div className="card">
      <h3>
        <span className="t"><span className="cdot" style={{ background: CAT_COLORS[category] }} />{category}</span>
        <span className="muted small">This week {weekPct}%</span>
      </h3>
      <div style={{ marginTop: 6 }}>
        {todayItems.length ? (
          todayItems.map((h) => (
            <CheckRow
              key={h.id}
              done={isDone(ctx.idx, h.id, today)}
              onToggle={() => toggleCheckin(store, h.id, today)}
              title={h.name}
              right={
                <span className="week-dots" aria-label="This week">
                  {week.map((d) => (
                    <i key={d} title={fmt(d, "EEE")} className={cx(d > today && "future", !isHabitDue(h, ctx.idx, d) && "off", isDone(ctx.idx, h.id, d) && "on")} />
                  ))}
                </span>
              }
            />
          ))
        ) : (
          <Empty>Nothing on this list today.</Empty>
        )}
      </div>
      <form className="add-row" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input" placeholder={`Add to ${category}…`} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn sm" type="submit" aria-label={`Add to ${category}`}><Plus size={14} /></button>
      </form>
      {note && <p className="hint-row"><Info size={14} />{note}</p>}
    </div>
  );
}

export function EatHealthy() {
  return (
    <>
      <PageHeader title="Eat Healthy" sub="A simple daily checklist. DAYFLOW doesn't set food or calorie targets for you." />
      <div className="grid halves">
        <Checklist category="Eat Healthy" />
        <Checklist category="No Sugar" note="Naturally occurring sugar in whole fruit doesn't count as added sugar." />
      </div>
      <div style={{ marginTop: 16 }}>
        <CompanionNote categories={["Eat Healthy", "No Sugar"]} who="dog" tip="Have you drunk enough water today? Little things add up." />
      </div>
    </>
  );
}
