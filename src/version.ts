/* ============================================================
 * version — Single source of truth for the app version.
 *
 * This file is auto‑bumped by the pre‑push git hook
 * (.githooks/pre-push).  Bump MAJOR or MINOR manually for
 * significant releases.
 * ============================================================ */

export const VERSION = "1.0.10";

/** Fetches the compiled version.js and reloads if the version
 *  differs from the currently loaded one.  Silently ignores
 *  fetch errors so intermittent network issues don't force a
 *  reload. */
export function checkVersion(): void {
  fetch("version.js")
    .then((r) => r.text())
    .then((text) => {
      const m = text.match(/VERSION = "(\d+\.\d+\.\d+)"/);
      if (m && m[1] !== VERSION) {
        window.location.reload();
      }
    })
    .catch(() => { /* fetch error — skip reload */ });
}
