// popup.js (v1.1.0)

const SETTING_DEFAULTS = {
  zenMode: false,
  hideShorts: true,
  hideSidebar: true,
  hideComments: false,
  hideHomeFeed: false,
  hideEndCards: false,
  hideNotifBell: false
};
const TIMER_KEY = 'cf-timer-v2';
const STATS_KEY = 'cf-stats';

function notifyTabs() {
  chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'updateSettings' }).catch(() => {});
    });
  });
}

async function initSettings() {
  const data = await chrome.storage.sync.get(Object.keys(SETTING_DEFAULTS));
  for (const id of Object.keys(SETTING_DEFAULTS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.checked = data[id] ?? SETTING_DEFAULTS[id];
    el.addEventListener('change', (e) => {
      chrome.storage.sync.set({ [id]: e.target.checked }, notifyTabs);
    });
  }
}

/* ─── Timer mirror ─── */
function initTimer() {
  const el = document.getElementById('cf-timer-line');
  if (!el) return;
  let t = null;

  const render = () => {
    if (!t) { el.textContent = 'Idle — Ready'; return; }
    const rem = t.running && t.endsAt
      ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000))
      : t.remaining;
    const mmss = `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(rem % 60).padStart(2, '0')}`;
    if (t.running) {
      el.textContent = t.phase === 'break'
        ? `On Break — ${mmss}`
        : `Ses·${String(t.session + 1).padStart(2, '0')} — ${mmss}`;
    } else if (t.completed) {
      el.textContent = t.phase === 'focus' ? 'Session Complete' : 'Break Over';
    } else if (rem > 0 && rem < t.total) {
      el.textContent = `Paused — ${mmss}`;
    } else {
      el.textContent = 'Idle — Ready';
    }
  };

  chrome.storage.session.get(TIMER_KEY).then(d => { t = d[TIMER_KEY] || null; render(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[TIMER_KEY]) { t = changes[TIMER_KEY].newValue; render(); }
  });
  setInterval(render, 1000);
}

/* ─── Weekly stats ─── */
async function initStats() {
  const barsEl = document.getElementById('cf-stats-bars');
  const totalsEl = document.getElementById('cf-stats-totals');
  if (!barsEl || !totalsEl) return;

  const d = await chrome.storage.local.get(STATS_KEY);
  const all = d[STATS_KEY] || {};

  // Day keys are UTC to match the service worker's bucketing.
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(now);
    dt.setDate(now.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    days.push({ key, letter: 'SMTWTFS'[dt.getUTCDay()], data: all[key] || {}, today: i === 0 });
  }

  const max = Math.max(1, ...days.map(x => x.data.focusSec || 0));
  const barArea = 40; // px available above the day letters

  barsEl.replaceChildren();
  days.forEach(x => {
    const col = document.createElement('div');
    col.className = 'bar-col' + (x.today ? ' today' : '');
    const bar = document.createElement('div');
    const sec = x.data.focusSec || 0;
    bar.className = 'bar' + (sec === 0 ? ' empty' : '');
    bar.style.height = sec === 0 ? '2px' : Math.max(4, Math.round(barArea * sec / max)) + 'px';
    bar.title = `${Math.round(sec / 60)} min focused`;
    const day = document.createElement('div');
    day.className = 'bar-day';
    day.textContent = x.letter;
    col.append(bar, day);
    barsEl.appendChild(col);
  });

  const sum = (f) => days.reduce((a, x) => a + (x.data[f] || 0), 0);
  const focusSec = sum('focusSec');
  const h = Math.floor(focusSec / 3600), m = Math.round((focusSec % 3600) / 60);
  const focused = h > 0 ? `${h}h ${m}m` : `${m}m`;

  totalsEl.replaceChildren();
  const line = (pairs) => {
    pairs.forEach(([value, label], i) => {
      if (i > 0) totalsEl.append(' · ');
      const b = document.createElement('b');
      b.textContent = String(value);
      totalsEl.append(b, ` ${label}`);
    });
    totalsEl.append(document.createElement('br'));
  };
  line([[focused, 'focused'], [sum('sessions'), 'sessions']]);
  line([[sum('tasksDone'), 'tasks done'], [sum('shortsHidden'), 'shorts dodged']]);
}

document.addEventListener('DOMContentLoaded', () => {
  initSettings();
  initTimer();
  initStats();
});
