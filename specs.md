# HikeNow — Specification

> **Vanilla TypeScript PWA** for hiking navigation using geo-tagged photos.
> No framework, no JSX, no SSR — pure DOM + SVG + Canvas 2D.

---

## Outline

1. [Architecture](#1-architecture)
2. [Photo System](#2-photo-system)
3. [GPS Tracking](#3-gps-tracking)
4. [Reference Pins](#4-reference-pins)
5. [Affine Transform](#5-affine-transform)
6. [Footprints / Trail](#6-footprints--trail)
7. [Scale Bar](#7-scale-bar)
8. [Compass](#8-compass)
9. [Elevation Profile](#9-elevation-profile)
10. [Zoom & Pan](#10-zoom--pan)
11. [Save & Load](#11-save--load)
12. [Debug Mode](#12-debug-mode)
13. [UI / Menu System](#13-ui--menu-system)
14. [Service Worker](#14-service-worker)
15. [Version System](#15-version-system)
16. [Build & Dev](#16-build--dev)

---

## 1. Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (ES6 modules) |
| Rendering | DOM + CSS + SVG + Canvas 2D |
| Icons | Lucide (UMD build) |
| Positioning | Floating UI DOM (UMD build) |
| Build | TypeScript compiler (`tsc`) + copyfiles |
| Dev server | `serve` + `local-ssl-proxy` (HTTPS required for Geolocation API) |
| Linting | ESLint + `typescript-eslint` |
| Formatting | Prettier |

### Project Structure

```
/
├── src/              # TypeScript source (compiled to dist/)
│   ├── app.ts        # Entry point — imports all side-effect modules
│   ├── state.ts      # Shared mutable state + DOM element refs
│   ├── ui.ts         # Top-level UI wiring
│   ├── pins.ts       # Pin creation, toolbar, footprints, replay, path
│   ├── gps.ts        # Real GPS tracking via Geolocation API
│   ├── transform.ts  # GPS-to-pixel affine transform math
│   ├── scale.ts      # Map scale bar
│   ├── compass.ts    # North arrow widget
│   ├── elevation.ts  # Elevation profile panel
│   ├── save.ts       # Save/restore to localStorage
│   ├── debug.ts      # Simulated GPS for testing
│   └── version.ts    # Version constant + update checker
├── web/              # Static assets (copied to dist/)
│   ├── index.html
│   ├── style.css
│   ├── sw.js         # Service worker
│   ├── manifest.json
│   ├── icon-192.svg
│   └── icon-512.svg
├── dist/             # Build output
└── scripts/
    └── bump-version.mjs
```

### Module Pattern

All modules except `app.ts` are **side-effect modules**: their top-level code wires up event listeners by importing DOM references from `state.ts`. Modules export functions for other modules to call. `state.ts` exports a shared mutable `st` object.

### Module Dependency Graph

```
app.ts
  ├── ui.ts
  │     ├── state.ts
  │     ├── pins.ts → state.ts, transform.ts, scale.ts, compass.ts, elevation.ts
  │     ├── gps.ts  → state.ts, pins.ts, transform.ts, compass.ts, scale.ts
  │     ├── scale.ts → transform.ts, state.ts
  │     ├── compass.ts → state.ts, transform.ts
  │     ├── elevation.ts → state.ts, pins.ts
  │     ├── save.ts → state.ts, pins.ts, elevation.ts, scale.ts, transform.ts, ui.ts
  │     └── version.ts
  ├── debug.ts → state.ts, pins.ts, gps.ts
  └── compass.ts → state.ts, transform.ts
```

---

## 2. Photo System

### Image Capture

- **Trigger**: Camera button in menu panel opens a hidden `<input type="file" accept="image/*" capture="environment">`.
- **Format**: Image is read via `FileReader.readAsDataURL()` → base64 data URL.
- **Storage**: Stored in `st.originalImage` (string | null).

### Image Display

- **Container**: `<div id="mapBg">` — fixed, full viewport, `z-index:1`.
- **CSS**: `background-size:contain; background-position:center; background-repeat:no-repeat`.
- **Rotation**: Applied by drawing to an offscreen Canvas 2D, rotating via `ctx.rotate()`, then exporting as JPEG via `canvas.toDataURL("image/jpeg", 0.92)`.
- **Rotation increments**: 90° counter-clockwise per tap of the rotation button. Values: 0, 90, 180, 270.
- **Dimensions**: Natural image dimensions are stored in `st.imageNaturalWidth` / `st.imageNaturalHeight` when the image loads.

### Image Lifecycle

| Event | Effect |
|-------|--------|
| Photo selected | GPS pin removed, transform state reset, zoom/pan reset to 1/0, image set, GPS auto-starts if not already running, map mode enabled |
| Rotation | Canvas reprocessed, background image replaced |
| Save | Image stored as separate localStorage key (`hikenow-save-image`) |
| Load | Image restored from localStorage, rotation reapplied |

### Button Disable State

- **Compass (GPS toggle)**: Disabled until a photo is loaded.
- **Rotate**: Disabled until a photo is loaded.
- **Map Mode**: Disabled until both a photo is loaded AND GPS is active.

---

## 3. GPS Tracking

### Activation

- **Trigger**: Compass button (satellite icon) — toggles tracking on/off.
- **Button hidden** until `navigator.geolocation` is detected.
- **Auto-starts** when a photo is selected (if not already running).
- **Wake lock**: `navigator.wakeLock.request("screen")` acquired on start, released on stop.

### Geolocation API

- `navigator.geolocation.watchPosition()` with `{ enableHighAccuracy: true }`.
- **watchId**: stored in `st.watchId`.

### GPS Pin

- **Type**: SVG map pin (teardrop shape), color `#22c55e` (green).
- **Position**: Computed via `gpsToPixel(lat, lng)` — requires 2+ reference pins.
- **Creation**: `updateGpsPin(lat, lng, acc)` removes any existing pin, creates a new one.
- **Not clickable** (`pointer-events: none`).
- **Stale timeout**: 60 seconds (`st.gpsTimeoutId`). If no position update within 60s, pin turns yellow (`#eab308`), `st.gapBeforeNextFp` set to `true`.

### GPS Status Display

- **Element**: `<div id="gpsStatus">` — bottom-left corner, monospace, orange text on dark background.
- **Content**: `"lat, lng  ±acc m  (x, y)"`.
- **Shown when tracking active, hidden on stop.**

### Off-Screen Indicator

- **When**: GPS pin is outside the viewport.
- **Visual**: Arrow icon on the viewport border pointing toward the GPS pin + distance label (only when transform is available).
- **Positioning**: Projects the pin position onto the nearest viewport edge. Handles all 8 quadrants.
- **Distance**: Computed from screen-pixel distance converted to meters via the affine transform scale.
- **Rotation**: Arrow rotates via CSS `transform: rotate()` to point at the pin.

---

## 4. Reference Pins

### Placement

- **Map Mode** must be active (toggled via map button).
- **Click** on the map background places a pin at the clicked position (converted to document coordinates via `screenToDoc()`).
- **GPS attachment**: If GPS is active, the current GPS position (`st.lastGps`) is attached to the pin as `data-lat`, `data-lng`, `data-acc`.
- **Visual**: Orange (`#FF5A00`) teardrop SVG pin, 32×32px, with white center dot.
- **Positioning**: `position:absolute` with `transform: translate(-50%, -100%)` to anchor at the tip. CSS class `counter-scale` reverses zoom scaling.
- **No-GPS pins**: Can be placed in Map Mode without GPS (no coordinate data).

### SVG Structure

```svg
<svg viewBox="0 0 24 24" width="32" height="32" data-lat="..." data-lng="..." data-acc="..." data-adjLat="..." data-adjLng="...">
  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799..."/>
  <circle cx="12" cy="10" r="3" fill="#fff"/>
</svg>
```

### Pin Selection & Toolbar

- **Click** a pin → toolbar appears (Floating UI positioned, placement: right, fallback: left, with shift + offset).
- **Click same pin again** → toolbar hides.
- **Pin overlay** behind toolbar — click to dismiss.
- **Active pin** stored in `st.activePin`.

### Toolbar Contents

| Section | Elements | Behavior |
|---------|----------|----------|
| Arrow nudger | Up/Down/Left/Right buttons | Moves pin 1px in document space; refreshes accuracy circles + footprints |
| GPS info | Lat, Lon, Acc, X, Y display | Shows original + adjusted coordinates when modified |
| Copy | Clipboard icon | Copies pin data as text to clipboard (shows toast on success) |
| GPS adj (1m) | N/E/S/W buttons, adjLat/adjLng displays | Shown only when pin has GPS data and 2+ ref pins exist; adjusts GPS coords by ~1m within accuracy bounds |
| Delete | Trash icon | Removes pin + its accuracy circle from DOM |

### GPS Adjustment

- **N/E/S/W buttons** adjust `adjLat`/`adjLng` by ~1 meter.
- `getMetersPerDeg()` computes the conversion at the pin's original latitude.
- **Clamped** within the original GPS accuracy radius: adjustments cannot move beyond ±accuracy meters.
- **After adjustment**: pin pixel position recalculated via transform, accuracy circles refreshed, footprints repositioned, toolbar updated.

### Accuracy Circles

- **Shown only when**: 2+ reference pins exist (transform available).
- **Visual**: Dashed orange SVG circle centered on pin, radius = `accToPixelRadius(acc)` meters converted to pixels.
- **Refresh**: Called after pin placement, deletion, nudge, or GPS adjustment.
- **Storage**: Expando property `_accCircle` on the SVG element.

---

## 5. Affine Transform

### Purpose

Maps GPS coordinates (lat/lng) to pixel coordinates (x/y) on the photo, enabling automatic footprint placement from GPS data.

### Algorithm

- **Least-squares similarity transform** (scale + rotation, no skew/shear).
- **Requires**: 2+ reference pins with GPS coordinates.
- **First pin** becomes the origin (`p0`).
- For each subsequent pin, computes deltas in GPS space (`dLat`, `dLng`) and pixel space (`dX`, `dY`).
- Solves for transform coefficients `a` and `b`:

```
sumA += (dX · dLat + dY · dLng) / (dLat² + dLng²)
sumB += (dY · dLat - dX · dLng) / (dLat² + dLng²)
a = average(sumA)
b = average(sumB)
```

### Transform Application

```
x = p0.x + a · dLat - b · dLng
y = p0.y + b · dLat + a · dLng
```

Where `dLat = lat - p0.lat`, `dLng = lng - p0.lng`.

### Scale Factor

```
s = √(a² + b²)    (pixels per degree latitude)
```

### North Direction

```
northAngle = atan2(a, -b)    (radians from up on screen)
```

### Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getRefPins()` | `{lat,lng,x,y}[]` | Collects all reference pin data (private) |
| `getTransformCoeffs()` | `{a,b,p0} | null` | Computes transform; null if <2 pins |
| `gpsToPixel(lat,lng)` | `{x,y} | null` | Maps GPS → pixel; null if no transform |
| `accToPixelRadius(accMeters)` | `number` | Accuracy in meters → pixel radius; capped at 500px |
| `getMetersPerDeg(lat)` | `{mPerDegLat, mPerDegLng}` | 111320 m/deg lat; cos-adjusted for lng |

---

## 6. Footprints / Trail

### Auto-Footprinting

- **Trigger**: Each GPS position update.
- **First point**: Records `lastFpLat`, `lastFpLng`, `lastFpAcc` — no circle drawn.
- **Subsequent points**: Computes distance from last footprint via `gpsDistanceMeters()`.
- **Threshold**: New footprint drawn only if `distance > lastAcc + currentAcc`.
- **Replacement**: New point entirely inside the old circle and more accurate → replaces the old.
- **Gap handling**: When GPS goes stale (60s timeout), `st.gapBeforeNextFp` = true — distance is not accumulated across gaps.

### Footprint Buffer

- **When transform not ready** (<2 ref pins): GPS points are buffered in `st.fpBuffer`.
- **Flush**: When transform becomes available, all buffered points are drawn via `flushFootprintBuffer()`.
- **Auto-save**: Triggered on each new footprint after buffer flush.

### Footprint Visual

- **Type**: SVG `<svg>` element with `<circle>` inside.
- **Color**: Orange `#FF5A00`, semi-transparent fill.
- **Radius**: `max(accToPixelRadius(acc), 2)` pixels.
- **Data attributes**: `data-type="footprint"`, `data-lat`, `data-lng`, `data-acc`, `data-alt`.
- **Position**: Absolute, centered on pixel position.

### Distance Tracking

- Accumulated in `st.totalDistanceM` (meters).
- Displayed in menu panel `#distanceDisplay`.
- **Toggle units**: Click the distance display to switch metric/imperial.
- Format: m/km or ft/mi with appropriate precision (0.1 mi, 1 ft, 1 m, 0.1 km, etc.).

### Trail Replay

- **Start**: Via Replay button in menu.
- **Animation**: Footprints revealed one-by-one at 500ms intervals, each turning green then fading back to orange.
- **Domination**: All existing SVGs hidden during replay, replay circles rendered at `z-index:6`.
- **Stop**: Auto-stops after all footprints shown (1s delay) or via top-stop button.
- **Toggle**: Clicking Replay while playing stops and restores the map.

### Path Line

- **Modes**: `circles` (default), `line`, `both` — cycled via Path Style button.
- **Polyline**: Drawn on an SVG overlay (`z-index:3`) connecting footprint centers.
- **Color**: Semi-transparent orange `rgba(255,90,0,0.45)`, stroke-width 3.
- **Updates**: On each new footprint, mode change, or reposition.

---

## 7. Scale Bar

### Placement

Bottom-right corner (`bottom:40px; right:16px`), above the compass. Dark background, orange text.

### Visibility Conditions

| Ref Pins | GPS Active | Behavior |
|----------|------------|----------|
| 0 | Yes | Shows with 1-mile default on long edge |
| 1 | Yes | Shows with 0.25-mile default on long edge |
| 2+ | Any | Shows with transform-based scale |
| Any | No photo | Hidden |

### Scale Computation (2+ pins)

```
s = √(a² + b²)                             // pixels per degree lat
targetPx = viewportWidth / 3               // ~1/3 viewport
targetMeters = targetPx · mPerDegLat / s / zoom
```

Nice scale applied: 1, 2, or 5 × 10ⁿ.

### Default Scale (0 or 1 pin)

```
displayedSize = displayed image dimensions at zoom=1 (background-size: contain)
longEdgePx = max(displayedWidth, displayedHeight)
targetMiles = (0 pins) ? 1 : 0.25
s = mPerDegLat · longEdgePx / (targetMiles · 1609.344)   // effective scale factor
```

### Label Format

- **Imperial**: "X mi" (or "X ft" for small values via offscreen indicator).
- **Metric**: "X m" or "X km".
- **Nice rounding**: 1, 2, or 5 × 10ⁿ.

### Resize Handling

Debounced via `requestAnimationFrame` on `window.resize`.

---

## 8. Compass

### Placement

Bottom-right corner (`bottom:90px; right:16px`), above the scale bar. Fixed position, `z-index:10`.

### Visibility

- **Shown when**: GPS is tracking AND a photo is loaded.
- **Hidden when**: GPS stops or no photo.

### Visual Design

- 44px circle with `2px solid #FF5A00` border, `rgba(0,0,0,0.6)` background.
- Inner: North-pointing CSS triangle (border trick) + "N" label.
- Whole arrow assembly rotates as a unit.

### Rotation Logic

| Reference Pins | Rotation | Behavior |
|----------------|----------|----------|
| 0 or 1 | `0deg` | North points straight up |
| 2+ | `atan2(a, -b) · 180/π` | North points according to affine transform |

**Transition**: CSS `transition: transform .3s ease` for smooth rotation.

### Refresh Triggers

- Zoom/pan (via `applyZoom()`)
- Pin placed or deleted (via `refreshAccuracyCircles()`)
- GPS start/stop
- Photo loaded (image onload in `applyRotation()`)
- Unit toggle (via `refreshScaleBar()` cascade)

---

## 9. Elevation Profile

### Activation

Toggle via mountain icon in menu. Shows/hides elevation panel.

### Panel

- **Position**: Bottom 1/3 of viewport (33.33vh), full width, `z-index:15`.
- **Background**: Semi-transparent dark `rgba(0,0,0,0.5)`.
- **Close button**: Top center, orange-bordered circle with X icon.
- **Chart area**: `<div id="elevationChart">` inset below close button.

### Chart Rendering

- **SVG** overlay with `viewBox="0 0 100 100"`, `preserveAspectRatio="none"`.
- **Data**: Accumulated GPS distance (x-axis) vs altitude (y-axis) from footprint `data-alt` values.
- **Polyline**: Orange stroke, 0.6 viewBox units.
- **Labels**: Min/max altitude and start/end distance in bottom corners.
- **Empty**: If <2 footprints with altitude, chart area is blank.

### Hover Interaction

- **Crosshair**: Vertical line following mouse position.
- **Highlight**: Corresponding footprint on map turns green with thicker stroke.
- **Tooltip**: Shows distance + altitude at hovered position.

### Data Requirements

- Requires 2+ footprints with `data-alt` values.
- Altitude comes from `position.coords.altitude` (if available) or manual debug input.
- Updates on each new footprint and unit toggle.

---

## 10. Zoom & Pan

### Container Transform

Both `#mapBg` and `#pinContainer` share the same CSS transform:

```
transform: translate(panX px, panY px) scale(zoom)
transform-origin: 0 0
```

The CSS custom property `--zoom` is set on `#pinContainer` for use by `counter-scale` class.

### Pinch-to-Zoom (Touch)

| Gesture | Action |
|---------|--------|
| 1 finger | Pan |
| 2 fingers | Zoom (pinch centered) |

**Clamp**: `zoom ∈ [0.25, 10]`.

**Algorithm**: For pinch zoom, the center point between two touches is used as the focal point — zoom scales around that point, with pan adjusted accordingly.

### Mouse Wheel Zoom (Desktop)

- Scroll wheel changes zoom by factor `(1 - deltaY · 0.001)`.
- Focal point is the mouse cursor position.
- Also clamped 0.25–10×.

### Pan

- Mouse/touch drag translates the image.
- No boundary clamping — image can be panned entirely off-screen.

### Coordinate Conversion

**Screen → Document**:
```
docX = (screenX - panX) / zoom
docY = (screenY - panY) / zoom
```

Used for pin placement, pinch-centering, and wheel focal points.

---

## 11. Save & Load

### Storage

- **localStorage key**: `hikenow-save` (data), `hikenow-save-image` (image).
- **Auto-save**: On each new footprint (silent failure on quota exceeded).
- **Manual save**: Via save button — saves image separately, shows toast on success/failure.
- **Manual load**: Via load button — restores full state from localStorage.

### Save Data Shape

```typescript
interface SaveData {
  version: 1;
  view: { zoom: number; panX: number; panY: number };
  settings: {
    unit: "metric" | "imperial";
    pathStyle: "circles" | "line" | "both";
    elevationEnabled: boolean;
    mapMode: boolean;
  };
  refPins: { lat, lng, acc, adjLat, adjLng, x, y }[];
  footprints: { lat, lng, acc, alt? }[];
  totalDistanceM: number;
  rotation: number;
}
```

### Restore Process

1. Clear existing DOM state (remove all SVGs, clear background).
2. Reset runtime state (last footprint position, buffer).
3. Extract image from `hikenow-save-image` key (fall back to old embedded format).
4. Restore image → apply rotation.
5. Restore zoom/pan.
6. Restore settings.
7. Restore reference pins → show accuracy circles if transform ready.
8. Restore footprints → reposition via transform.
9. Redraw path line, update elevation, update UI state.

---

## 12. Debug Mode

### Availability

Only on `localhost` or `127.0.0.1` (`state.ts` `isLocal`). Otherwise debug button and panel are hidden.

### Activation

- **Button**: Bug icon in menu panel — toggles debug panel.
- **Active state**: Green background on button (`#22c55e`).

### Debug Panel Contents

| Field | Type | Description |
|-------|------|-------------|
| Lat | `<input type="number">` | Manual latitude input (step 0.0005, default 42.9) |
| Lon | `<input type="number">` | Manual longitude input (step 0.0005, default -71.5) |
| Acc | `<input type="number">` | Accuracy in meters (step 1, default 20) |
| Alt | `<input type="number">` | Altitude in meters (step 10, default 0) with −/+10 buttons |
| GPS Toggle | Button | Toggles simulated GPS updates on/off |

### Behavior

- **On toggle ON**: Immediately calls `updateDebugGps()`, then runs every 1 second via `setInterval`.
- **On toggle OFF**: Clears interval. If real GPS was active before, restores the last real GPS pin. Otherwise removes GPS pin.
- **Input changes**: Each input fires `updateDebugGps()` immediately.
- **GPS updates**: Sets `resetGpsTimeout()`, calls `placeFootprint()` and `updateGpsPin()`.
- **Override**: `st.debugActive` flag prevents real GPS handler from processing positions during debug mode.

---

## 13. UI / Menu System

### Toolbar Buttons

All 48×48px buttons with Lucide icons. Panel slides open from top-right.

#### Row 1 — Map Controls

| Button | Icon | Action |
|--------|------|--------|
| Camera | `camera` | Opens file picker for photo |
| Map Mode | `map` | Toggles pin-placement mode |
| GPS | `satellite` | Toggles GPS tracking |
| Rotate | `rotate-ccw` | Rotates image 90° CCW |

#### Row 2 — Trail Tools

| Button | Icon(s) | Action |
|--------|---------|--------|
| Elevation | `mountain` | Toggles elevation profile panel |
| Replay | `footprints` + `play` overlay | Starts/stops trail replay |
| Path Style | `route` + dot/slash indicators | Cycles circles/line/both |
| Clear Trail | `footprints` + `ban` overlay | Confirms then removes all footprints |

#### Row 3 — App Controls

| Button | Icon | Action |
|--------|------|--------|
| Info | `info` | Opens help dialog |
| Essentials | `list-checks` | Opens 10 Essentials checklist |
| Reload | `refresh-cw` | Checks for app update |
| Debug | `bug` | Toggles debug panel (local only) |
| Save | `save` | Saves state to localStorage |
| Load | `download` | Restores state from localStorage |

### Distance Display

Non-button element. Shows current total distance. Click to toggle metric/imperial.

### Info Dialog

Modal with explanations for each feature. Shows version number. Close via button or overlay click.

### Essentials Dialog

The Ten Essentials checklist. Opens/closes via overlay or close button. Separate inline JS in `index.html` (not TypeScript).

### Menu Button States

- **Active**: Button text turns orange (`#ff5a00`) when its feature is enabled.
- **Disabled**: Grayed out (`opacity: 0.4`, `cursor: not-allowed`) when prerequisite not met (e.g., no photo).

---

## 14. Service Worker

### File

`web/sw.js` — cache-first strategy.

### Cache

- **Name**: `hikenow-v2`.
- **Pre-cached assets**: `index.html`, all JS modules, Lucide, Floating UI, manifest, icons.
- **Strategy**: Cache-first; fallback to network on cache miss.
- **Only GET requests** are intercepted.

### Lifecycle

- **Install**: Opens cache, adds all assets, calls `skipWaiting()`.
- **Activate**: Deletes old caches, calls `clients.claim()`.
- **Fetch**: Cache-first with network fallback.

### Maintenance

- **Bump cache name** when adding/renaming source files.
- **Update asset list** (`ASSETS` array) when files are added/removed.

---

## 15. Version System

### Source of Truth

`src/version.ts` exports `VERSION` constant (e.g., `"1.0.17"`).

### Display

- Menu panel: `"v1.0.17"` next to title.
- Info dialog: `"v1.0.17"` in footer.

### Update Check

- **Trigger**: Reload button or manual `checkVersion()` call.
- **Process**: Fetches the compiled `version.js` from the server, extracts the `VERSION` string via regex.
- **On mismatch**: `window.location.reload()` to load new version.
- **Silent failure**: Network errors are caught and ignored.

### Bumping

- **Automatic**: CI deploy runs `node scripts/bump-version.mjs`.
- **Conventional commits**: `.githooks/commit-msg` hook enforces format.
- **Manual**: `npm run bump`.
- **Enable hooks**: `git config core.hooksPath .githooks`.

---

## 16. Build & Dev

### Commands

| Command | Description |
|---------|-------------|
| `npm ci` | Clean install dependencies |
| `npm run build` | Full build (HTML copy + TypeScript compile) |
| `npm start` | Serve `dist/` on `:3000` + HTTPS proxy on `:3001` |
| `npm run watch` | Rebuild on source changes |
| `npm run clean` | Remove `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint on `src/` |
| `npm run prettier` | Prettier check on `src/` and `web/` |

### Dev Notes

- **HTTPS required** for Geolocation API in production — `local-ssl-proxy` provides this locally.
- **Open**: `https://localhost:3001` during development.
- **PowerShell**: Use `cmd /c "npm run ..."` on Windows (execution policy blocks `npm` directly).
- **No test framework** — `npm test` errors out.
- **CI**: `.github/workflows/deploy.yml` — builds and deploys to Pages on push to `main`.

### Asset Pipeline

- `build:html`: Copies `web/**/*` + Lucide UMD + Floating UI UMDs to `dist/`.
- `build:ts`: Compiles `src/**/*.ts` → `dist/**/*.js` (ES6 modules).
- **No bundler** — native ES module imports served directly.
