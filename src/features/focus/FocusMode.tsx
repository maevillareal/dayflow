import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, CirclePlay, Coffee, Lock, Pause, Play, PlugZap, Plus, ShieldAlert, ShieldBan, ShieldCheck, Square, Trash2, X } from "lucide-react";
import { useToast, useToday } from "../../app/providers";
import { useDB, useStore } from "../../data/store";
import type { FocusMode as Mode, FocusProfile } from "../../data/types";
import { CATEGORIES, CAT_COLORS, isCategory, type Category } from "../../lib/categories";
import { fmtTime, isoToKey, lastNDays, monthStartKey, weekStartKey, WEEK_ORDER, WEEKDAY_SHORT } from "../../lib/dates";
import { cx, fmtMin, normalizeDomain, sum, uid } from "../../lib/util";
import { Confirm, Empty, Field, PageHeader, Toggle } from "../../components/ui";
import { CompanionNote } from "../../companions/reminders";
import { fmtClock, useFocus } from "./focus";
import { useExtension } from "./extension";

const FOCUS_PRESETS = [15, 25, 45, 60];
const BREAK_PRESETS = [5, 10, 15];
const MODES: { k: Mode; icon: typeof Lock; title: string; text: string }[] = [
  { k: "normal", icon: CirclePlay, title: "Normal", text: "Pause or end anytime. Sites unblock when the session ends." },
  { k: "strict", icon: Lock, title: "Strict", text: "No pausing, settings lock. Emergency exit needs confirmation and is recorded as interrupted." },
  { k: "scheduled", icon: CalendarClock, title: "Scheduled", text: "Blocks automatically on set days and times. No timer needed. Chrome must be open." },
];

export function FocusMode() {
  const db = useDB();
  const store = useStore();
  const today = useToday();
  const toast = useToast();
  const focus = useFocus();
  const ext = useExtension();
  const [params] = useSearchParams();
  const presetTask = db.tasks.find((t) => t.id === params.get("task"));

  // A General task has no habit category, so the session keeps the chosen category (MVG by default).
  const [category, setCategory] = useState<Category>(presetTask && isCategory(presetTask.category) ? presetTask.category : "MVG");
  const [taskId, setTaskId] = useState<string>(presetTask?.id ?? "");
  const [minutes, setMinutes] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [mode, setMode] = useState<Mode>("normal");
  const [profileId, setProfileId] = useState(db.focus_profiles[0]?.id ?? "");
  const [confirmExit, setConfirmExit] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newAllow, setNewAllow] = useState("");

  useEffect(() => {
    if (presetTask) {
      setTaskId(presetTask.id);
      if (isCategory(presetTask.category)) setCategory(presetTask.category);
    }
  }, [presetTask]);

  const running = focus.active;
  const locked = !!running;
  // While a session runs, show its own settings (they survive reloads), not the idle form's.
  const shownMode: Mode = running ? running.mode : mode;
  const profile = db.focus_profiles.find((p) => p.id === (running?.profile_id ?? profileId)) ?? db.focus_profiles[0];
  const openTasks = db.tasks.filter((t) => t.status === "open");

  const totalMs = running ? (running.phase === "focus" ? running.planned_min : running.break_min) * 60_000 : minutes * 60_000;
  const remaining = running ? focus.remainingMs : minutes * 60_000;
  const C = 2 * Math.PI * 116;

  async function start() {
    if (!profile) return;
    await focus.start({ mode: mode === "strict" ? "strict" : "normal", category, task_id: taskId || null, profile_id: profile.id, planned_min: minutes, break_min: breakMin, domains: profile.domains, allow: profile.allow });
    const s = await ext.refresh();
    if (!s.connected && profile.domains.length) toast("Timer started. Website blocking is off because the Chrome extension isn't connected.");
  }

  const saveProfile = (p: FocusProfile) => store.upsert("focus_profiles", [p]);
  const addTo = (field: "domains" | "allow", raw: string, reset: () => void) => {
    const d = normalizeDomain(raw);
    if (!d || !profile) return toast("That doesn't look like a website address. Try something like youtube.com");
    if (!profile[field].includes(d)) saveProfile({ ...profile, [field]: [...profile[field], d] });
    reset();
  };

  /* ---------- analytics ---------- */
  const stats = useMemo(() => {
    const s = db.focus_sessions;
    const mins = (list: typeof s) => sum(list.map((x) => x.actual_sec)) / 60;
    const on = (from: string) => s.filter((x) => isoToKey(x.started_at) >= from);
    const month = on(monthStartKey(today));
    const perCat = CATEGORIES.map((c) => ({ c, m: mins(month.filter((x) => x.category === c)) })).filter((x) => x.m > 0);
    return {
      today: mins(on(today)),
      week: mins(on(weekStartKey(today))),
      month: mins(month),
      completed: month.filter((x) => x.status === "completed").length,
      interrupted: month.filter((x) => x.status !== "completed").length,
      perCat,
      maxCat: Math.max(1, ...perCat.map((x) => x.m)),
      recent: [...s].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 8),
      last7: lastNDays(today, 7).map((d) => mins(s.filter((x) => isoToKey(x.started_at) === d))),
    };
  }, [db.focus_sessions, today]);

  const blockingLine = !ext.status.connected ? (
    <>Blocking: <b>not active</b>. Connect the DAYFLOW Chrome extension (Settings → Website blocking) so it can block sites and confirm it here.</>
  ) : ext.status.active ? (
    <>Blocking: <b>active</b>, confirmed by the extension ({ext.status.ruleCount} rule{ext.status.ruleCount === 1 ? "" : "s"}{ext.status.until ? `, until ${fmtTime(ext.status.until, { hour: "numeric", minute: "2-digit" })} ET` : ""}).</>
  ) : (
    <>Extension connected. Blocking turns on when a session starts{ext.status.scheduledNow ? "" : " or a schedule begins"}.</>
  );

  return (
    <div className="focus-page">
      <PageHeader title="Focus Mode" sub="Pick what you're working on, start the timer, and let the extension keep distractions away." />
      <div className="grid focus-grid">
        <div className="card">
          <h3><span className="t">Session setup</span>{locked && <span className="tag"><Lock size={11} />Locked</span>}</h3>
          <fieldset disabled={locked} className="plain">
            <Field label="Category">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Related task (optional)">
              <select className="input" value={taskId} onChange={(e) => { setTaskId(e.target.value); const t = db.tasks.find((x) => x.id === e.target.value); if (t && isCategory(t.category)) setCategory(t.category); }}>
                <option value="">None</option>
                {openTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </Field>
            <Field label="Focus duration (minutes)">
              <div className="chips">
                {FOCUS_PRESETS.map((m) => <button type="button" key={m} className={cx("chip", minutes === m && "on")} onClick={() => setMinutes(m)}>{m}m</button>)}
                <input className="input chip-input" type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(Math.max(1, Math.min(240, Number(e.target.value) || 1)))} aria-label="Custom focus minutes" />
              </div>
            </Field>
            <Field label="Break (minutes)">
              <div className="chips">
                {BREAK_PRESETS.map((m) => <button type="button" key={m} className={cx("chip", breakMin === m && "on")} onClick={() => setBreakMin(m)}>{m}m</button>)}
                <input className="input chip-input" type="number" min={0} max={60} value={breakMin} onChange={(e) => setBreakMin(Math.max(0, Math.min(60, Number(e.target.value) || 0)))} aria-label="Custom break minutes" />
              </div>
            </Field>
            <Field label="Focus profile">
              <div className="chips">
                {db.focus_profiles.map((p) => <button type="button" key={p.id} className={cx("chip", profile?.id === p.id && "on")} onClick={() => setProfileId(p.id)}>{p.name}</button>)}
                <button type="button" className="chip" onClick={() => { const p = { id: uid(), name: "Custom", domains: [], allow: [] }; saveProfile(p); setProfileId(p.id); }}><Plus size={13} />Custom</button>
              </div>
            </Field>
          </fieldset>
        </div>

        <div className="card">
          <div className="timer">
            <div className="timer-ring">
              <svg viewBox="0 0 260 260" className="ringbig" aria-hidden>
                <circle cx="130" cy="130" r="116" fill="none" stroke="#2b3a4f" strokeWidth="10" />
                <circle cx="130" cy="130" r="116" fill="none" stroke={running?.phase === "break" ? "var(--ok)" : "var(--pink)"} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - remaining / Math.max(1, totalMs))} transform="rotate(-90 130 130)" />
              </svg>
              <div className="timer-text">
                <div className="time" aria-live="off">{fmtClock(remaining)}</div>
                <div className="muted">
                  {running ? (running.phase === "break" ? "Break time" : running.paused_at ? "Paused" : `${running.category} · ${running.mode === "strict" ? "Strict" : "Normal"}`) : `${profile?.name ?? "No profile"} · ${MODES.find((m) => m.k === mode)!.title}`}
                </div>
              </div>
            </div>
            <div className="timer-btns">
              {!running && mode !== "scheduled" && <button className="btn" onClick={() => void start()} disabled={!profile}><Play size={16} />Start focus</button>}
              {!running && mode === "scheduled" && <p className="muted center small">Scheduled Mode runs on its own from your schedules below.</p>}
              {running?.phase === "focus" && running.mode === "normal" && (
                <>
                  {running.paused_at ? <button className="btn" onClick={focus.resume}><Play size={16} />Resume</button> : <button className="btn ghost" onClick={focus.pause}><Pause size={16} />Pause</button>}
                  <button className="btn ghost" onClick={() => void focus.stop("ended_early")}><Square size={14} />End session</button>
                </>
              )}
              {running?.phase === "focus" && running.mode === "strict" && <button className="btn ghost" onClick={() => setConfirmExit(true)}><ShieldAlert size={16} />Emergency exit</button>}
              {running?.phase === "break" && <button className="btn ghost" onClick={focus.skipBreak}><Coffee size={16} />Skip break</button>}
            </div>
          </div>
          <div role="radiogroup" aria-label="Focus mode">
            {MODES.map(({ k, icon: Icon, title, text }) => (
              <button key={k} role="radio" aria-checked={shownMode === k} disabled={locked} className={cx("mode", shownMode === k && "on")} onClick={() => setMode(k)}>
                <Icon size={18} />
                <div><b>{title}</b><p>{text}</p></div>
              </button>
            ))}
          </div>
          {shownMode === "strict" && <div className="warn"><ShieldAlert size={16} /><span>Strict Mode isn't tamper-proof: disabling or uninstalling the Chrome extension removes the blocking.</span></div>}
        </div>

        <div className="card">
          <h3><span className="t"><ShieldBan size={16} />Blocked sites</span>{profile && <span className="tag">{profile.name}</span>}</h3>
          <div className={cx("warn", "info", ext.status.active && "good")} style={{ margin: "14px 0" }}>
            {ext.status.active ? <ShieldCheck size={16} /> : <PlugZap size={16} />}
            <span>{blockingLine}</span>
          </div>
          {profile ? (
            <>
              <fieldset disabled={locked} className="plain">
                <Field label="Profile name">
                  <input className="input" value={profile.name} onChange={(e) => saveProfile({ ...profile, name: e.target.value })} />
                </Field>
                {profile.domains.map((d) => (
                  <div className="site" key={d}>
                    <span>{d} <span className="muted small">+ subdomains</span></span>
                    <button className="icon-btn sm" aria-label={`Unblock ${d}`} onClick={() => saveProfile({ ...profile, domains: profile.domains.filter((x) => x !== d) })}><X size={13} /></button>
                  </div>
                ))}
                {!profile.domains.length && <Empty>No blocked sites in this profile yet.</Empty>}
                <form className="add-row" onSubmit={(e) => { e.preventDefault(); addTo("domains", newDomain, () => setNewDomain("")); }}>
                  <input className="input" placeholder="Block a site, e.g. youtube.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
                  <button className="btn sm" type="submit" aria-label="Add blocked site"><Plus size={14} /></button>
                </form>
                <div className="field-label" style={{ marginTop: 16 }}>Allowed exceptions</div>
                {profile.allow.map((d) => (
                  <div className="site" key={d}>
                    <span className="pink-text">{d}</span>
                    <button className="icon-btn sm" aria-label={`Remove exception ${d}`} onClick={() => saveProfile({ ...profile, allow: profile.allow.filter((x) => x !== d) })}><X size={13} /></button>
                  </div>
                ))}
                <form className="add-row" onSubmit={(e) => { e.preventDefault(); addTo("allow", newAllow, () => setNewAllow("")); }}>
                  <input className="input" placeholder="Always allow, e.g. music.youtube.com" value={newAllow} onChange={(e) => setNewAllow(e.target.value)} />
                  <button className="btn sm" type="submit" aria-label="Add exception"><Plus size={14} /></button>
                </form>
              </fieldset>
              {db.focus_profiles.length > 1 && !locked && (
                <button className="link muted" style={{ marginTop: 14 }} onClick={() => { store.remove("focus_profiles", [profile.id]); store.remove("focus_schedules", db.focus_schedules.filter((s) => s.profile_id === profile.id).map((s) => s.id)); setProfileId(""); }}>
                  <Trash2 size={13} />Delete this profile
                </button>
              )}
            </>
          ) : (
            <Empty>Create a profile to choose which sites to block.</Empty>
          )}
        </div>
      </div>

      <div className="grid halves" style={{ marginTop: 16 }}>
        <div className="card">
          <h3><span className="t"><CalendarClock size={16} />Scheduled Mode</span><span className="muted small">Needs Chrome open with the extension on</span></h3>
          {db.focus_schedules.length ? (
            <div className="sched-list">
              {[...db.focus_schedules].sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday) || a.start_time.localeCompare(b.start_time)).map((s) => (
                <div className="sched" key={s.id}>
                  <Toggle on={s.enabled} onChange={(v) => store.upsert("focus_schedules", [{ ...s, enabled: v }])} label="Schedule on" />
                  <select className="input" value={s.weekday} onChange={(e) => store.upsert("focus_schedules", [{ ...s, weekday: Number(e.target.value) }])} aria-label="Day">
                    {WEEK_ORDER.map((d) => <option key={d} value={d}>{WEEKDAY_SHORT[d]}</option>)}
                  </select>
                  <input className="input" type="time" value={s.start_time} onChange={(e) => store.upsert("focus_schedules", [{ ...s, start_time: e.target.value }])} aria-label="Start" />
                  <span className="muted">–</span>
                  <input className="input" type="time" value={s.end_time} onChange={(e) => store.upsert("focus_schedules", [{ ...s, end_time: e.target.value }])} aria-label="End" />
                  <select className="input" value={s.profile_id} onChange={(e) => store.upsert("focus_schedules", [{ ...s, profile_id: e.target.value }])} aria-label="Profile">
                    {db.focus_profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button className="icon-btn sm" aria-label="Delete schedule" onClick={() => store.remove("focus_schedules", [s.id])}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No schedules yet. Add one to block sites automatically, for example weekdays 9:00–12:00.</Empty>
          )}
          <button className="btn ghost sm" style={{ marginTop: 12 }} disabled={!db.focus_profiles.length} onClick={() => store.upsert("focus_schedules", [{ id: uid(), profile_id: profile?.id ?? db.focus_profiles[0].id, weekday: 1, start_time: "09:00", end_time: "12:00", enabled: true }])}>
            <Plus size={14} />Add schedule
          </button>
        </div>

        <div className="card">
          <h3><span className="t">Focus history</span><span className="muted small">This month</span></h3>
          <div className="mini-stats">
            <div><small>Today</small><b>{fmtMin(stats.today)}</b></div>
            <div><small>This week</small><b>{fmtMin(stats.week)}</b></div>
            <div><small>This month</small><b>{fmtMin(stats.month)}</b></div>
            <div><small>Completed</small><b>{stats.completed}</b></div>
            <div><small>Interrupted</small><b>{stats.interrupted}</b></div>
          </div>
          {stats.perCat.map((x) => (
            <div className="hbar" key={x.c}>
              <span>{x.c}</span>
              <div className="bar"><i style={{ width: `${(x.m / stats.maxCat) * 100}%`, background: CAT_COLORS[x.c] }} /></div>
              <b>{fmtMin(x.m)}</b>
            </div>
          ))}
          <div className="recent">
            {stats.recent.map((s) => (
              <div key={s.id} className="recent-row">
                <span className="cdot" style={{ background: CAT_COLORS[s.category] }} />
                <span>{fmtTime(s.started_at, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                <span className="muted">{s.category}</span>
                <span>{fmtMin(s.actual_sec / 60)}</span>
                <span className={cx("tag", s.status === "completed" ? "ok" : "")}>{s.status === "completed" ? "Completed" : s.status === "interrupted" ? "Interrupted" : "Ended early"}</span>
              </div>
            ))}
            {!stats.recent.length && <Empty>Your sessions will show up here.</Empty>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <CompanionNote categories={[]} who="dog" tip="Ready for a little uninterrupted work? I'll keep quiet until you're done." />
      </div>

      {confirmExit && (
        <Confirm
          title="Leave this strict session?"
          danger
          confirm="Exit and record as interrupted"
          text="Strict Mode is meant to keep you going until the timer ends. If you really need to stop, the session will be saved as interrupted and blocking will lift."
          onNo={() => setConfirmExit(false)}
          onYes={() => { setConfirmExit(false); void focus.stop("interrupted"); }}
        />
      )}
    </div>
  );
}
