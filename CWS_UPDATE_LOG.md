# Chrome Web Store — Update Log

Paste the section below at the end of the Detailed Description on the Chrome Web Store listing (CWS has no separate changelog field).

---

**What's New**

v1.1.1
* Redesigned popup: weekly focus at a glance, watch-page modes in one place, and one-tap chips for everything ClearFeed hides.
* New "Classic layout" option (on by default): switches YouTube's new watch page back to the classic one, with comments under the video and room on the right for the focus dashboard.
* Works with YouTube's new watch layout too: the dashboard sits as a compact card above YouTube's side panel (comments, description, Ask), and moves under the video title when you close the panel.
* Description, comments, Ask, transcript and other YouTube panels are no longer hidden by "Recommended"; opened panels appear above the dashboard.
* "Recommended" now also hides the recommendation grid below the video. "Comments" now also hides comments in the new side panel.
* Shorts hiding covers the newer Shorts shelves and Shorts in the recommendation grid.

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
