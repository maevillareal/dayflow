import { useState } from "react";
import { Bell, BellOff, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useToday } from "../../app/providers";
import { logSelfcare, unlogSelfcare } from "../../data/actions";
import { useDB, useStore } from "../../data/store";
import type { SelfCareItem } from "../../data/types";
import { doneOn, dueInfo, frequencyLabel, lastDone, nextDue } from "../../domain/selfcare";
import { fmt, relativeDue } from "../../lib/dates";
import { cx, uid } from "../../lib/util";
import { Confirm, Empty, Field, Modal, PageHeader, Toggle } from "../../components/ui";
import { CompanionNote } from "../../companions/reminders";

const PRESETS: [string, number][] = [["Weekly", 7], ["10 days", 10], ["2 weeks", 14], ["Monthly", 30]];

function ItemModal({ item, onClose }: { item?: SelfCareItem; onClose: () => void }) {
  const store = useStore();
  const [d, setD] = useState<SelfCareItem>(item ?? { id: uid(), name: "", frequency_days: 7, next_planned: null, reminder: true, notes: "", sort: store.db.selfcare_items.length });
  const ok = d.name.trim() && d.frequency_days >= 1;
  const save = () => {
    if (!ok) return;
    store.upsert("selfcare_items", [{ ...d, name: d.name.trim() }]);
    onClose();
  };
  return (
    <Modal title={item ? "Edit self-care item" : "Add self-care item"} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={!ok} onClick={save}>Save</button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name"><input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Hair Check" /></Field>
        <Field label="How often (days)">
          <div className="chips">
            {PRESETS.map(([l, n]) => <button type="button" key={l} className={cx("chip", d.frequency_days === n && "on")} onClick={() => setD({ ...d, frequency_days: n })}>{l}</button>)}
            <input className="input chip-input" type="number" min={1} max={365} value={d.frequency_days} onChange={(e) => setD({ ...d, frequency_days: Math.max(1, Number(e.target.value) || 1) })} aria-label="Custom days" />
          </div>
        </Field>
        <label className="inline-toggle"><Toggle on={d.reminder} onChange={(v) => setD({ ...d, reminder: v })} label="Remind me" />Remind me when it's due</label>
        <Field label="Notes"><textarea className="input" rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function SelfCare() {
  const db = useDB();
  const store = useStore();
  const today = useToday();
  const [editing, setEditing] = useState<SelfCareItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<SelfCareItem | null>(null);
  const items = [...db.selfcare_items].sort((a, b) => nextDue(a, db.selfcare_log, today).localeCompare(nextDue(b, db.selfcare_log, today)));

  return (
    <>
      <PageHeader title="Self Care" sub="Grooming on your own rhythm. No streaks, no penalties: just a gentle note when something's coming up." right={<button className="btn" onClick={() => setEditing("new")}><Plus size={16} />Add item</button>} />
      <CompanionNote categories={["Self Care"]} who="cat" tip="A little self-care goes a long way. I'll let you know when something's coming up." />
      <div className="grid care-grid" style={{ marginTop: 16 }}>
        {items.map((it) => {
          const done = doneOn(db.selfcare_log, it.id, today);
          const last = lastDone(db.selfcare_log, it.id);
          const next = nextDue(it, db.selfcare_log, today);
          const info = dueInfo(next, today);
          const history = db.selfcare_log.filter((l) => l.item_id === it.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
          return (
            <div className={cx("card", "care", !done && info.days <= 0 && "due")} key={it.id}>
              <div className="care-head">
                <div>
                  <h3 className="plain-h">{it.name}</h3>
                  <span className="muted small">{frequencyLabel(it.frequency_days)}</span>
                </div>
                <span className={cx("tag", done ? "ok" : info.tone === "today" || info.tone === "past" ? "pink" : "")}>{done ? "Done today" : info.label}</span>
              </div>
              <dl className="care-facts">
                <div><dt>Last done</dt><dd>{last ? relativeDue(today, last) : "Not yet"}</dd></div>
                <div>
                  <dt>Next planned</dt>
                  <dd><input className="input slim" type="date" value={next} onChange={(e) => store.upsert("selfcare_items", [{ ...it, next_planned: e.target.value || null }])} aria-label={`Next date for ${it.name}`} /></dd>
                </div>
              </dl>
              {it.notes && <p className="muted small">{it.notes}</p>}
              {history.length > 0 && <div className="hist">{history.map((h) => <span key={h.id} className="tag">{fmt(h.date, "MMM d")}</span>)}</div>}
              <div className="care-actions">
                <button className={cx("btn", "sm", done && "ghost")} onClick={() => (done ? unlogSelfcare(store, it.id, today) : logSelfcare(store, it.id, today))}>
                  <Check size={14} />{done ? "Undo" : "Done today"}
                </button>
                <button className="icon-btn sm" title={it.reminder ? "Reminders on" : "Reminders off"} onClick={() => store.upsert("selfcare_items", [{ ...it, reminder: !it.reminder }])}>{it.reminder ? <Bell size={14} /> : <BellOff size={14} />}</button>
                <button className="icon-btn sm" title="Edit" onClick={() => setEditing(it)}><Pencil size={14} /></button>
                <button className="icon-btn sm" title="Delete" onClick={() => setDeleting(it)}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
        {!items.length && <div className="card"><Empty>No items yet. Add things like Hair Check or Nail Cut.</Empty></div>}
      </div>
      {editing && <ItemModal item={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm title="Delete item?" danger confirm="Delete" text={`“${deleting.name}” and its history will be removed for good.`} onNo={() => setDeleting(null)} onYes={() => { store.remove("selfcare_log", db.selfcare_log.filter((l) => l.item_id === deleting.id).map((l) => l.id)); store.remove("selfcare_items", [deleting.id]); setDeleting(null); }} />
      )}
    </>
  );
}
