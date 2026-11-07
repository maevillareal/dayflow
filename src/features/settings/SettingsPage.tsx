import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell, Download, HeartHandshake, MonitorDown, PlugZap, RotateCcw, ShieldCheck, User } from "lucide-react";
import { useToast } from "../../app/providers";
import { saveSettings } from "../../data/actions";
import { localRepo } from "../../data/localRepo";
import { useDB, useSettings, useStore } from "../../data/store";
import type { Settings } from "../../data/types";
import { CATEGORIES } from "../../lib/categories";
import { cx } from "../../lib/util";
import { Confirm, Field, PageHeader, Seg, Toggle } from "../../components/ui";
import { Cat, Dog } from "../../companions/Companions";
import { useExtension } from "../focus/extension";
import type { Account } from "../auth/AuthGate";

type InstallEvent = Event & { prompt: () => Promise<void> };
let deferredInstall: InstallEvent | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e as InstallEvent;
});

export function SettingsPage({ account }: { account: Account }) {
  const db = useDB();
  const store = useStore();
  const settings = useSettings();
  const toast = useToast();
  const ext = useExtension();
  const { hash } = useLocation();
  const [name, setName] = useState(db.profiles[0]?.display_name ?? "");
  const [extId, setExtId] = useState(settings.extensionId);
  const [perm, setPerm] = useState(() => ("Notification" in window ? Notification.permission : "denied"));
  const [resetting, setResetting] = useState(false);
  const [canInstall, setCanInstall] = useState(!!deferredInstall);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);
  useEffect(() => {
    const on = () => setCanInstall(true);
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  const set = (fn: (s: Settings) => Settings) => saveSettings(store, fn, settings);

  async function enableNotifications(v: boolean) {
    if (v && "Notification" in window && Notification.permission !== "granted") {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== "granted") return toast("Notifications are blocked for this site. You can allow them in your browser's site settings.");
    }
    set((s) => ({ ...s, notifications: { ...s.notifications, enabled: v } }));
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), app: "DAYFLOW", data: db }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dayflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const n = settings.notifications;
  return (
    <>
      <PageHeader title="Settings" sub={account.demo ? "Demo mode: everything is saved in this browser only." : `Signed in as ${account.email}`} />
      <div className="settings">
        <section className="card" id="profile">
          <h3><span className="t"><User size={16} />Profile</span></h3>
          <Field label="Your name">
            <div className="add-row">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should Lei and Tobi call you?" />
              <button className="btn sm" onClick={() => { saveSettings(store, (s) => s, settings, name.trim()); toast("Saved"); }}>Save</button>
            </div>
          </Field>
        </section>

        <section className="card" id="companions">
          <h3><span className="t"><HeartHandshake size={16} />Companions</span></h3>
          <div className="pets-row"><Dog size={72} /><Cat size={72} /></div>
          <label className="inline-toggle"><Toggle on={settings.companions.enabled} onChange={(v) => set((s) => ({ ...s, companions: { ...s.companions, enabled: v } }))} label="Show companions" />Show Lei and Tobi</label>
          <Field label="Who reminds you">
            <Seg small value={settings.companions.who} options={["both", "dog", "cat"] as const} onChange={(v) => set((s) => ({ ...s, companions: { ...s.companions, who: v } }))} label={(o) => (o === "both" ? "Both" : o === "dog" ? "Lei (dog)" : "Tobi (cat)")} />
          </Field>
          <label className="inline-toggle"><Toggle on={settings.companions.celebrations} onChange={(v) => set((s) => ({ ...s, companions: { ...s.companions, celebrations: v } }))} label="Celebrations" />Celebration messages when everything's done</label>
        </section>

        <section className="card" id="notifications">
          <h3><span className="t"><Bell size={16} />Reminders & notifications</span></h3>
          <label className="inline-toggle"><Toggle on={n.enabled && perm === "granted"} onChange={(v) => void enableNotifications(v)} label="Desktop notifications" />Desktop notifications</label>
          <p className="hint-row">They work while DAYFLOW is open, in a tab or as an installed app (even minimized). DAYFLOW can't notify you when it's fully closed. {perm === "denied" && <b>Notifications are blocked for this site in your browser.</b>}</p>
          <div className="row-3">
            <Field label="Quiet from"><input className="input" type="time" value={n.quietStart} onChange={(e) => set((s) => ({ ...s, notifications: { ...s.notifications, quietStart: e.target.value } }))} /></Field>
            <Field label="Quiet until"><input className="input" type="time" value={n.quietEnd} onChange={(e) => set((s) => ({ ...s, notifications: { ...s.notifications, quietEnd: e.target.value } }))} /></Field>
            <Field label="“Later” snoozes for">
              <select className="input" value={n.snoozeMinutes} onChange={(e) => set((s) => ({ ...s, notifications: { ...s.notifications, snoozeMinutes: Number(e.target.value) } }))}>
                {[10, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}</option>)}
              </select>
            </Field>
          </div>
          <Field label="At most one notification every">
            <select className="input narrow" value={n.minGapMinutes} onChange={(e) => set((s) => ({ ...s, notifications: { ...s.notifications, minGapMinutes: Number(e.target.value) } }))}>
              {[15, 30, 45, 60, 120, 180].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}</option>)}
            </select>
          </Field>
          <div className="field-label">Remind me about</div>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button key={c} className={cx("chip", n.categories[c] && "on")} aria-pressed={n.categories[c]} onClick={() => set((s) => ({ ...s, notifications: { ...s.notifications, categories: { ...s.notifications.categories, [c]: !s.notifications.categories[c] } } }))}>{c}</button>
            ))}
          </div>
          {perm === "granted" && (
            <button className="btn ghost sm" style={{ marginTop: 14 }} onClick={() => new Notification("Lei says", { body: "Hi! This is how reminders will look.", icon: "icons/icon-192.png" })}>Send a test notification</button>
          )}
        </section>

        <section className="card" id="blocking">
          <h3><span className="t"><PlugZap size={16} />Website blocking (Chrome extension)</span></h3>
          <div className={cx("warn", "info", ext.status.connected && "good")} style={{ margin: "12px 0" }}>
            {ext.status.connected ? <ShieldCheck size={16} /> : <PlugZap size={16} />}
            <span>{ext.status.connected ? `Connected${ext.status.version ? ` (version ${ext.status.version})` : ""}. ${ext.status.active ? "Blocking is active right now." : "Not blocking right now."}` : "Not connected. Focus timers still work, but sites won't be blocked."}</span>
          </div>
          <ol className="steps">
            <li>Download the <b>extension</b> folder from the DAYFLOW project (on GitHub: Code → Download ZIP, then unzip).</li>
            <li>In Chrome, open <code>chrome://extensions</code> and turn on <b>Developer mode</b>.</li>
            <li>Click <b>Load unpacked</b> and choose the <b>extension</b> folder.</li>
            <li>Copy the extension's ID from that page into the box below.</li>
          </ol>
          <Field label="Extension ID">
            <div className="add-row">
              <input className="input" value={extId} onChange={(e) => setExtId(e.target.value.trim())} placeholder="32 letters, a–p" spellCheck={false} />
              <button className="btn sm" onClick={async () => { set((s) => ({ ...s, extensionId: extId })); setTimeout(async () => { const st = await ext.refresh(); toast(st.connected ? "Extension connected" : "Couldn't reach the extension. Check the ID and that it's turned on."); }, 50); }}>Save & test</button>
            </div>
          </Field>
          <p className="hint-row">Blocking needs Chrome open with the extension turned on. Like any extension, it can be switched off, so Strict Mode isn't tamper-proof.</p>
        </section>

        <section className="card" id="install">
          <h3><span className="t"><MonitorDown size={16} />Install DAYFLOW</span></h3>
          <p className="muted small">Install it as an app to get its own window, a Start-menu shortcut, and reminders while it's minimized.</p>
          {canInstall ? (
            <button className="btn" style={{ marginTop: 10 }} onClick={async () => { await deferredInstall?.prompt(); deferredInstall = null; setCanInstall(false); }}><MonitorDown size={16} />Install app</button>
          ) : (
            <p className="hint-row">In Chrome or Edge, use the install icon at the right end of the address bar (or menu → Cast, save and share → Install). If you're already in the app window, you're all set.</p>
          )}
        </section>

        <section className="card" id="data">
          <h3><span className="t"><Download size={16} />Your data</span></h3>
          <div className="add-row" style={{ justifyContent: "flex-start" }}>
            <button className="btn ghost" onClick={exportData}><Download size={16} />Export as JSON</button>
            {account.demo && <button className="btn ghost" onClick={() => setResetting(true)}><RotateCcw size={16} />Reset demo data</button>}
          </div>
          {!account.demo && <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => void account.signOut()}>Log out</button>}
        </section>
      </div>
      {resetting && (
        <Confirm title="Reset demo data?" danger confirm="Reset" text="This clears everything saved in this browser's demo and starts again with fresh sample data." onNo={() => setResetting(false)} onYes={async () => { await localRepo.reset(); location.reload(); }} />
      )}
    </>
  );
}
