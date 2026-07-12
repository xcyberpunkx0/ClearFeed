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

// Mirror of content.js THEMES — keep the two maps in sync.
const THEMES = {
  aurora: ['#3ea6ff', '#a78bfa'],
  sunset: ['#ff6b6b', '#ffa94d'],
  mint:   ['#34d399', '#22d3ee'],
  rose:   ['#ec4899', '#8b5cf6'],
  gold:   ['#fbbf24', '#f59e0b'],
  ember:  ['#f43f5e', '#fb923c']
};

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

/* ─── Theme picker ─── */
async function initTheme() {
  const wrap = document.getElementById('cf-themes');
  if (!wrap) return;

  const apply = (name) => {
    const g = THEMES[name] || THEMES.aurora;
    document.documentElement.style.setProperty('--grad-a', g[0]);
    document.documentElement.style.setProperty('--grad-b', g[1]);
    wrap.querySelectorAll('.swatch').forEach(b => {
      const on = b.dataset.theme === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  };

  const data = await chrome.storage.sync.get('theme');
  let current = data.theme || 'aurora';

  for (const [name, g] of Object.entries(THEMES)) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.theme = name;
    b.style.background = `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', `${name} theme`);
    b.addEventListener('click', () => {
      current = name;
      apply(name);
      chrome.storage.sync.set({ theme: name });
    });
    wrap.appendChild(b);
  }
  apply(current);
}

/* ─── Timer mirror ─── */
function initTimer() {
  const el = document.getElementById('cf-timer-line');
  if (!el) return;
  let t = null;

  const render = () => {
    if (!t) { el.textContent = 'Ready'; return; }
    const rem = t.running && t.endsAt
      ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000))
      : t.remaining;
    const mmss = `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(rem % 60).padStart(2, '0')}`;
    if (t.running) {
      el.textContent = t.phase === 'break'
        ? `On break · ${mmss}`
        : `Focusing · ${mmss}`;
    } else if (t.completed) {
      el.textContent = t.phase === 'focus' ? 'Session complete' : 'Break over';
    } else if (rem > 0 && rem < t.total) {
      el.textContent = `Paused · ${mmss}`;
    } else {
      el.textContent = 'Ready';
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
  line([[sum('tasksDone'), 'tasks done'], [sum('shortsHidden'), 'Shorts hidden']]);
}

document.addEventListener('DOMContentLoaded', () => {
  initSettings();
  initTheme();
  initTimer();
  initStats();
});
