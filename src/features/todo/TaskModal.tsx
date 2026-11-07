import { useState } from "react";
import { saveTask, type TaskDraft } from "../../data/actions";
import { useStore } from "../../data/store";
import type { Priority, Task } from "../../data/types";
import { TASK_CATEGORIES, type Category, type TaskCategory } from "../../lib/categories";
import { Field, Modal } from "../../components/ui";
import { useToday } from "../../app/providers";

export function TaskModal({ task, defaultCategory, onClose }: { task?: Task; defaultCategory?: Category; onClose: () => void }) {
  const store = useStore();
  const today = useToday();
  const [d, setD] = useState<TaskDraft>(() =>
    task
      ? { title: task.title, description: task.description, category: task.category, priority: task.priority, due_date: task.due_date, notes: task.notes }
      : { title: "", description: "", category: defaultCategory ?? "General", priority: "Medium", due_date: today, notes: "" },
  );
  const ok = d.title.trim().length > 0;
  const save = () => {
    if (!ok) return;
    saveTask(store, d, task);
    onClose();
  };
  return (
    <Modal
      title={task ? "Edit task" : "Add task"}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!ok} onClick={save}>{task ? "Save" : "Add task"}</button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Title">
          <input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="What needs doing?" required />
        </Field>
        <div className="row-2">
          <Field label="Category">
            <select className="input" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as TaskCategory })}>
              {TASK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value as Priority })}>
              {(["High", "Medium", "Low"] as Priority[]).map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Due date" hint={<button type="button" className="link" onClick={() => setD({ ...d, due_date: null })}>No due date</button>}>
          <input className="input" type="date" value={d.due_date ?? ""} onChange={(e) => setD({ ...d, due_date: e.target.value || null })} />
        </Field>
        <Field label="Description">
          <textarea className="input" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea className="input" rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
