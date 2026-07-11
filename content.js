/**
 * ClearFeed - content.js (v1.1.0)
 * "Aurora Cut" Identity — Negative Cut × Chronograph
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
const FONT_STACK = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const MONO_STACK = `ui-monospace, "Cascadia Mono", "SF Mono", Consolas, monospace`;
const SERIF_STACK = `Georgia, "Times New Roman", serif`;

const SETTING_DEFAULTS = {
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
      'ytd-rich-item-renderer:has(a[href*="/shorts/"]), ytd-video-renderer:has(a[href*="/shorts/"]), ytm-shorts-lockup-view-model, ytd-reel-shelf-renderer'
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
    css += `
      ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts],
      ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2,
      .shortsLockupViewModelHostOutsideMetadata, ytd-reel-item-renderer, [is-shorts],
      ytd-guide-entry-renderer:has(a[href*="/shorts"]),
      ytd-mini-guide-entry-renderer[aria-label*="Shorts"],
      ytd-video-renderer:has(a[href*="/shorts/"]),
      #shorts-container, ytd-rich-item-renderer:has(a[href*="/shorts/"]),
      span[title="Shorts"], a[title="Shorts"] { display: none !important; }
    `;
  }

  if (effective('hideSidebar') && window.location.pathname.includes('/watch')) {
    css += `
      #secondary #related, ytd-watch-next-secondary-results-renderer,
      ytd-playlist-panel-renderer, ytd-engagement-panel-section-list-renderer, ytd-live-chat-frame {
        visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;
        height: 1px !important; overflow: hidden !important; display: block !important;
      }
      #secondary.ytd-watch-flexy { display: block !important; visibility: visible !important; }
      #cf-dash { position: sticky; top: 72px; height: calc(100vh - 96px); }
    `;
  } else {
    css += `
      #cf-dash { position: relative; top: 0; height: auto; margin-bottom: 24px; }
      #cf-dash .cf-timer-section { margin-top: 24px; }
    `;
  }

  if (effective('hideComments')) {
    css += `ytd-comments#comments { display: none !important; }\n`;
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

  // Aurora Cut Theme & Layout
  css += `
    #cf-dash, #cf-zen {
      --bg: #faf8f3;
      --tx: #0a0a0a; --tx2: #55524a; --tx3: #6e6a5f;
      --hair: rgba(10,10,10,0.12); --hair-strong: rgba(10,10,10,0.3);
      --grad-a: #3ea6ff; --grad-b: #a78bfa;
      --grad: linear-gradient(135deg, #3ea6ff, #a78bfa);
      --shadow: rgba(30, 25, 15, 0.12);
    }
    html[dark] #cf-dash, html[dark] #cf-zen {
      --bg: #0a0a0a;
      --tx: #f4f2ed; --tx2: #b5b1a8; --tx3: #8a877f;
      --hair: rgba(244,242,237,0.12); --hair-strong: rgba(244,242,237,0.25);
      --shadow: rgba(0, 0, 0, 0.35);
    }
    #cf-dash {
      display: flex; flex-direction: column; font-family: ${FONT_STACK};
      color: var(--tx); background: var(--bg);
      border: 1px solid var(--hair); border-radius: 16px;
      box-shadow: 0 8px 28px var(--shadow);
      padding: 24px; margin-right: 12px; overflow-y: auto; scrollbar-width: none;
    }
    #cf-dash::-webkit-scrollbar { display: none; }
    #cf-dash :is(button, [tabindex], input):focus-visible, #cf-zen input:focus-visible { outline: 2px solid var(--grad-a); outline-offset: 3px; }

    .cf-grad-ink {
      background: var(--grad);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cf-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 4px 0 18px; border-bottom: 1px solid var(--hair-strong);
    }
    .cf-clock {
      font-family: ${SERIF_STACK};
      font-size: 36px; font-weight: 400; letter-spacing: -0.5px; line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .cf-label {
      font-family: ${MONO_STACK}; font-size: 10px; font-weight: 500;
      color: var(--tx3); letter-spacing: 2.5px; text-transform: uppercase; margin-top: 8px;
    }
    .cf-live {
      width: 8px; height: 8px; border-radius: 50%; background: var(--grad);
      margin-top: 10px; opacity: 0.45; flex-shrink: 0;
    }
    .cf-live.on { opacity: 1; animation: cfGlow 2.4s ease-in-out infinite; }
    @keyframes cfGlow {
      0%, 100% { box-shadow: 0 0 4px rgba(122, 150, 255, 0.5); }
      50% { box-shadow: 0 0 12px rgba(122, 150, 255, 0.95); }
    }

    .cf-focus-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 0; border-bottom: 1px solid var(--hair);
    }
    .cf-focus-text {
      font-size: 13px; font-weight: 600; letter-spacing: 1.5px;
      text-transform: uppercase; color: var(--tx);
    }
    .cf-tag {
      font-family: ${MONO_STACK}; font-size: 13px; font-weight: 600; letter-spacing: 1px;
      background: none; border: none; cursor: pointer; padding: 4px 0;
    }
    .cf-tag.armed {
      background: var(--grad);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .cf-tag.off { color: var(--tx3); }

    .cf-tasks { padding: 16px 0 6px; border-bottom: 1px solid var(--hair); }
    .cf-tasks-title {
      font-family: ${MONO_STACK}; font-size: 10px; font-weight: 500;
      color: var(--tx3); letter-spacing: 2.5px; text-transform: uppercase;
    }
    .cf-add-btn {
      background: none; border: 1px solid var(--hair-strong); border-radius: 50%;
      width: 26px; height: 26px; color: var(--tx3); cursor: pointer;
      font-family: inherit; font-size: 17px; line-height: 1; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .cf-add-in {
      width: 100%; padding: 10px 16px; background: transparent;
      border: 1px solid var(--hair-strong); border-radius: 999px;
      color: var(--tx); margin: 12px 0 4px; font-family: ${FONT_STACK}; font-size: 14px;
      box-sizing: border-box; outline: none;
    }
    .cf-add-in::placeholder { color: var(--tx3); }
    .cf-task {
      padding: 9px 0; cursor: pointer; animation: cfIn 0.3s ease-out;
      font-family: ${SERIF_STACK};
    }
    @keyframes cfIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
    .cf-tnam { font-size: 16px; color: var(--tx); }
    .cf-tnam::before { content: '\\2014\\00a0\\00a0'; color: var(--tx3); }
    .cf-task.done .cf-tnam { text-decoration: line-through; color: var(--tx3); }

    .cf-timer-presets { display: flex; gap: 6px; margin-bottom: 16px; justify-content: center; }
    .cf-preset {
      font-family: ${MONO_STACK}; font-size: 12px; font-weight: 500;
      padding: 6px 15px; border-radius: 999px; background: transparent;
      border: 1px solid var(--hair); color: var(--tx3); cursor: pointer; transition: 0.2s;
    }
    .cf-preset:hover { border-color: var(--hair-strong); color: var(--tx2); }
    .cf-preset.active {
      border-color: var(--hair-strong);
      background: var(--grad);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cf-timer-ring { width: 140px; height: 140px; position: relative; margin: 20px auto; }
    .cf-timer-ring.cf-done { animation: cfPulse 1.6s ease-in-out 2; }
    @keyframes cfPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
    .cf-timer-digits {
      font-family: ${MONO_STACK}; font-size: 28px; font-weight: 700;
      letter-spacing: -0.5px; font-variant-numeric: tabular-nums;
    }
    .cf-timer-ring.cf-break #cf-timer-fill { stroke: var(--tx3); }
    .cf-timer-ring.cf-break .cf-timer-digits {
      background: none; -webkit-text-fill-color: var(--tx2); color: var(--tx2);
    }
    .cf-btn {
      font-family: ${MONO_STACK}; font-size: 13px; font-weight: 700; letter-spacing: 2px;
      padding: 11px 36px; border-radius: 999px;
      background: var(--grad); color: #0a0a0a;
      border: none; cursor: pointer;
      box-shadow: 0 2px 14px rgba(122, 150, 255, 0.35);
    }

    /* Zen homepage takeover */
    #cf-zen {
      position: fixed; top: 56px; left: 0; right: 0; bottom: 0; z-index: 600;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 18px; background: #fff; font-family: ${FONT_STACK};
    }
    html[dark] #cf-zen { background: #0f0f0f; }
    .cf-zen-mark {
      font-family: ${SERIF_STACK}; font-style: italic; font-size: 44px; letter-spacing: -1px;
    }
    .cf-zen-label {
      font-family: ${MONO_STACK}; font-size: 11px; letter-spacing: 3px;
      text-transform: uppercase; color: var(--tx3);
    }
    .cf-zen-in {
      width: min(480px, 80vw); padding: 14px 24px; background: transparent;
      border: 1px solid var(--hair-strong); border-radius: 999px;
      color: var(--tx); font-family: ${FONT_STACK}; font-size: 16px;
      box-sizing: border-box; outline: none; text-align: center;
    }
    .cf-zen-in::placeholder { color: var(--tx3); }

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
  if (f) f.style.strokeDashoffset = 351.8 * (1 - (t.total - rem) / (t.total || 1));

  const ring = document.getElementById('cf-timer-ring');
  if (ring) ring.classList.toggle('cf-break', t.phase === 'break');

  const label = document.getElementById('cf-timer-label');
  if (label) {
    label.textContent = t.phase === 'break'
      ? (t.completed ? 'Break Over' : 'Break')
      : (t.completed ? 'Session Complete' : 'T-Minus');
  }

  const btn = document.getElementById('cf-timer-btn');
  if (btn) {
    btn.textContent = t.running ? 'PAUSE'
      : t.completed ? (t.phase === 'focus' ? (t.session % 4 === 0 ? 'BREAK·15M' : 'BREAK·5M') : 'BEGIN')
      : rem > 0 && rem < t.total ? 'RESUME'
      : t.phase === 'break' ? 'BREAK' : 'BEGIN';
  }

  const ses = document.getElementById('cf-ses-label');
  if (ses) ses.textContent = `Deep·Work — Ses·${String(t.session + 1).padStart(2, '0')}`;

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
  const sesLabel = UI.create('div', 'cf-label', 'Deep·Work — Ses·01');
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
    tag.textContent = on ? '[ARMED]' : '[OFF]';
    tag.classList.toggle('armed', on);
    tag.classList.toggle('off', !on);
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
  const addBtn = UI.create('button', 'cf-add-btn', '+');
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
    tasks.forEach((t) => {
      const id = t.id;
      const item = UI.create('div', `cf-task${t.done ? ' done' : ''}`);
      item.setAttribute('role', 'checkbox');
      item.setAttribute('aria-checked', String(!!t.done));
      item.setAttribute('tabindex', '0');
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
  const timerWrap = UI.create('div', 'cf-timer-section'); timerWrap.style.marginTop = 'auto';

  const presets = UI.create('div', 'cf-timer-presets');
  presets.id = 'cf-presets';
  [15, 25, 45, 60].forEach(m => {
    const p = UI.create('button', 'cf-preset', `${m}m`);
    p.dataset.m = m;
    p.onclick = () => Timer.send({ cmd: 'timer.preset', minutes: m });
    presets.appendChild(p);
  });

  const ring = UI.create('div', 'cf-timer-ring');
  ring.id = 'cf-timer-ring';
  // Track: 30 tick marks (dasharray 2 + 9.727 divides the 351.8 circumference evenly).
  ring.innerHTML = `
    <svg viewBox="0 0 130 130" style="width:140px; height:140px; transform:rotate(-90deg)">
      <circle cx="65" cy="65" r="56" fill="none" stroke="var(--hair-strong)" stroke-width="4" stroke-dasharray="2 9.727" />
      <circle id="cf-timer-fill" cx="65" cy="65" r="56" fill="none" stroke="url(#cf-timer-grad)" stroke-width="4" stroke-linecap="round" stroke-dasharray="351.8" stroke-dashoffset="351.8" style="transition: stroke-dashoffset 0.5s ease" />
      <defs><linearGradient id="cf-timer-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="var(--grad-a)"/><stop offset="100%" stop-color="var(--grad-b)"/></linearGradient></defs>
    </svg>
    <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center">
      <div id="cf-timer-val" class="cf-timer-digits cf-grad-ink">25:00</div>
      <div id="cf-timer-label" class="cf-label" style="margin-top:4px;">T-Minus</div>
    </div>
  `;

  const startBtn = UI.create('button', 'cf-btn', 'BEGIN');
  startBtn.id = 'cf-timer-btn';
  startBtn.style.display = 'block'; startBtn.style.margin = '20px auto 0';
  startBtn.onclick = () => Timer.send({ cmd: 'timer.toggle' });

  timerWrap.append(presets, ring, startBtn);

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

  const host = document.querySelector('ytd-watch-flexy #secondary');
  if (!host) return;

  const existing = document.getElementById(APP_ID);
  if (existing) {
    if (!host.contains(existing)) host.prepend(existing);
  } else {
    host.prepend(createDashboard());
  }
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
