# HikeNow — Agent Guide

## Build & dev

```sh
npm ci
npm run build       # copyfiles web/ → dist/ + tsc src/ → dist/
npm start           # serve dist:3000 + local-ssl-proxy :3001→:3000
npm run watch       # rebuild on changes
npm run clean       # rimraf dist/
```

- **Always run `npm run build` after any change** — the user expects it.
- Open **https://localhost:3001** (HTTPS required for Geolocation API).
- After `npm ci`, build before starting the server.
- `build:html` copies `web/**/*` + lucide.js/floating-ui UMD from node_modules to `dist/`.
- `build:ts` compiles `src/` → `dist/` (ES6 modules).

## CI / verification

```sh
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src/
npm run prettier    # prettier --check src/ web/
```

- No test framework (`npm test` errors out).

## Project structure

- **Vanilla TypeScript PWA** — no framework, no JSX, no SSR.
- `src/app.ts` is the entry point — imports `ui.ts` and `debug.ts`.
- All modules wire up event listeners via top-level imports (side-effect modules).
- `src/state.ts` — shared mutable `st` object + DOM element references. Other modules import from here.
- `web/index.html` — inline `<script>` for essentials dialog, lucide icon init, service worker registration.
- CSS in `web/style.css` — no framework.

## Version bumping

## Version bumping

- Auto-bumped during CI deploy (`.github/workflows/deploy.yml` runs `node scripts/bump-version.mjs` before build).
- Conventional commit format enforced by `.githooks/commit-msg`.
- Enable hooks: `git config core.hooksPath .githooks`
- Manual: `node scripts/bump-version.mjs`

## Service worker

- `web/sw.js` — caches a static `ASSETS` array.
- **Add new source files to `ASSETS`** and bump the `CACHE` name when adding/renaming files.
- Auto-registered via inline script in `index.html`.

## Deployment

- GitHub Actions (`.github/workflows/deploy.yml`) — pushes to `main` trigger build + deploy to Pages.
- `dist/` is uploaded as a Pages artifact.

## Quirks

- Essentials dialog is a modal in `index.html` with inline JS — separate from the TypeScript app.
- `opencode` PowerShell execution policy blocks `npm` directly — use `cmd /c "npm run ..."` instead.
- After `git clone`, must `git config core.hooksPath .githooks` for auto-versioning.
