import type { Category } from "../lib/categories";
import type { DateKey } from "../lib/dates";

export interface Row {
  id: string;
  created_at?: string;
}

export interface Settings {
  companions: { enabled: boolean; who: "dog" | "cat" | "both"; celebrations: boolean };
  notifications: {
    enabled: boolean;
    quietStart: string; // "22:00"
    quietEnd: string; // "07:00"
    snoozeMinutes: number;
    minGapMinutes: number; // never notify more often than this
    categories: Record<Category, boolean>;
  };
  extensionId: string;
}

export interface Profile extends Row {
  display_name: string;
  settings: Settings;
}

export type ScheduleKind = "daily" | "weekdays" | "weekly_target" | "interval";

export interface Habit extends Row {
  name: string;
  description: string;
  category: Category;
  start_date: DateKey;
  archived_at: DateKey | null;
  sort: number;
}

/** Schedules are versioned: a change adds a new row from that date on, so past days keep the rules they had. */
export interface HabitSchedule extends Row {
  habit_id: string;
  effective_from: DateKey;
  kind: ScheduleKind;
  days: number[]; // weekdays (0 = Sun) for "weekdays"
  target: number; // times per week for "weekly_target"
  interval_days: number; // for "interval"
}

export interface HabitCheckin extends Row {
  habit_id: string;
  date: DateKey;
}

export type Priority = "High" | "Medium" | "Low";

export interface Task extends Row {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  due_date: DateKey | null;
  status: "open" | "done";
  notes: string;
  completed_at: string | null;
}

export interface FocusProfile extends Row {
  name: string;
  domains: string[];
  allow: string[];
}

export interface FocusSchedule extends Row {
  profile_id: string;
  weekday: number;
  start_time: string; // "09:00"
  end_time: string;
  enabled: boolean;
}

export type FocusMode = "normal" | "strict" | "scheduled";

export interface FocusSession extends Row {
  started_at: string;
  ended_at: string;
  planned_min: number;
  actual_sec: number;
  category: Category;
  task_id: string | null;
  mode: FocusMode;
  profile_id: string | null;
  status: "completed" | "interrupted" | "ended_early";
}

export interface SelfCareItem extends Row {
  name: string;
  frequency_days: number;
  next_planned: DateKey | null;
  reminder: boolean;
  notes: string;
  sort: number;
}

export interface SelfCareLog extends Row {
  item_id: string;
  date: DateKey;
  notes: string;
}

export type Routine = "am" | "pm";

export interface SkincareProduct extends Row {
  name: string;
  type: string;
  routines: Routine[];
  /** Weekdays (0 = Sun) it's used; empty means every day. */
  days: number[];
  /** Strong actives (acids, retinoids) that shouldn't share a night. */
  is_active: boolean;
  notes: string;
  sort: number;
}

export interface SkincareLog extends Row {
  product_id: string;
  date: DateKey;
  routine: Routine;
}

export interface ReminderState extends Row {
  key: string;
  snoozed_until: string | null;
  dismissed_on: DateKey | null;
}

export interface Tables {
  profiles: Profile;
  habits: Habit;
  habit_schedules: HabitSchedule;
  habit_checkins: HabitCheckin;
  tasks: Task;
  focus_profiles: FocusProfile;
  focus_schedules: FocusSchedule;
  focus_sessions: FocusSession;
  selfcare_items: SelfCareItem;
  selfcare_log: SelfCareLog;
  skincare_products: SkincareProduct;
  skincare_log: SkincareLog;
  reminder_state: ReminderState;
}
export type TableName = keyof Tables;
export type DB = { [K in TableName]: Tables[K][] };

export const TABLES: TableName[] = [
  "profiles",
  "habits",
  "habit_schedules",
  "habit_checkins",
  "tasks",
  "focus_profiles",
  "focus_schedules",
  "focus_sessions",
  "selfcare_items",
  "selfcare_log",
  "skincare_products",
  "skincare_log",
  "reminder_state",
];

export const emptyDB = (): DB => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as DB;

export interface Repo {
  list<T extends TableName>(table: T): Promise<Tables[T][]>;
  upsert<T extends TableName>(table: T, rows: Tables[T][]): Promise<void>;
  remove(table: TableName, ids: string[]): Promise<void>;
}
