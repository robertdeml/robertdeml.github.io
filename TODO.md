# Mobile & Power-Aware TODO

## Mobile UI

- [ ] **Safe area insets** — Add `env(safe-area-inset-top)`, `env(safe-area-inset-right)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)` padding to fixed elements so notch/punch-hole phones don't clip the menu button and toolbar.
- [ ] **Bottom-sheet toolbar** — Move the buttons-panel from top-right to a bottom-anchored bar or drawer for one-handed thumb reach.
- [ ] **Prevent pull-to-refresh / overscroll** — Set `overscroll-behavior: none` on body so panning the map doesn't trigger browser refresh.
- [ ] **Remove tap highlight** — Set `-webkit-tap-highlight-color: transparent` to eliminate the grey flash on tap.
- [ ] **Double-tap zoom prevention** — Set `touch-action: manipulation` on the map container so quick taps register as clicks (pin placement) rather than zooming the page.
- [ ] **Fullscreen on GPS start** — Call `document.documentElement.requestFullscreen()` when the user enables GPS to maximize map real estate.
- [ ] **Thumb-friendly pin toolbar** — Increase NSEW 1m adjustment buttons from 24×24px to at least 44×44px (minimum touch target).

## Power Awareness

- [ ] **Adaptive GPS accuracy** — Switch from `enableHighAccuracy: true` to `false` when the user hasn't moved >10m in 60s, then re-enable on movement. Uses less battery when stationary.
- [ ] **Throttle GPS reads** — Enforce a minimum interval (e.g., 5s) between watchPosition callbacks to prevent rapid-fire CPU wakes.
- [ ] **Pause GPS when backgrounded** — Listen for `visibilitychange` / `pagehide`; stop GPS and release wake lock when the user switches apps or locks the screen. Resume on `visibilitychange: visible`.
- [ ] **Debounce rendering** — Debounce elevation chart and path polyline redraws. Avoid layout thrashing during pinch-zoom.
- [ ] **OLED dark mode** — The background is already dark, but dialogs are white. Consider a dark theme for dialogs or respect `prefers-color-scheme` to save power on OLED screens.

## PWA / Install

- [ ] **iOS meta tags** — Add `<meta name="apple-mobile-web-app-capable" content="yes">` and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` for iOS standalone mode.
- [ ] **Install prompt** — Listen for `beforeinstallprompt` and show an explicit "Install" button instead of relying on the browser's menu.
- [ ] **Display override** — Add `"display_override": ["window-controls-overlay"]` to `manifest.json` for desktop PWA title bar control.
