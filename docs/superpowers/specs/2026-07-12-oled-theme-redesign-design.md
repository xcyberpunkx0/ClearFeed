# ClearFeed OLED Theme Redesign — Design Spec

Date: 2026-07-12
Validated with user via visual companion (font, theme, and layout mockups).

## Decisions (user-selected)

- **UI font:** Sora (Google Fonts, bundled woff2) for all UI text in dashboard, popup, and Zen page.
- **Display font:** Doto (dot-matrix, bundled woff2) for the header clock, timer countdown digits, and task index numbers. Smooch Sans is retired.
- **Dark surfaces:** OLED true black `#000000` panel background, `#111111` task cards, `#161616` chips, hairlines `rgba(255,255,255,0.14)`. Light mode: white panel, `#f5f5f5` cards.
- **Theme presets (user picks in popup, default Aurora):**
  - Aurora `#3ea6ff → #a78bfa`
  - Sunset `#ff6b6b → #ffa94d`
  - Mint `#34d399 → #22d3ee`
  - Rose `#ec4899 → #8b5cf6`
  - Gold `#fbbf24 → #f59e0b`
  - Ember `#f43f5e → #fb923c`
  The gradient tints: clock, timer dial + digits, toggles (on state), active preset chip, Start button, task spines/checks, popup switches and stat bars.
- **Timer layout ("Indexed cards" C):** compact gradient dial (~76px) left of large Doto digits; phase label ("Focus · Session 2") under digits; preset chips left-aligned below.
- **Tasks:** each task is a card (`#111`, radius 10) with a 3px vertical gradient spine, a Doto gradient index (01, 02…), task text; completed = strikethrough + dimmed (from layout B).
- **Toggles:** pill track, gradient when on, knob vertically centered via `top:50%; translateY(-50%)` (was misaligned).

## Implementation notes

- Theme stored in `chrome.storage.sync` key `theme` (string, default `aurora`); content script regenerates injected CSS on sync change (existing `boot()` listener covers this).
- Gradient colors emitted into CSS custom props `--grad-a`/`--grad-b`; SVG dial uses `<stop style="stop-color:var(--grad-a)">`.
- Fonts served via `web_accessible_resources` for the content script; popup loads them by relative URL.
- Popup gets a swatch-row theme picker; applies the same vars live.
- manifest: remove `fonts/smooch-sans.woff2`, add `fonts/sora.woff2`, `fonts/doto.woff2`.
