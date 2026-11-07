import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Search, Timer, Trash2 } from "lucide-react";
import { useFilter, useToday } from "../../app/providers";
import { toggleTask } from "../../data/actions";
import { useDB, useStore } from "../../data/store";
import type { Task } from "../../data/types";
import { CAT_COLORS, inFilter } from "../../lib/categories";
import { isoToKey, relativeDue } from "../../lib/dates";
import { cx } from "../../lib/util";
import { CategoryDropdown, CheckRow, Confirm, Empty, PageHeader, Seg } from "../../components/ui";
import { TaskModal } from "./TaskModal";

const VIEWS = ["All Tasks", "Today", "Upcoming", "Overdue", "Completed"] as const;
type View = (typeof VIEWS)[number];
const PRI = { High: 0, Medium: 1, Low: 2 };

export function TodoList() {
  const db = useDB();
  const store = useStore();
  const today = useToday();
  const navigate = useNavigate();
  const [filter, setFilter] = useFilter();
  const [view, setView] = useState<View>("All Tasks");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"Due date" | "Priority">("Due date");
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const match = (t: Task) => {
    if (!inFilter(t.category, filter)) return false;
    if (q && !`${t.title} ${t.description} ${t.notes}`.toLowerCase().includes(q.toLowerCase())) return false;
    switch (view) {
      case "Today": return t.status === "open" && t.due_date === today;
      case "Upcoming": return t.status === "open" && !!t.due_date && t.due_date > today;
      case "Overdue": return t.status === "open" && !!t.due_date && t.due_date < today;
      case "Completed": return t.status === "done";
      default: return t.status === "open";
    }
  };
  const list = db.tasks.filter(match).sort((a, b) => {
    if (view === "Completed") return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
    const due = (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    return sort === "Priority" ? PRI[a.priority] - PRI[b.priority] || due : due || PRI[a.priority] - PRI[b.priority];
  });
  const counts: Record<View, number> = Object.fromEntries(
    VIEWS.map((v) => [v, db.tasks.filter((t) => inFilter(t.category, filter) && (v === "Completed" ? t.status === "done" : v === "Today" ? t.status === "open" && t.due_date === today : v === "Upcoming" ? t.status === "open" && !!t.due_date && t.due_date > today : v === "Overdue" ? t.status === "open" && !!t.due_date && t.due_date < today : t.status === "open")).length]),
  ) as Record<View, number>;

  return (
    <>
      <PageHeader
        title="To-do List"
        sub="One-time tasks, separate from your recurring habits. Completed tasks stay in your history."
        right={
          <>
            <div className="search"><Search size={15} /><input placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tasks" /></div>
            <CategoryDropdown value={filter} onChange={setFilter} />
            <button className="btn" onClick={() => setEditing("new")}><Plus size={16} />Add task</button>
          </>
        }
      />
      <div className="toolbar">
        <Seg value={view} options={VIEWS} onChange={setView} label={(v) => `${v} · ${counts[v]}`} />
        {view !== "Completed" && <Seg small value={sort} options={["Due date", "Priority"] as const} onChange={setSort} label={(s) => `Sort: ${s}`} />}
      </div>
      <div className="card">
        {list.length ? (
          list.map((t) => (
            <CheckRow
              key={t.id}
              done={t.status === "done"}
              onToggle={() => toggleTask(store, t)}
              title={t.title}
              sub={
                <>
                  <span className={cx(t.status === "open" && t.due_date && t.due_date < today && "overdue")}>{t.status === "done" && t.completed_at ? `Done ${relativeDue(today, isoToKey(t.completed_at)).toLowerCase()}` : t.due_date ? `Due ${relativeDue(today, t.due_date).toLowerCase()}` : "No due date"}</span>
                  {" · "}<span className="cdot inline" style={{ background: CAT_COLORS[t.category] }} />{t.category}
                  {t.notes && <> · {t.notes}</>}
                </>
              }
              right={
                <div className="row-actions">
                  <span className={cx("tag", t.priority === "High" && "high")}>{t.priority}</span>
                  {t.status === "open" && <button className="btn ghost sm" onClick={() => navigate(`/focus?task=${t.id}`)} title="Focus on this task"><Timer size={14} />Focus</button>}
                  <button className="icon-btn sm" title="Edit" onClick={() => setEditing(t)}><Pencil size={14} /></button>
                  <button className="icon-btn sm" title="Delete" onClick={() => setDeleting(t)}><Trash2 size={14} /></button>
                </div>
              }
            />
          ))
        ) : (
          <Empty>{q ? "No tasks match your search." : view === "Completed" ? "Completed tasks will show up here." : "Nothing here. Enjoy the breathing room."}</Empty>
        )}
      </div>
      {editing && <TaskModal task={editing === "new" ? undefined : editing} defaultCategory={filter === "All" ? undefined : filter} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm title="Delete task?" danger confirm="Delete" text={`“${deleting.title}” will be removed for good. Completing it instead keeps it in your history.`} onNo={() => setDeleting(null)} onYes={() => { store.remove("tasks", [deleting.id]); setDeleting(null); }} />
      )}
    </>
  );
}
