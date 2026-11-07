import { useState } from "react";
import { CalendarRange, Info, Moon, Pencil, Plus, Sun, Trash2, TriangleAlert } from "lucide-react";
import { useToday } from "../../app/providers";
import { completeRoutine, toggleSkincare } from "../../data/actions";
import { useDB, useStore } from "../../data/store";
import type { Routine, SkincareProduct } from "../../data/types";
import { activeConflicts, activesOn, isRestNight, routineStatus } from "../../domain/skincare";
import { weekdayOf, WEEK_ORDER, WEEKDAY_SHORT } from "../../lib/dates";
import { cx, uid } from "../../lib/util";
import { CheckRow, Confirm, Empty, Field, Modal, PageHeader, Toggle, WeekdayPicker } from "../../components/ui";
import { CompanionNote } from "../../companions/reminders";

function ProductModal({ product, onClose }: { product?: SkincareProduct; onClose: () => void }) {
  const store = useStore();
  const [d, setD] = useState<SkincareProduct>(product ?? { id: uid(), name: "", type: "", routines: ["pm"], days: [], is_active: false, notes: "", sort: store.db.skincare_products.length });
  const ok = d.name.trim() && d.routines.length > 0;
  const toggleRoutine = (r: Routine) => setD({ ...d, routines: d.routines.includes(r) ? d.routines.filter((x) => x !== r) : [...d.routines, r] });
  const save = () => {
    if (!ok) return;
    store.upsert("skincare_products", [{ ...d, name: d.name.trim() }]);
    onClose();
  };
  return (
    <Modal title={product ? "Edit product" : "Add product"} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={!ok} onClick={save}>Save</button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="row-2">
          <Field label="Product"><input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Tretinoin" /></Field>
          <Field label="Type"><input className="input" value={d.type} onChange={(e) => setD({ ...d, type: e.target.value })} placeholder="e.g. Retinoid" /></Field>
        </div>
        <Field label="Routine">
          <div className="chips">
            <button type="button" className={cx("chip", d.routines.includes("am") && "on")} onClick={() => toggleRoutine("am")}><Sun size={13} />Morning</button>
            <button type="button" className={cx("chip", d.routines.includes("pm") && "on")} onClick={() => toggleRoutine("pm")}><Moon size={13} />Evening</button>
          </div>
        </Field>
        <Field label="Days" hint={d.days.length ? <button type="button" className="link" onClick={() => setD({ ...d, days: [] })}>Use every day</button> : "Every day. Pick days to use it only on those."}>
          <WeekdayPicker value={d.days} onChange={(days) => setD({ ...d, days })} />
        </Field>
        <label className="inline-toggle"><Toggle on={d.is_active} onChange={(v) => setD({ ...d, is_active: v })} label="Strong active" />Strong active (acid or retinoid): warn me if two land on the same night</label>
        <Field label="Notes"><textarea className="input" rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function SkinCare() {
  const db = useDB();
  const store = useStore();
  const today = useToday();
  const [editing, setEditing] = useState<SkincareProduct | "new" | null>(null);
  const [deleting, setDeleting] = useState<SkincareProduct | null>(null);
  const conflicts = activeConflicts(db.skincare_products);
  const products = [...db.skincare_products].sort((a, b) => a.sort - b.sort);

  const routineCard = (routine: Routine) => {
    const st = routineStatus(db.skincare_products, db.skincare_log, today, routine);
    const rest = routine === "pm" && isRestNight(db.skincare_products, today);
    return (
      <div className="card">
        <h3>
          <span className="t">{routine === "am" ? <Sun size={16} /> : <Moon size={16} />}{routine === "am" ? "Morning" : "Evening"}</span>
          <span className="muted small">{st.done.size}/{st.list.length}{rest ? " · Rest night" : ""}</span>
        </h3>
        <div style={{ marginTop: 6 }}>
          {st.list.length ? st.list.map((p) => <CheckRow key={p.id} done={st.done.has(p.id)} onToggle={() => toggleSkincare(store, p.id, today, routine)} title={p.name} sub={p.type} />) : <Empty>Nothing scheduled.</Empty>}
        </div>
        {st.list.length > 0 && !st.complete && <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => completeRoutine(store, today, routine)}>Mark whole routine done</button>}
      </div>
    );
  };

  return (
    <>
      <PageHeader title="Skin Care" sub="Your routine, your schedule. Skipping a night is not a failure." right={<button className="btn" onClick={() => setEditing("new")}><Plus size={16} />Add product</button>} />
      <div className="grid skin-grid">
        {routineCard("am")}
        {routineCard("pm")}
        <CompanionNote categories={["Skin Care"]} who="cat" tip="Your skin likes consistency, and rest nights count too." />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3><span className="t"><CalendarRange size={16} />Evening actives</span><span className="muted small">Glycolic Acid and Tretinoin keep separate schedules</span></h3>
        {conflicts.length > 0 && (
          <div className="warn" style={{ marginTop: 12 }}>
            <TriangleAlert size={16} />
            <span>Two strong actives share {conflicts.map((d) => WEEKDAY_SHORT[d]).join(", ")}. DAYFLOW never schedules them together on its own; adjust their days if that wasn't intended.</span>
          </div>
        )}
        <div className="week-grid">
          {WEEK_ORDER.map((wd) => {
            const acts = activesOn(db.skincare_products, wd);
            return (
              <div key={wd} className={cx("wk-cell", wd === weekdayOf(today) && "today", acts.length === 0 && "rest", conflicts.includes(wd) && "conflict")}>
                <div className="muted small">{WEEKDAY_SHORT[wd]}</div>
                <div className="wk-val">{acts.length ? acts.map((a) => a.name).join(" + ") : "Rest"}</div>
              </div>
            );
          })}
        </div>
        <p className="hint-row"><Info size={14} />DAYFLOW doesn't prescribe a routine. Set these to match your dermatologist's guidance.</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3><span className="t">Products</span></h3>
        {products.map((p) => (
          <div className="prod-row" key={p.id}>
            <div className="tx">
              <b>{p.name}</b> {p.is_active && <span className="tag pink">Active</span>}
              <small>{[p.type, p.routines.map((r) => (r === "am" ? "Morning" : "Evening")).join(" & "), p.days.length ? WEEK_ORDER.filter((d) => p.days.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(" · ") : "Every day"].filter(Boolean).join(" · ")}</small>
              {p.notes && <small>{p.notes}</small>}
            </div>
            <div className="row-actions">
              <button className="icon-btn sm" title="Edit" onClick={() => setEditing(p)}><Pencil size={14} /></button>
              <button className="icon-btn sm" title="Delete" onClick={() => setDeleting(p)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {!products.length && <Empty>No products yet.</Empty>}
      </div>
      {editing && <ProductModal product={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm title="Delete product?" danger confirm="Delete" text={`“${deleting.name}” and its usage history will be removed for good.`} onNo={() => setDeleting(null)} onYes={() => { store.remove("skincare_log", db.skincare_log.filter((l) => l.product_id === deleting.id).map((l) => l.id)); store.remove("skincare_products", [deleting.id]); setDeleting(null); }} />
      )}
    </>
  );
}
