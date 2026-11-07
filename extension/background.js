// DAYFLOW Focus: enforces website blocking for the DAYFLOW web app.
//
// Security model
// - Only pages listed in manifest.json "externally_connectable" can message this extension,
//   and every message is checked again here against that list.
// - Every field is validated: domains must look like domains, times like HH:MM, sessions are capped at 6 hours.
// - Blocking state lives in chrome.storage.local, so it survives browser restarts until the session ends.
// - The extension never sends browsing data anywhere. It only answers the app's messages.

const VERSION = chrome.runtime.getManifest().version;
const DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_SESSION_MS = 6 * 60 * 60 * 1000;
const ALLOWED = (chrome.runtime.getManifest().externally_connectable?.matches ?? []).map((p) => p.replace(/\*$/, ""));

const cleanDomains = (list) =>
  Array.isArray(list)
    ? [...new Set(list.filter((d) => typeof d === "string").map((d) => d.trim().toLowerCase().replace(/^www\./, "")).filter((d) => d.length < 254 && DOMAIN_RE.test(d)))].slice(0, 500)
    : [];

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** The schedule active right now, if any. End before start means it runs past midnight. */
function activeSchedule(schedules, now = new Date()) {
  const wd = now.getDay();
  const t = now.getHours() * 60 + now.getMinutes();
  for (const s of schedules) {
    const a = toMin(s.start);
    const b = toMin(s.end);
    let endsToday = null;
    if (b > a && s.weekday === wd && t >= a && t < b) endsToday = b;
    else if (b <= a && s.weekday === wd && t >= a) endsToday = b + 1440;
    else if (b <= a && (s.weekday + 1) % 7 === wd && t < b) endsToday = b;
    if (endsToday !== null) {
      const until = new Date(now);
      until.setHours(0, 0, 0, 0);
      return { ...s, until: until.getTime() + endsToday * 60_000 };
    }
  }
  return null;
}

async function apply() {
  const { session = null, schedules = [] } = await chrome.storage.local.get(["session", "schedules"]);
  let s = session;
  if (s && s.endsAt <= Date.now()) {
    s = null;
    await chrome.storage.local.set({ session: null });
  }
  const sched = activeSchedule(schedules);
  const domains = new Set([...(s?.domains ?? []), ...(sched?.domains ?? [])]);
  const allow = new Set([...(s?.allow ?? []), ...(sched?.allow ?? [])]);
  const rules = [];
  if (domains.size) {
    rules.push({ id: 1, priority: 1, action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } }, condition: { requestDomains: [...domains], resourceTypes: ["main_frame"] } });
    if (allow.size) rules.push({ id: 2, priority: 2, action: { type: "allow" }, condition: { requestDomains: [...allow], resourceTypes: ["main_frame"] } });
  }
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing.map((r) => r.id), addRules: rules });
  await chrome.alarms.clear("session-end");
  if (s) await chrome.alarms.create("session-end", { when: s.endsAt });
  await chrome.action.setBadgeText({ text: domains.size ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#F4B8CE" });
  const status = { active: domains.size > 0, ruleCount: rules.length, until: s?.endsAt ?? sched?.until ?? null, scheduledNow: !!sched, mode: s?.mode ?? (sched ? "scheduled" : null) };
  await chrome.storage.local.set({ status });
  return status;
}

async function handle(msg) {
  if (!msg || typeof msg !== "object") return { ok: false, error: "bad message" };
  switch (msg.type) {
    case "ping":
      return { ok: true, version: VERSION, ...(await apply()) };
    case "session.start": {
      const endsAt = Number(msg.endsAt);
      if (!Number.isFinite(endsAt) || endsAt <= Date.now() || endsAt > Date.now() + MAX_SESSION_MS) return { ok: false, error: "bad endsAt" };
      const mode = msg.mode === "strict" ? "strict" : "normal";
      await chrome.storage.local.set({ session: { domains: cleanDomains(msg.domains), allow: cleanDomains(msg.allow), endsAt, mode } });
      return { ok: true, version: VERSION, ...(await apply()) };
    }
    case "session.end":
      await chrome.storage.local.set({ session: null });
      return { ok: true, version: VERSION, ...(await apply()) };
    case "schedules.set": {
      if (!Array.isArray(msg.schedules)) return { ok: false, error: "bad schedules" };
      const schedules = msg.schedules
        .slice(0, 50)
        .filter((s) => s && Number.isInteger(s.weekday) && s.weekday >= 0 && s.weekday <= 6 && TIME_RE.test(s.start) && TIME_RE.test(s.end) && s.start !== s.end)
        .map((s) => ({ weekday: s.weekday, start: s.start, end: s.end, domains: cleanDomains(s.domains), allow: cleanDomains(s.allow) }));
      await chrome.storage.local.set({ schedules });
      return { ok: true, version: VERSION, ...(await apply()) };
    }
    default:
      return { ok: false, error: "unknown type" };
  }
}

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  const from = sender.url ?? sender.origin ?? "";
  if (!ALLOWED.some((prefix) => from.startsWith(prefix))) {
    sendResponse({ ok: false, error: "not allowed" });
    return false;
  }
  handle(msg).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
  return true; // respond asynchronously
});

chrome.alarms.onAlarm.addListener(() => void apply());
const boot = async () => {
  await chrome.alarms.create("tick", { periodInMinutes: 1 });
  await apply();
};
chrome.runtime.onInstalled.addListener(boot);
chrome.runtime.onStartup.addListener(boot);
