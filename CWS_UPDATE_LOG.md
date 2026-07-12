# Chrome Web Store — Update Log

Paste the section below at the end of the Detailed Description on the Chrome Web Store listing (CWS has no separate changelog field).

---

**What's New**

v1.1.0
* All-new look: OLED-black dashboard with a dot-matrix clock and refreshed typography.
* Theme colors: pick from six gradient themes (Aurora, Sunset, Mint, Rose, Gold, Ember) in the popup — the clock, timer, toggles, and buttons all follow.
* Numbered task cards with clearer completed states.
* Pomodoro timer now runs in a background service worker — it keeps counting across tabs, page reloads, and navigation.
* Focus/break cycles: breaks start automatically after each focus session, with a long break every 4th session.
* Toolbar badge shows the minutes remaining in the current session.
* Desktop notification when a focus session or break ends (new "notifications" permission).
* Daily focus stats: focus time, completed sessions, tasks done, and Shorts hidden.

v1.0.4
* Distraction removal now also hides playlists and live chat.
* Refined dashboard positioning on video pages.

---

### Permission justifications (Privacy tab)

* **storage** — saves user preferences, tasks, and daily focus stats locally.
* **alarms** — drives the Pomodoro timer in the background service worker.
* **notifications** — alerts the user when a focus session or break ends.
