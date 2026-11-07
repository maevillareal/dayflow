import { useState } from "react";
import { createHabit, newHabitDraft, updateHabit, type HabitDraft } from "../../data/actions";
import { useStore } from "../../data/store";
import type { Habit, HabitSchedule, ScheduleKind } from "../../data/types";
import { CATEGORIES, type Category } from "../../lib/categories";
import { Field, Modal, Seg, WeekdayPicker } from "../../components/ui";
import { useToday } from "../../app/providers";
import { Info } from "lucide-react";

const KINDS: { k: ScheduleKind; label: string }[] = [
  { k: "daily", label: "Daily" },
  { k: "weekdays", label: "Specific days" },
  { k: "weekly_target", label: "Weekly target" },
  { k: "interval", label: "Every N days" },
];

export function HabitModal({ habit, schedule, defaultCategory, onClose }: { habit?: Habit; schedule?: HabitSchedule; defaultCategory?: Category; onClose: () => void }) {
  const store = useStore();
  const today = useToday();
  const [d, setD] = useState<HabitDraft>(() =>
    habit
      ? {
          name: habit.name,
          description: habit.description,
          category: habit.category,
          start_date: habit.start_date,
          kind: schedule?.kind ?? "daily",
          days: schedule?.days.length ? schedule.days : [1, 3, 5],
          target: schedule?.target || 3,
          interval_days: schedule?.interval_days || 2,
        }
      : newHabitDraft(today, defaultCategory),
  );
  const valid = d.name.trim() && (d.kind !== "weekdays" || d.days.length > 0) && (d.kind !== "weekly_target" || (d.target >= 1 && d.target <= 7)) && (d.kind !== "interval" || d.interval_days >= 1);
  const save = () => {
    if (!valid) return;
    const clean: HabitDraft = { ...d, days: d.kind === "weekdays" ? d.days : [], target: d.kind === "weekly_target" ? d.target : 0, interval_days: d.kind === "interval" ? d.interval_days : 0 };
    if (habit) updateHabit(store, habit, clean, today, schedule);
    else createHabit(store, clean);
    onClose();
  };
  const label = KINDS.find((x) => x.k === d.kind)!.label;
  return (
    <Modal
      title={habit ? "Edit habit" : "New habit"}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!valid} onClick={save}>{habit ? "Save" : "Add habit"}</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name">
          <input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Walk for at least 20 minutes" required />
        </Field>
        <div className="row-2">
          <Field label="Category">
            <select className="input" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as Category })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Start date">
            <input className="input" type="date" value={d.start_date} onChange={(e) => e.target.value && setD({ ...d, start_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Schedule">
          <Seg small value={label} options={KINDS.map((x) => x.label)} onChange={(l) => setD({ ...d, kind: KINDS.find((x) => x.label === l)!.k })} />
        </Field>
        {d.kind === "weekdays" && (
          <Field label="On these days">
            <WeekdayPicker value={d.days} onChange={(days) => setD({ ...d, days })} />
          </Field>
        )}
        {d.kind === "weekly_target" && (
          <Field label="Times per week" hint="Any days you like. A day only counts as missed when skipping it would make the target impossible.">
            <input className="input narrow" type="number" min={1} max={7} value={d.target} onChange={(e) => setD({ ...d, target: Number(e.target.value) })} />
          </Field>
        )}
        {d.kind === "interval" && (
          <Field label="Repeat every (days)">
            <input className="input narrow" type="number" min={1} max={365} value={d.interval_days} onChange={(e) => setD({ ...d, interval_days: Number(e.target.value) })} />
          </Field>
        )}
        <Field label="Description (optional)">
          <textarea className="input" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </Field>
        {habit && (
          <p className="hint-row"><Info size={14} />Schedule changes apply from today. Earlier days keep the schedule they had, so past results don't change.</p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
