/**
 * ClearFeed - background.js (v1.1.0)
 * Service worker: owns the global Pomodoro timer, badge, notifications, and stats.
 *
 * Timer state lives in chrome.storage.session (cleared on browser restart —
 * a half-finished session should not haunt tomorrow). Views read it directly
 * and re-render on storage.onChanged; commands arrive as runtime messages.
 */

const TIMER_KEY = 'cf-timer-v2';
const STATS_KEY = 'cf-stats';
const DEFAULT_TIMER = {
  phase: 'focus',      // 'focus' | 'break'
  running: false,
  remaining: 1500,     // seconds, authoritative while not running
  total: 1500,         // length of the current phase
  focusTotal: 1500,    // chosen focus preset, survives breaks
  session: 0,          // completed focus sessions (every 4th earns a long break)
  completed: false,    // current phase finished, awaiting the next
  recordedSec: 0       // focus seconds already credited to stats this phase
};

// Let content scripts read the timer state directly.
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

async function getTimer() {
  const d = await chrome.storage.session.get(TIMER_KEY);
  return { ...DEFAULT_TIMER, ...(d[TIMER_KEY] || {}) };
}

async function setTimer(t) {
  await chrome.storage.session.set({ [TIMER_KEY]: t });
  updateBadge(t);
}

const remainingOf = (t) =>
  t.running && t.endsAt ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : t.remaining;

function updateBadge(t) {
  if (t.running) {
    chrome.action.setBadgeBackgroundColor({ color: t.phase === 'break' ? '#8a877f' : '#3ea6ff' });
    chrome.action.setBadgeText({ text: String(Math.max(1, Math.ceil(remainingOf(t) / 60))) });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

/* ─── Stats (serialized writes; day keys are UTC, pruned to 60 days) ─── */
let statsQueue = Promise.resolve();
function addStats(fields) {
  statsQueue = statsQueue.then(async () => {
    const key = new Date().toISOString().slice(0, 10);
    const d = await chrome.storage.local.get(STATS_KEY);
    const all = d[STATS_KEY] || {};
    const day = all[key] || { focusSec: 0, sessions: 0, tasksDone: 0, shortsHidden: 0 };
    for (const [k, v] of Object.entries(fields)) day[k] = (day[k] || 0) + v;
    all[key] = day;
    const keys = Object.keys(all).sort();
    while (keys.length > 60) delete all[keys.shift()];
    await chrome.storage.local.set({ [STATS_KEY]: all });
  }).catch(() => {});
  return statsQueue;
}

// Credit focus seconds not yet recorded for this phase (called on pause/complete).
async function creditFocus(t) {
  if (t.phase !== 'focus') return t;
  const elapsed = t.total - remainingOf(t);
  const delta = elapsed - (t.recordedSec || 0);
  if (delta > 0) {
    await addStats({ focusSec: delta });
    t.recordedSec = elapsed;
  }
  return t;
}

/* ─── Timer state machine ─── */
async function start() {
  const t = await getTimer();
  if (t.running) return;
  if (t.completed) {
    if (t.phase === 'focus') {
      t.phase = 'break';
      t.total = t.session % 4 === 0 ? 900 : 300;
    } else {
      t.phase = 'focus';
      t.total = t.focusTotal;
    }
    t.remaining = t.total;
    t.completed = false;
    t.recordedSec = 0;
  }
  if (t.remaining <= 0) t.remaining = t.total;
  t.running = true;
  t.endsAt = Date.now() + t.remaining * 1000;
  chrome.alarms.create('cf-complete', { when: t.endsAt });
  chrome.alarms.create('cf-badge', { periodInMinutes: 0.5 });
  await setTimer(t);
}

async function pause() {
  let t = await getTimer();
  if (!t.running) return;
  t.remaining = remainingOf(t);
  t.running = false;
  t.endsAt = null;
  t = await creditFocus(t);
  chrome.alarms.clear('cf-complete');
  chrome.alarms.clear('cf-badge');
  await setTimer(t);
}

async function setPreset(minutes) {
  const t = await getTimer();
  t.focusTotal = minutes * 60;
  if (!t.running && !t.completed && t.phase === 'focus') {
    t.total = t.focusTotal;
    t.remaining = t.focusTotal;
    t.recordedSec = 0;
  }
  await setTimer(t);
}

async function complete() {
  let t = await getTimer();
  if (!t.running) return;
  t.remaining = 0;
  t.running = false;
  t.endsAt = null;
  t.completed = true;
  const wasFocus = t.phase === 'focus';
  if (wasFocus) {
    t = await creditFocus(t);
    t.session++;
    await addStats({ sessions: 1 });
  }
  chrome.alarms.clear('cf-badge');
  await setTimer(t);

  chrome.notifications.create('cf-done-' + Date.now(), {
    type: 'basic',
    iconUrl: 'icons/png/image.png',
    title: wasFocus ? 'Session complete' : 'Break over',
    message: wasFocus
      ? (t.session % 4 === 0 ? 'Time for a long break — you earned it.' : 'Time for a short break.')
      : 'Ready for the next deep work session.'
  });
}

/* ─── Wiring ─── */
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'cf-complete') complete();
  else if (a.name === 'cf-badge') getTimer().then(updateBadge);
});

chrome.runtime.onMessage.addListener((m) => {
  if (!m || !m.cmd) return;
  if (m.cmd === 'timer.toggle') getTimer().then(t => t.running ? pause() : start());
  else if (m.cmd === 'timer.preset') setPreset(m.minutes);
  else if (m.cmd === 'stats.add') addStats({ [m.field]: m.n || 1 });
});

chrome.runtime.onStartup.addListener(() => getTimer().then(updateBadge));
chrome.runtime.onInstalled.addListener(() => getTimer().then(updateBadge));
