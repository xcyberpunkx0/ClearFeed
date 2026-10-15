# Chrome Web Store — Update Log

Paste the section below at the end of the Detailed Description on the Chrome Web Store listing (CWS has no separate changelog field).

---

**What's New**

v1.1.1
* New "Classic layout" option (on by default): switches YouTube's new watch page back to the classic one, with comments under the video and room on the right for the focus dashboard. Turn it off in the popup to keep YouTube's new layout.
* With YouTube's new layout, the dashboard sits under the video title, where the recommendations used to be. YouTube's side panel (description, comments, Ask) is left untouched.
* Description, comments, Ask, transcript and other YouTube panels are no longer hidden by "Related videos"; opened panels appear above the dashboard.
* "Related videos" now also hides the recommendation grid below the video. "Comments" now also hides comments in the new side panel.
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
