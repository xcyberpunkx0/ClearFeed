/**
 * ClearFeed - content.js (v1.0.4)
 * Production-Ready "Negative Cut" Identity
 * 
 * ARCHITECTURE:
 * 1. State: Persistent memory for Timer & Tasks.
 * 2. Styles: High-performance CSS-only distraction removal.
 * 3. Components: Modular UI construction for the Dashboard.
 * 4. Engine: MutationObserver-based surgical injection.
 */

/* ─── 1. Constants & Configuration ─── */
const APP_ID = 'cf-dash';
const STYLES_ID = 'cf-styles';
const STORAGE_KEYS = ['hideShorts', 'hideSidebar'];

let config = { hideShorts: true, hideSidebar: true };

const ICONS = {
  eyeOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>`,
  eye: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  logo: `<img src="${chrome.runtime.getURL('icons/png/image.png')}" width="28" height="28" style="display:block;" />`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};

/* ─── 2. State Management ─── */
let timer = { active: false, remaining: 1500, total: 1500, interval: null };

const Persistence = {
  getTasks: () => JSON.parse(localStorage.getItem('cf-tasks') || '[]'),
  setTasks: (t) => localStorage.setItem('cf-tasks', JSON.stringify(t)),
  isAlive: () => { try { return !!chrome.runtime.id; } catch { return false; } }
};

/* ─── 3. Utility Methods ─── */
const UI = {
  create: (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  },
  injectIcon: (parent, svg) => {
    const span = UI.create('span');
    const t = document.createElement('template');
    t.innerHTML = svg.trim();
    span.appendChild(t.content.firstChild);
    parent.appendChild(span);
    return span;
  }
};

/* ─── 4. Global Styles ─── */
function applyProductionStyles() {
  if (!Persistence.isAlive()) return;
  let el = document.getElementById(STYLES_ID);
  if (!el) {
    el = UI.create('style');
    el.id = STYLES_ID;
    (document.head || document.documentElement).appendChild(el);
  }

  let css = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');\n`;

  // Global Distraction Removal (Hiding Shorts)
  if (config.hideShorts) {
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

  // Sidebar Hiding (Watch Page Only - Gentle Placeholder Strategy)
  if (config.hideSidebar && window.location.pathname.includes('/watch')) {
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

  // Dashboard Theme & Layout
  css += `
    #cf-dash {
      --bg: rgba(255, 255, 255, 0.4); --bg2: rgba(245, 245, 245, 0.6); --bg3: rgba(235, 235, 235, 0.8);
      --tx: #0f0f0f; --tx2: #606060; --tx3: #909090;
      --bd: rgba(0,0,0,0.08); --accent: #065fd4;
      --grad-a: #065fd4; --grad-b: #7c3aed;
    }
    html[dark] #cf-dash {
      --bg: rgba(15, 15, 15, 0.4); --bg2: rgba(26, 26, 26, 0.6); --bg3: rgba(39, 39, 39, 0.8);
      --tx: #f1f1f1; --tx2: #aaa; --tx3: #717171;
      --bd: rgba(255,255,255,0.08); --accent: #3ea6ff;
      --grad-a: #3ea6ff; --grad-b: #a78bfa;
    }
    #cf-dash {
      display: flex; flex-direction: column; font-family: 'Inter', sans-serif;
      color: var(--tx); background: var(--bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border-radius: 20px; padding: 24px; margin-right: 12px; overflow-y: auto; scrollbar-width: none;
    }
    #cf-dash::-webkit-scrollbar { display: none; }
    
    .cf-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 4px 0 20px; }
    .cf-clock { font-size: 2rem; font-weight: 600; letter-spacing: -0.5px; line-height: 1; background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .cf-label { font-size: 10px; font-weight: 600; color: var(--tx3); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 4px; }
    
    .cf-card { background: var(--bg2); border-radius: 12px; padding: 14px 16px; margin-bottom: 24px; }
    .cf-row { display: flex; align-items: center; justify-content: space-between; }
    
    .cf-toggle { position: relative; width: 44px; height: 24px; background: var(--bg3); border-radius: 12px; cursor: pointer; border: none; padding: 0; }
    .cf-toggle.active { background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); }
    .cf-toggle-kb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
    .cf-toggle.active .cf-toggle-kb { transform: translateX(20px); }

    .cf-timer-presets { display: flex; gap: 6px; margin-bottom: 16px; justify-content: center; }
    .cf-preset { 
      padding: 5px 12px; border-radius: 16px; background: var(--bg2); border: 1px solid var(--bd);
      color: var(--tx2); font-size: 12px; font-weight: 500; cursor: pointer; transition: 0.2s;
    }
    .cf-preset:hover, .cf-preset.active { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }

    .cf-focus-text { font-size: 16px; font-weight: 600; color: var(--tx); letter-spacing: -0.2px; }
    .cf-tasks-title { font-size: 11px; font-weight: 600; color: var(--tx3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px; }
    .cf-task { display: flex; align-items: flex-start; gap: 14px; padding: 12px 0; cursor: pointer; animation: cfIn 0.3s ease-out; }
    @keyframes cfIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
    
    .cf-chk { width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--bd); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: transparent; transition: 0.2s; margin-top: 2px; }
    .cf-chk.done { background: var(--accent); border-color: var(--accent); color: #fff; }
    
    .cf-tcol { display: flex; flex-direction: column; gap: 2px; }
    .cf-tnam { font-size: 15px; font-weight: 500; color: var(--tx); }
    .cf-tsub { font-size: 12px; color: var(--tx3); }
    .cf-task.done .cf-tnam { text-decoration: line-through; opacity: 0.6; }
    .cf-task.done .cf-tsub { opacity: 0.6; }
    .cf-task.fade { opacity:0; height:0; padding:0; overflow:hidden; transition: 0.4s; }
    
    .cf-clock { font-size: 2rem; font-weight: 700; background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -1px; margin-bottom: 4px; }
    .cf-label { font-size: 10px; font-weight: 600; color: var(--tx3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
    
    .cf-timer-ring { width: 140px; height: 140px; position: relative; margin: 20px auto; filter: drop-shadow(0 0 8px var(--accent-bg)); }
    .cf-timer-digits { font-size: 1.83rem; font-weight: 700; background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -1px; }
    .cf-logo { width: 34px; height: 34px; border-radius: 50%; background: var(--bg3); display: flex; align-items: center; justify-content: center; border: 1px solid var(--bd); }
    .cf-btn { padding: 8px 28px; border-radius: 20px; background: var(--accent); color: #fff; font-size: 13px; font-weight: 600; border: none; cursor: pointer; }
  `;
  el.textContent = css;
}

/* ─── 5. UI Components ─── */
function createDashboard() {
  const dash = UI.create('div');
  dash.id = APP_ID;

  // Header Component
  const header = UI.create('div', 'cf-header');
  const hLeft = UI.create('div');
  const clock = UI.create('div', 'cf-clock'); clock.id = 'cf-clock-val';
  clock.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  hLeft.appendChild(clock);
  hLeft.appendChild(UI.create('div', 'cf-label', 'Deep Work Session'));
  const logo = UI.create('div', 'cf-logo');
  UI.injectIcon(logo, ICONS.logo);
  header.appendChild(hLeft); header.appendChild(logo);

  // Focus Component
  const focusCard = UI.create('div', 'cf-card cf-row');
  const fLabel = UI.create('div', 'cf-row');
  fLabel.style.gap = '12px';
  const fIcon = UI.create('span'); fIcon.style.display = 'flex';
  const isFocused = config.hideShorts !== false || config.hideSidebar !== false;
  UI.injectIcon(fIcon, isFocused ? ICONS.eyeOff : ICONS.eye);
  fLabel.appendChild(fIcon);
  fLabel.appendChild(UI.create('span', 'cf-focus-text', 'Focus Mode'));
  const toggle = UI.create('button', `cf-toggle${isFocused ? ' active' : ''}`);
  toggle.appendChild(UI.create('div', 'cf-toggle-kb'));
  toggle.onclick = () => {
    const act = toggle.classList.toggle('active');
    fIcon.innerHTML = '';
    UI.injectIcon(fIcon, act ? ICONS.eyeOff : ICONS.eye);
    
    // Core Fix: Actually apply state to CSS Engine
    config.hideShorts = act;
    config.hideSidebar = act;
    chrome.storage.sync.set({ hideShorts: act, hideSidebar: act });
    applyProductionStyles(); 
  };
  focusCard.appendChild(fLabel); focusCard.appendChild(toggle);

  // Task Component
  const taskWrap = UI.create('div');
  const taskHeader = UI.create('div', 'cf-row');
  taskHeader.appendChild(UI.create('div', 'cf-tasks-title', 'Tasks'));
  const addBtn = UI.create('button', '', '+');
  addBtn.style.cssText = 'background:none; border:1px solid var(--bd); border-radius:50%; width:24px; height:24px; color:var(--tx3); cursor:pointer;';
  taskHeader.appendChild(addBtn);
  
  const addForm = UI.create('div'); addForm.style.display = 'none';
  const addIn = UI.create('input'); addIn.placeholder = 'Focus on...';
  addIn.style.cssText = 'width:100%; padding:10px; background:var(--bg2); border:1px solid var(--bd); border-radius:8px; color:var(--tx); margin-bottom:12px; font-family:Inter; box-sizing:border-box;';
  addForm.appendChild(addIn);

  const list = UI.create('div'); list.id = 'cf-task-list';
  const render = () => {
    list.innerHTML = '';
    const tasks = Persistence.getTasks();
    tasks.forEach((t, i) => {
      const item = UI.create('div', `cf-task${t.done ? ' done' : ''}`);
      
      const chk = UI.create('div', `cf-chk${t.done ? ' done' : ''}`);
      UI.injectIcon(chk, ICONS.check);
      
      const tcol = UI.create('div', 'cf-tcol');
      tcol.appendChild(UI.create('div', 'cf-tnam', t.name));
      const sub = t.sub || 'Focus • Active';
      tcol.appendChild(UI.create('div', 'cf-tsub', t.done ? 'Completed' : sub));
      
      item.append(chk, tcol);
      item.onclick = () => {
        const jobs = Persistence.getTasks(); jobs[i].done = !jobs[i].done;
        Persistence.setTasks(jobs); render();
        if (jobs[i].done) setTimeout(() => {
          const fresh = Persistence.getTasks(); if(fresh[i]) { fresh.splice(i, 1); Persistence.setTasks(fresh); render(); }
        }, 3000);
      };
      list.appendChild(item);
    });
  };
  addBtn.onclick = () => { addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none'; if(addForm.style.display==='block') addIn.focus(); };
  addIn.onkeydown = (e) => { if(e.key==='Enter' && addIn.value.trim()){ const t=Persistence.getTasks(); t.push({name:addIn.value.trim(),done:false}); Persistence.setTasks(t); addIn.value=''; addForm.style.display='none'; render(); } };
  render();
  taskWrap.appendChild(taskHeader); taskWrap.appendChild(addForm); taskWrap.appendChild(list);

  // Timer Component (Restored Presets)
  const timerWrap = UI.create('div', 'cf-timer-section'); timerWrap.style.marginTop = 'auto';
  
  const presets = UI.create('div', 'cf-timer-presets');
  [15, 25, 45, 60].forEach(m => {
    const p = UI.create('button', `cf-preset ${m === 25 ? 'active' : ''}`, `${m}m`);
    p.onclick = () => {
      if (timer.active) return;
      timer.total = m * 60; timer.remaining = m * 60;
      presets.querySelectorAll('.cf-preset').forEach(b => b.classList.remove('active'));
      p.classList.add('active');
      tick();
    };
    presets.appendChild(p);
  });
  
  const ring = UI.create('div', 'cf-timer-ring');
  ring.innerHTML = `
    <svg viewBox="0 0 130 130" style="width:140px; height:140px; transform:rotate(-90deg)">
      <circle cx="65" cy="65" r="56" fill="none" stroke="var(--ring-track)" stroke-width="3" />
      <circle id="cf-timer-fill" cx="65" cy="65" r="56" fill="none" stroke="url(#cf-timer-grad)" stroke-width="4" stroke-linecap="round" stroke-dasharray="351.8" stroke-dashoffset="0" style="transition: stroke-dashoffset 0.5s ease" />
      <defs><linearGradient id="cf-timer-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="var(--grad-a)"/><stop offset="100%" stop-color="var(--grad-b)"/></linearGradient></defs>
    </svg>
    <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center">
      <div id="cf-timer-val" class="cf-timer-digits">25:00</div>
      <div class="cf-label">Remaining</div>
    </div>
  `;
  const startBtn = UI.create('button', 'cf-btn', 'Start');
  startBtn.style.display = 'block'; startBtn.style.margin = '20px auto 0';
  
  timerWrap.append(presets, ring, startBtn);
  
  const tick = () => {
    const m = Math.floor(timer.remaining / 60), s = timer.remaining % 60;
    const v = document.getElementById('cf-timer-val'), f = document.getElementById('cf-timer-fill');
    if (v) v.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (f) f.style.strokeDashoffset = 351.8 * (1 - (timer.total - timer.remaining) / timer.total);
    startBtn.textContent = timer.active ? 'Pause' : 'Start';
  };
  startBtn.onclick = () => {
    if (timer.active) { clearInterval(timer.interval); timer.active = false; }
    else { timer.active = true; timer.interval = setInterval(() => { if (timer.remaining > 0) { timer.remaining--; tick(); } else { clearInterval(timer.interval); alert('Time up!'); } }, 1000); }
    tick();
  };

  dash.append(header, focusCard, taskWrap, timerWrap);
  return dash;
}

/* ─── 6. Core Engine ─── */
function syncUI() {
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
  const data = await chrome.storage.sync.get(STORAGE_KEYS);
  config.hideShorts = data.hideShorts !== false;
  config.hideSidebar = data.hideSidebar !== false;
  
  applyProductionStyles();
  syncUI();
}

// Global Lifecycle
function init() {
  boot();
  
  // Surgical Observation
  const observer = new MutationObserver(() => {
    if (!Persistence.isAlive()) return observer.disconnect();
    syncUI();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Navigation & Message Listeners
  window.addEventListener('yt-navigate-finish', boot);
  try {
    chrome.runtime.onMessage.addListener(m => { if (m.action === 'updateSettings') boot(); });
    setInterval(() => {
      const c = document.getElementById('cf-clock-val');
      if (c) c.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }, 30000);
  } catch {}
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
