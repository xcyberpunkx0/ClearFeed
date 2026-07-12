# ClearFeed Part 2 — Design Spec (v1.1.0)

Approved 2026-07-12. Four features on top of the Aurora Cut redesign (v1.0.6).

## 1. Timer everywhere
- New `background.js` service worker owns timer state in `chrome.storage.session`
  (key `cf-timer-v2`), exposed to content scripts via `setAccessLevel(TRUSTED_AND_UNTRUSTED_CONTEXTS)`.
- One **global timer** (replaces per-tab sessionStorage). Views (dashboard, popup) compute the
  countdown locally from a shared `endsAt` and re-render on `storage.onChanged` — no per-second messaging.
- `chrome.alarms`: `cf-complete` (fires at endsAt), `cf-badge` (30s badge refresh).
- Badge: remaining minutes while running (blue #3ea6ff for focus, gray for break); empty when idle.
- Completion fires a `chrome.notifications` system notification.
- New permissions: `alarms`, `notifications`.

## 2. Pomodoro cycles
- State machine: `phase: focus|break`, `session` counter, `completed` flag.
- Focus completes → session++, button offers `BREAK·5M` (`BREAK·15M` every 4th). Break completes → `BEGIN`.
  Nothing auto-starts.
- Header label shows `DEEP·WORK — SES·NN`. Break dial: gray arc + gray digits (class `cf-break`).
- Focus minutes credited to stats on pause/complete via `recordedSec` bookkeeping (no double counting).

## 3. Zen Mode + granular hiding
- Settings schema (`chrome.storage.sync`): `zenMode` (false), `focusArmed` (true), and prefs
  `hideShorts` (true), `hideSidebar` (true), `hideComments`, `hideHomeFeed`, `hideEndCards`,
  `hideNotifBell` (all false by default).
- Effective rule: `hide_i = zenMode || (focusArmed && pref_i)`. Dashboard FOCUS tag toggles
  `focusArmed` only (no longer overwrites individual prefs).
- Zen homepage: on `/` with zenMode, a fixed overlay (`#cf-zen`) below the masthead — gradient serif
  wordmark + centered pill search box submitting to `/results?search_query=`.
- Popup: ZEN master tag + six granular `[ARMED]/[OFF]` tags.

## 4. Session stats
- `chrome.storage.local` key `cf-stats`: `{ 'YYYY-MM-DD': {focusSec, sessions, tasksDone, shortsHidden} }`,
  UTC day keys, pruned to 60 days. All writes serialized through the service worker
  (`{cmd:'stats.add'}`) to avoid multi-tab races.
- Sources: focusSec + sessions from the SW timer; tasksDone from the dashboard (on the 3s auto-remove);
  shortsHidden counted once per navigation (matching hidden-Shorts selectors, 2.5s after boot).
- Popup "THIS WEEK": 7 gradient bar columns (by focusSec) + totals line
  (`Xh Ym focused · N sessions · N tasks · N shorts dodged`).

## Files
- `background.js` (new), `content.js`, `popup.html`, `popup.js`, `manifest.json` (v1.1.0,
  `background.service_worker`, permissions `storage, alarms, notifications`).
