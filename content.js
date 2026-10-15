/**
 * ClearFeed - content.js (v1.1.1)
 * OLED identity: true-black surfaces, Sora UI text, Doto dot-matrix display
 * digits, and a user-selected gradient theme (THEMES / sync key 'theme') that
 * tints every accent — clock, dial, toggles, chips, buttons, task spines.
 *
 * ARCHITECTURE:
 * 1. State: Settings + tasks; the timer lives in the service worker and is
 *    only *viewed* here (read from chrome.storage.session, commands via messages).
 * 2. Styles: High-performance CSS-only distraction removal + Zen homepage.
 * 3. Components: Modular UI construction for the Dashboard.
 * 4. Engine: MutationObserver-based surgical injection.
 */

/* ─── 1. Constants & Configuration ─── */
const APP_ID = 'cf-dash';
const ZEN_ID = 'cf-zen';
const STYLES_ID = 'cf-styles';
const TASKS_KEY = 'cf-tasks';
const TIMER_KEY = 'cf-timer-v2';
// YouTube's October 2026 watch layout puts comments and the description in a
// fixed right-hand side rail and moves related videos into a grid under the
// player. Older builds only have #fixed-side-menu, newer ones the view model.
const SIDE_RAIL = ':is(#fixed-side-menu, .ytSideRailViewModelHost)';
const SHORTS_SELECTORS = [
  'ytd-reel-shelf-renderer', 'ytd-rich-shelf-renderer[is-shorts]',
  'ytd-rich-section-renderer:has(> #content > ytd-rich-shelf-renderer[is-shorts])',
  'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2',
  '.shortsLockupViewModelHostOutsideMetadata', 'ytd-reel-item-renderer', '[is-shorts]',
  'grid-shelf-view-model:has(a[href^="/shorts/"])',
  'yt-lockup-view-model:has(a[href^="/shorts/"])',
  'ytd-compact-video-renderer:has(a[href^="/shorts/"])',
  'ytd-guide-entry-renderer:has(a[href*="/shorts"])',
  'ytd-mini-guide-entry-renderer[aria-label*="Shorts"]',
  'ytd-video-renderer:has(a[href*="/shorts/"])',
  '#shorts-container', 'ytd-rich-item-renderer:has(a[href*="/shorts/"])',
  'span[title="Shorts"]', 'a[title="Shorts"]'
];
// Bundled identity fonts (declared in web_accessible_resources):
// Sora carries all UI text, Doto is the dot-matrix display face for the
// clock, countdown digits, and task indices.
const FONT_STACK = `"Sora", "Roboto", "Arial", sans-serif`;
const DOTO_STACK = `"Doto", "Consolas", monospace`;

// Gradient theme presets — the user picks one in the popup (sync key 'theme').
const THEMES = {
  aurora: ['#3ea6ff', '#a78bfa'],
  sunset: ['#ff6b6b', '#ffa94d'],
  mint:   ['#34d399', '#22d3ee'],
  rose:   ['#ec4899', '#8b5cf6'],
  gold:   ['#fbbf24', '#f59e0b'],
  ember:  ['#f43f5e', '#fb923c']
};

const SETTING_DEFAULTS = {
  theme: 'aurora',
  focusArmed: true,
  zenMode: false,
  hideShorts: true,
  hideSidebar: true,
  hideComments: false,
  hideHomeFeed: false,
  hideEndCards: false,
  hideNotifBell: false
};

let config = { ...SETTING_DEFAULTS };

// A rule applies when Zen overrides everything, or Focus is armed and the pref is on.
const effective = (key) => config.zenMode || (config.focusArmed && config[key]);

/* ─── 2. State Management ─── */
let tasks = [];
let timerState = null; // mirror of the service worker's cf-timer-v2

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const Persistence = {
  isAlive: () => { try { return !!chrome.runtime.id; } catch { return false; } },

  loadTasks: async () => {
    // One-time migration: tasks used to live in YouTube's localStorage, where
    // they were wiped with site data and never synced.
    try {
      const legacy = localStorage.getItem(TASKS_KEY);
      if (legacy) {
        localStorage.removeItem(TASKS_KEY);
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length) {
          tasks = parsed.map(t => ({ id: newId(), ...t }));
          await chrome.storage.sync.set({ [TASKS_KEY]: tasks });
          return;
        }
      }
    } catch {}
    const data = await chrome.storage.sync.get(TASKS_KEY);
    tasks = (data[TASKS_KEY] || []).map(t => (t.id ? t : { id: newId(), ...t }));
  },
  saveTasks: () => {
    if (Persistence.isAlive()) chrome.storage.sync.set({ [TASKS_KEY]: tasks });
  }
};

const Timer = {
  load: async () => {
    try {
      const d = await chrome.storage.session.get(TIMER_KEY);
      timerState = d[TIMER_KEY] || null;
    } catch {}
  },
  remaining: (t) =>
    t && t.running && t.endsAt ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : (t ? t.remaining : 1500),
  send: (msg) => { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch {} }
};

const Stats = {
  add: (field, n) => Timer.send({ cmd: 'stats.add', field, n }),
  countedUrl: '',
  countShorts: () => {
    if (!effective('hideShorts') || Stats.countedUrl === location.href) return;
    const n = document.querySelectorAll(
      'ytd-rich-item-renderer:has(a[href*="/shorts/"]), ytd-video-renderer:has(a[href*="/shorts/"]), ' +
      'yt-lockup-view-model:has(a[href^="/shorts/"]), ytm-shorts-lockup-view-model, ' +
      'ytd-reel-shelf-renderer, grid-shelf-view-model:has(a[href^="/shorts/"])'
    ).length;
    if (n > 0) {
      Stats.countedUrl = location.href;
      Stats.add('shortsHidden', n);
    }
  }
};

/* ─── 3. Utility Methods ─── */
const UI = {
  create: (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }
};

// Two soft sine tones instead of a blocking alert() when a session ends.
function playChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [523.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.15 + 1.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 1.3);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch {}
}

/* ─── 4. Global Styles ─── */
function applyProductionStyles() {
  if (!Persistence.isAlive()) return;
  let el = document.getElementById(STYLES_ID);
  if (!el) {
    el = UI.create('style');
    el.id = STYLES_ID;
    (document.head || document.documentElement).appendChild(el);
  }

  let css = '';

  // Distraction Removal (each rule gated by Zen/Focus + pref)
  if (effective('hideShorts')) {
    css += `${SHORTS_SELECTORS.join(',\n')} { display: none !important; }\n`;
  }

  if (effective('hideSidebar') && window.location.pathname.includes('/watch')) {
    // #related lives in #secondary or, in the new layout, in #below under the
    // player. Engagement panels are only hidden outside the side rail, because
    // the rail is built from them (description, comments); comments have their
    // own toggle.
    css += `
      ytd-watch-flexy #related, ytd-watch-next-secondary-results-renderer,
      ytd-playlist-panel-renderer, ytd-live-chat-frame,
      ytd-engagement-panel-section-list-renderer:not(
        [target-id="engagement-panel-comments-section"],
        [target-id="engagement-panel-structured-description"],
        ${SIDE_RAIL} *
      ) {
        visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;
        height: 1px !important; overflow: hidden !important; display: block !important;
      }
      html:not([data-cf-side-rail]) #secondary.ytd-watch-flexy { display: block !important; visibility: visible !important; }
      #cf-dash { position: sticky; top: 72px; height: calc(100vh - 96px); }
    `;
  } else {
    css += `
      #cf-dash { position: relative; top: 0; height: auto; margin-bottom: 24px; }
      #cf-dash .cf-timer-section { margin-top: 24px; }
    `;
  }

  if (effective('hideComments')) {
    css += `ytd-comments#comments, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"] { display: none !important; }\n`;
  }
  if (effective('hideEndCards')) {
    css += `.ytp-ce-element, .ytp-endscreen-content, .ytp-cards-button, .ytp-cards-button-shape { display: none !important; }\n`;
  }
  if (effective('hideNotifBell')) {
    css += `ytd-notification-topbar-button-renderer { display: none !important; }\n`;
  }
  if (effective('hideHomeFeed') || config.zenMode) {
    css += `
      ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,
      ytd-browse[page-subtype="home"] ytd-feed-filter-chip-bar-renderer { display: none !important; }
    `;
  }

  // Theme & Layout — OLED black + user-selected gradient
  const grad = THEMES[config.theme] || THEMES.aurora;
  css += `
    @font-face {
      font-family: 'Sora';
      font-style: normal;
      font-weight: 100 800;
      src: url('${chrome.runtime.getURL('fonts/sora.woff2')}') format('woff2');
    }
    @font-face {
      font-family: 'Doto';
      font-style: normal;
      font-weight: 100 900;
      src: url('${chrome.runtime.getURL('fonts/doto.woff2')}') format('woff2');
    }
    #cf-dash, #cf-zen {
      --grad-a: ${grad[0]}; --grad-b: ${grad[1]};
      --grad: linear-gradient(135deg, var(--grad-a), var(--grad-b));
      --bg: #ffffff;
      --tx: #0f0f0f; --tx2: #606060;
      --card: #f5f5f5; --chip: #f2f2f2; --chip-hover: #e5e5e5;
      --hair: rgba(0, 0, 0, 0.1);
    }
    html[dark] #cf-dash, html[dark] #cf-zen {
      --bg: #000000;
      --tx: #f1f1f1; --tx2: #999999;
      --card: #111111; --chip: #161616; --chip-hover: #262626;
      --hair: rgba(255, 255, 255, 0.14);
    }
    #cf-dash {
      display: flex; flex-direction: column; font-family: ${FONT_STACK};
      color: var(--tx); background: var(--bg);
      border: 1px solid var(--hair); border-radius: 12px;
      padding: 20px; margin-right: 12px; overflow-y: auto; scrollbar-width: none;
    }
    #cf-dash::-webkit-scrollbar { display: none; }
    /* Side rail (new layout): a compact card above YouTube's panels. */
    #cf-dash[data-mount="rail"] {
      position: relative; top: 0; height: auto; max-height: 60vh;
      flex: 0 0 auto; margin: 0 0 12px; box-sizing: border-box;
    }
    #cf-dash :is(button, [tabindex], input):focus-visible, #cf-zen input:focus-visible { outline: 2px solid var(--grad-a); outline-offset: 2px; }

    .cf-grad-ink {
      background-image: var(--grad);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cf-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 2px 0 16px; border-bottom: 1px solid var(--hair);
    }
    .cf-clock {
      font-family: ${DOTO_STACK};
      font-size: 38px; font-weight: 900; line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .cf-label { font-size: 11px; color: var(--tx2); margin-top: 7px; }
    .cf-live {
      width: 8px; height: 8px; border-radius: 50%; background: var(--tx2);
      margin-top: 8px; opacity: 0.4; flex-shrink: 0; transition: 0.3s;
    }
    .cf-live.on { opacity: 1; background: var(--grad); animation: cfGlow 2.4s ease-in-out infinite; }
    @keyframes cfGlow { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .cf-focus-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 0; border-bottom: 1px solid var(--hair);
    }
    .cf-focus-text { font-size: 13px; font-weight: 500; color: var(--tx); }
    .cf-tag {
      position: relative; width: 36px; height: 20px; flex-shrink: 0;
      border: none; border-radius: 999px; cursor: pointer; padding: 0;
      background: var(--chip-hover); transition: background 0.2s;
    }
    .cf-tag::after {
      content: ''; position: absolute; top: 50%; left: 3px;
      width: 14px; height: 14px; border-radius: 50%;
      background: var(--bg); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      transform: translateY(-50%); transition: transform 0.2s;
    }
    .cf-tag.armed { background: var(--grad); }
    .cf-tag.armed::after { transform: translate(16px, -50%); background: #fff; }

    .cf-tasks { padding: 14px 0 6px; border-bottom: 1px solid var(--hair); }
    .cf-tasks-title { font-size: 12px; font-weight: 500; color: var(--tx2); letter-spacing: 0.3px; }
    .cf-add-btn {
      background: var(--chip); border: none; border-radius: 50%;
      width: 28px; height: 28px; color: var(--tx); cursor: pointer; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .cf-add-btn:hover { background: var(--chip-hover); }
    .cf-add-in {
      width: 100%; padding: 9px 16px; background: transparent;
      border: 1px solid var(--hair); border-radius: 999px;
      color: var(--tx); margin: 12px 0 4px; font-family: ${FONT_STACK}; font-size: 14px;
      box-sizing: border-box; outline: none;
    }
    .cf-add-in:focus { border-color: var(--grad-a); }
    .cf-add-in::placeholder { color: var(--tx2); }
    .cf-task {
      display: flex; align-items: center; gap: 10px;
      background: var(--card); border-radius: 10px; padding: 10px 12px; margin: 8px 0;
      cursor: pointer; animation: cfIn 0.3s ease-out;
    }
    @keyframes cfIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
    .cf-spine { width: 3px; height: 18px; border-radius: 2px; background: var(--grad); flex-shrink: 0; }
    .cf-idx {
      font-family: ${DOTO_STACK}; font-weight: 900; font-size: 13px;
      width: 20px; flex-shrink: 0; font-variant-numeric: tabular-nums;
    }
    .cf-tnam { font-size: 13px; color: var(--tx); }
    .cf-task.done .cf-tnam { text-decoration: line-through; color: var(--tx2); }
    .cf-task.done .cf-spine, .cf-task.done .cf-idx { opacity: 0.35; }

    .cf-timer-presets { display: flex; gap: 8px; margin: 16px 0 6px; justify-content: center; }
    .cf-preset {
      font-family: ${FONT_STACK}; font-size: 12px; font-weight: 500;
      padding: 6px 12px; border-radius: 999px; background: var(--chip);
      border: none; color: var(--tx2); cursor: pointer; transition: 0.15s;
    }
    .cf-preset:hover { background: var(--chip-hover); color: var(--tx); }
    .cf-preset.active { background: var(--grad); color: #000; font-weight: 600; }

    .cf-timer-section { padding: 20px 0 8px; }
    .cf-timer-ring { margin: 4px 0 8px; }
    .cf-timer-ring.cf-done { animation: cfPulse 1.6s ease-in-out 2; }
    @keyframes cfPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
    .cf-timer-digits {
      font-family: ${DOTO_STACK}; font-size: 48px; font-weight: 900;
      line-height: 1; text-align: center; font-variant-numeric: tabular-nums;
    }
    .cf-bar {
      height: 5px; border-radius: 999px; background: var(--chip);
      margin: 16px 0 2px; overflow: hidden;
    }
    #cf-timer-fill {
      display: block; height: 100%; width: 0%; border-radius: 999px;
      background: linear-gradient(90deg, var(--grad-a), var(--grad-b));
      transition: width 0.5s ease;
    }
    .cf-timer-ring.cf-break #cf-timer-fill { background: var(--tx2); }
    .cf-timer-ring.cf-break .cf-timer-digits {
      background-image: none; -webkit-text-fill-color: var(--tx2);
    }
    .cf-btn {
      font-family: ${FONT_STACK}; font-size: 13px; font-weight: 600;
      padding: 9px 26px; border-radius: 999px;
      background: var(--grad); color: #000;
      border: none; cursor: pointer; transition: opacity 0.15s;
    }
    .cf-btn:hover { opacity: 0.88; }

    /* Zen homepage takeover */
    #cf-zen {
      position: fixed; top: 56px; left: 0; right: 0; bottom: 0; z-index: 600;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 18px; background: var(--bg); font-family: ${FONT_STACK};
    }
    .cf-zen-mark {
      font-family: ${FONT_STACK};
      font-size: 52px; font-weight: 700; letter-spacing: -1px;
    }
    .cf-zen-label { font-size: 14px; color: var(--tx2); }
    .cf-zen-in {
      width: min(480px, 80vw); padding: 13px 24px; background: transparent;
      border: 1px solid var(--hair); border-radius: 999px;
      color: var(--tx); font-family: ${FONT_STACK}; font-size: 16px;
      box-sizing: border-box; outline: none; text-align: center;
    }
    .cf-zen-in:focus { border-color: var(--grad-a); }
    .cf-zen-in::placeholder { color: var(--tx2); }

    @media (prefers-reduced-motion: reduce) {
      #cf-dash, #cf-dash *, #cf-zen, #cf-zen * { animation: none !important; transition: none !important; }
    }
  `;
  el.textContent = css;
}

/* ─── 5. UI Components ─── */

// The timer view: renders module-level timerState into whatever dashboard DOM
// exists. Runs on a global 1s interval + on every storage change.
function renderTimer() {
  const t = timerState || { phase: 'focus', running: false, remaining: 1500, total: 1500, focusTotal: 1500, session: 0, completed: false };
  const rem = Timer.remaining(t);
  const m = Math.floor(rem / 60), s = rem % 60;

  const v = document.getElementById('cf-timer-val');
  if (v) v.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const f = document.getElementById('cf-timer-fill');
  if (f) f.style.width = `${(100 * (t.total - rem) / (t.total || 1)).toFixed(2)}%`;

  const ring = document.getElementById('cf-timer-ring');
  if (ring) ring.classList.toggle('cf-break', t.phase === 'break');

  const label = document.getElementById('cf-timer-label');
  if (label) {
    const status = t.phase === 'break'
      ? (t.completed ? 'Break over' : 'Break')
      : (t.completed ? 'Session complete' : 'Focus');
    label.textContent = t.completed ? status : `${status} · Session ${t.session + 1}`;
  }

  const btn = document.getElementById('cf-timer-btn');
  if (btn) {
    btn.textContent = t.running ? 'Pause'
      : t.completed ? (t.phase === 'focus' ? (t.session % 4 === 0 ? 'Start long break' : 'Start break') : 'Start focus')
      : rem > 0 && rem < t.total ? 'Resume'
      : t.phase === 'break' ? 'Start break' : 'Start';
  }

  const ses = document.getElementById('cf-ses-label');
  if (ses) ses.textContent = `Session ${t.session + 1}`;

  const dot = document.getElementById('cf-live-dot');
  if (dot) dot.classList.toggle('on', !!t.running);

  const presets = document.getElementById('cf-presets');
  if (presets) {
    presets.querySelectorAll('.cf-preset').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.m, 10) * 60 === t.focusTotal);
    });
  }
}

function createDashboard() {
  const dash = UI.create('div');
  dash.id = APP_ID;

  // Header Component
  const header = UI.create('div', 'cf-header');
  const hLeft = UI.create('div');
  const clock = UI.create('div', 'cf-clock cf-grad-ink'); clock.id = 'cf-clock-val';
  clock.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  hLeft.appendChild(clock);
  const sesLabel = UI.create('div', 'cf-label', 'Session 1');
  sesLabel.id = 'cf-ses-label';
  hLeft.appendChild(sesLabel);
  const liveDot = UI.create('div', 'cf-live'); liveDot.id = 'cf-live-dot';
  header.appendChild(hLeft); header.appendChild(liveDot);

  // Focus Component — arms/disarms the enabled hide rules
  const focusRow = UI.create('div', 'cf-focus-row');
  focusRow.appendChild(UI.create('span', 'cf-focus-text', 'Focus'));
  const tag = UI.create('button', 'cf-tag');
  tag.setAttribute('role', 'switch');
  tag.setAttribute('aria-label', 'Focus Mode');
  const setTag = (on) => {
    tag.classList.toggle('armed', on);
    tag.setAttribute('aria-checked', String(on));
  };
  setTag(config.focusArmed);
  tag.onclick = () => {
    config.focusArmed = !config.focusArmed;
    setTag(config.focusArmed);
    chrome.storage.sync.set({ focusArmed: config.focusArmed });
    applyProductionStyles();
  };
  focusRow.appendChild(tag);

  // Task Component
  const taskWrap = UI.create('div', 'cf-tasks');
  const taskHeader = UI.create('div');
  taskHeader.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';
  taskHeader.appendChild(UI.create('div', 'cf-tasks-title', 'Tasks'));
  const addBtn = UI.create('button', 'cf-add-btn');
  addBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  addBtn.setAttribute('aria-label', 'Add task');
  taskHeader.appendChild(addBtn);

  const addForm = UI.create('div'); addForm.style.display = 'none';
  const addIn = UI.create('input', 'cf-add-in');
  addIn.placeholder = 'Focus on...';
  addIn.setAttribute('aria-label', 'New task');
  addForm.appendChild(addIn);

  const list = UI.create('div'); list.id = 'cf-task-list';
  const render = () => {
    list.innerHTML = '';
    tasks.forEach((t, i) => {
      const id = t.id;
      const item = UI.create('div', `cf-task${t.done ? ' done' : ''}`);
      item.setAttribute('role', 'checkbox');
      item.setAttribute('aria-checked', String(!!t.done));
      item.setAttribute('tabindex', '0');
      item.appendChild(UI.create('span', 'cf-spine'));
      item.appendChild(UI.create('span', 'cf-idx cf-grad-ink', String(i + 1).padStart(2, '0')));
      item.appendChild(UI.create('div', 'cf-tnam', t.name));

      item.onclick = () => {
        const job = tasks.find(x => x.id === id);
        if (!job) return;
        job.done = !job.done;
        Persistence.saveTasks(); render();
        if (job.done) setTimeout(() => {
          const idx = tasks.findIndex(x => x.id === id);
          if (idx > -1 && tasks[idx].done) {
            tasks.splice(idx, 1);
            Persistence.saveTasks(); render();
            Stats.add('tasksDone', 1);
          }
        }, 3000);
      };
      item.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
      };
      list.appendChild(item);
    });
  };
  addBtn.onclick = () => { addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none'; if(addForm.style.display==='block') addIn.focus(); };
  addIn.onkeydown = (e) => { if(e.key==='Enter' && addIn.value.trim()){ tasks.push({id:newId(),name:addIn.value.trim(),done:false}); Persistence.saveTasks(); addIn.value=''; addForm.style.display='none'; render(); } };
  render();
  taskWrap.appendChild(taskHeader); taskWrap.appendChild(addForm); taskWrap.appendChild(list);

  // Timer Component — chronograph tick dial, viewing the service worker's state
  // margin-top:auto pins the timer to the panel's bottom on sticky watch pages.
  const timerWrap = UI.create('div', 'cf-timer-section'); timerWrap.style.marginTop = 'auto';

  const presets = UI.create('div', 'cf-timer-presets');
  presets.id = 'cf-presets';
  [15, 25, 45, 60].forEach(m => {
    const p = UI.create('button', 'cf-preset', `${m}m`);
    p.dataset.m = m;
    p.onclick = () => Timer.send({ cmd: 'timer.preset', minutes: m });
    presets.appendChild(p);
  });

  // Hero countdown: big centered digits over a thin gradient progress bar.
  const ring = UI.create('div', 'cf-timer-ring');
  ring.id = 'cf-timer-ring';
  ring.innerHTML = `
    <div id="cf-timer-val" class="cf-timer-digits cf-grad-ink">25:00</div>
    <div id="cf-timer-label" class="cf-label" style="text-align:center; margin-top:6px;">Focus</div>
    <div class="cf-bar"><div id="cf-timer-fill"></div></div>
  `;

  const startBtn = UI.create('button', 'cf-btn', 'Start');
  startBtn.id = 'cf-timer-btn';
  startBtn.style.display = 'block'; startBtn.style.margin = '18px auto 0';
  startBtn.onclick = () => Timer.send({ cmd: 'timer.toggle' });

  timerWrap.append(ring, presets, startBtn);

  dash.append(header, focusRow, taskWrap, timerWrap);
  renderTimer();
  return dash;
}

// Zen homepage: gradient wordmark + one intentional search box.
function createZen() {
  const zen = UI.create('div');
  zen.id = ZEN_ID;
  zen.appendChild(UI.create('div', 'cf-zen-mark cf-grad-ink', 'ClearFeed'));
  zen.appendChild(UI.create('div', 'cf-zen-label', 'Search with intention'));
  const input = UI.create('input', 'cf-zen-in');
  input.placeholder = 'What did you come here to learn?';
  input.setAttribute('aria-label', 'Search YouTube');
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      location.assign('/results?search_query=' + encodeURIComponent(input.value.trim()));
    }
  };
  zen.appendChild(input);
  return zen;
}

/* ─── 6. Core Engine ─── */
const isLaidOut = (el, minWidth) => !!el && el.getBoundingClientRect().width >= minWidth;

// The side rail only counts when it is actually on screen: #fixed-side-menu
// can exist with zero width outside the new layout, and the rail collapses
// when the viewer dismisses its panels.
function findSideRail() {
  const rail = document.querySelector('#fixed-side-menu') || document.querySelector('.ytSideRailViewModelHost');
  return isLaidOut(rail, 200) ? rail : null;
}

// Classic layout: the right-hand #secondary column. New layout: #secondary if
// YouTube still gives it room, otherwise the top of the side rail.
function findDashHost(rail) {
  const secondary = document.querySelector('ytd-watch-flexy #secondary');
  if (rail && !isLaidOut(secondary, 240)) return { el: rail, mount: 'rail' };
  return secondary ? { el: secondary, mount: 'column' } : null;
}

function syncUI() {
  // Zen overlay (homepage only)
  const zenExisting = document.getElementById(ZEN_ID);
  if (config.zenMode && location.pathname === '/') {
    if (!zenExisting && document.body) document.body.appendChild(createZen());
  } else if (zenExisting) {
    zenExisting.remove();
  }

  // Dashboard (watch pages only)
  if (!window.location.pathname.includes('/watch')) {
    const old = document.getElementById(APP_ID);
    if (old) old.remove();
    return;
  }

  const rail = findSideRail();
  const root = document.documentElement;
  if (root.hasAttribute('data-cf-side-rail') !== !!rail) root.toggleAttribute('data-cf-side-rail', !!rail);

  const host = findDashHost(rail);
  if (!host) return;

  const dash = document.getElementById(APP_ID) || createDashboard();
  if (dash.dataset.mount !== host.mount) dash.dataset.mount = host.mount;
  if (!host.el.contains(dash)) host.el.prepend(dash);
}

async function boot() {
  if (!Persistence.isAlive()) return;
  const data = await chrome.storage.sync.get(Object.keys(SETTING_DEFAULTS));
  for (const k of Object.keys(SETTING_DEFAULTS)) {
    config[k] = data[k] ?? SETTING_DEFAULTS[k];
  }
  await Persistence.loadTasks();

  applyProductionStyles();
  syncUI();
  setTimeout(Stats.countShorts, 2500);
}

// Global Lifecycle
function init() {
  Timer.load().then(renderTimer);
  boot();

  // Surgical Observation — coalesce YouTube's mutation storms into one
  // syncUI per animation frame.
  let syncScheduled = false;
  const observer = new MutationObserver(() => {
    if (!Persistence.isAlive()) return observer.disconnect();
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(() => { syncScheduled = false; syncUI(); });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Navigation, storage, and message listeners
  window.addEventListener('yt-navigate-finish', boot);
  try {
    chrome.runtime.onMessage.addListener(m => { if (m.action === 'updateSettings') boot(); });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'session' && changes[TIMER_KEY]) {
        const old = timerState;
        timerState = changes[TIMER_KEY].newValue;
        const ring = document.getElementById('cf-timer-ring');
        if (timerState?.completed && !(old && old.completed)) {
          ring?.classList.add('cf-done');
          if (document.visibilityState === 'visible') playChime();
        }
        if (timerState?.running && !(old && old.running)) ring?.classList.remove('cf-done');
        renderTimer();
      }
      if (area === 'sync') boot();
    });

    setInterval(() => {
      const c = document.getElementById('cf-clock-val');
      if (c) c.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }, 30000);
    setInterval(renderTimer, 1000);
  } catch {}
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
