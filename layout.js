/**
 * ClearFeed - layout.js (v1.1.1)
 * Runs in YouTube's own JavaScript world at document_start, before any YouTube
 * script. When "Classic layout" is on, it pins the experiment flags behind
 * YouTube's October 2026 watch page (comments/description in a right-hand side
 * rail, related videos in a grid under the player) to false, so YouTube renders
 * its classic watch page and the ClearFeed dashboard keeps its column.
 *
 * chrome.storage isn't reachable from this world and arrives too late anyway,
 * so content.js mirrors the setting into localStorage ('cf-classic-layout').
 * A change takes effect on the next page load.
 *
 * Flag list from the community uBlock Origin filter and Control Panel for
 * YouTube. If YouTube renames a flag, add the new name here.
 */
(() => {
  'use strict';

  try {
    if (localStorage.getItem('cf-classic-layout') === '0') return;
  } catch {}

  const FLAGS = {
    disable_theater_mode: false,
    enable_web_side_rail: false,
    kevlar_watch_cinematics: false,
    kevlar_watch_hide_comments_while_panel_open: false,
    web_engagement_panel_show_description: false,
    web_fixed_panel_watch_next_grid_swap: false,
    web_live_chat_panel_watch_next_grid_swap: false,
    web_side_rail_dismissible_panels: false,
    web_watch_eligible_to_switch_to_grid: false,
    web_watch_enable_single_column_grid_view: false,
    web_watch_fixed_default_panels: false,
    web_watch_hero_list: false,
    web_watch_move_summary_to_sd: false,
    web_watch_split_scroll: false
  };

  // Keep each flag at its value even when ytcfg.set() merges into the object again.
  const pin = (flags) => {
    for (const [name, value] of Object.entries(FLAGS)) {
      try {
        Object.defineProperty(flags, name, { get: () => value, set: () => {}, configurable: true, enumerable: true });
      } catch {
        try { flags[name] = value; } catch {}
      }
    }
  };

  // Hand owner[prop] to onObject now and on every later assignment, so the
  // chain re-arms when YouTube replaces an object along it.
  const trap = (owner, prop, onObject) => {
    let current = owner[prop];
    if (current && typeof current === 'object') onObject(current);
    try {
      Object.defineProperty(owner, prop, {
        get: () => current,
        set: (v) => { current = v; if (v && typeof v === 'object') onObject(v); },
        configurable: true,
        enumerable: true
      });
    } catch {}
  };

  trap(window, 'yt', (yt) => trap(yt, 'config_', (cfg) => trap(cfg, 'EXPERIMENT_FLAGS', pin)));
  trap(window, 'ytcfg', (ytcfg) => trap(ytcfg, 'data_', (data) => trap(data, 'EXPERIMENT_FLAGS', pin)));
})();
