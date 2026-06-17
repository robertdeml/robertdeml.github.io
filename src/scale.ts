/* ============================================================
 * scale — Map scale bar.
 *
 * Once the affine transform is ready (2+ reference pins),
 * displays a horizontal scale bar in the bottom-right corner
 * showing a "nice" distance (1, 2, or 5 × 10ⁿ) in m or km
 * with a line approximately ⅓ the viewport width.
 * ============================================================ */

import { getTransformCoeffs, getMetersPerDeg } from "./transform.js";
import { st } from "./state.js";

const SCALE_BAR_ID = "mapScaleBar";

/** Rounds a positive target value to the nearest "nice" number:
 *  1, 2, or 5 times a power of 10. */
function getNiceScale(target: number): number {
  if (target <= 0) return 1;
  const pow10 = Math.pow(10, Math.floor(Math.log10(target)));
  const firstDigit = target / pow10;
  let nice: number;
  if (firstDigit < 1.5) nice = 1;
  else if (firstDigit < 3.5) nice = 2;
  else if (firstDigit < 7.5) nice = 5;
  else nice = 10;
  return nice * pow10;
}

/** Formats a nice scale value for display, stripping unnecessary
 *  trailing zeros (e.g. "1", "0.5", "2.5"). */
function formatScaleValue(v: number): string {
  return v % 1 === 0 ? v.toString() : parseFloat(v.toFixed(4)).toString();
}

/** Creates or updates the scale bar element. Hides it when the
 *  transform is not available (<2 reference pins). */
export function refreshScaleBar(): void {
  const coeffs = getTransformCoeffs();
  let el = document.getElementById(SCALE_BAR_ID) as HTMLDivElement | null;

  if (!coeffs) {
    if (el) el.style.display = "none";
    return;
  }

  const s = Math.sqrt(coeffs.a * coeffs.a + coeffs.b * coeffs.b);
  const { mPerDegLat } = getMetersPerDeg(coeffs.p0.lat);

  const targetPx = window.innerWidth / 3;
  const targetMeters = (targetPx * mPerDegLat) / s / st.zoom;

  let niceMeters: number;
  let label: string;

  if (st.unit === "imperial") {
    const M_PER_MI = 1609.344;
    const targetMiles = targetMeters / M_PER_MI;
    const niceMiles = getNiceScale(targetMiles);
    niceMeters = niceMiles * M_PER_MI;
    label = `${formatScaleValue(niceMiles)} mi`;
  } else {
    const nice = getNiceScale(targetMeters);
    niceMeters = nice;
    if (nice >= 1000) {
      label = `${formatScaleValue(nice / 1000)} km`;
    } else {
      label = `${formatScaleValue(nice)} m`;
    }
  }

  const actualPx = (niceMeters * s) / mPerDegLat * st.zoom;

  if (!el) {
    el = document.createElement("div");
    el.id = SCALE_BAR_ID;
    document.body.appendChild(el);
  }

  el.style.cssText =
    [
      "position:fixed",
      "bottom:40px",
      "right:16px",
      "z-index:10",
      "background:rgba(0,0,0,0.6)",
      "color:#FF5A00",
      "font-family:monospace",
      "font-size:13px",
      "padding:6px 8px",
      "border-radius:4px",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "gap:3px",
      "line-height:1",
    ].join(";") + ";";

  el.innerHTML = `<div style="border-top:2px solid #FF5A00;width:${actualPx}px;margin:0 2px;"></div><span>${label}</span>`;
}

/* --- Refresh on viewport resize (debounced via rAF) --- */
let resizeTimer: number | null = null;
window.addEventListener("resize", () => {
  if (resizeTimer) cancelAnimationFrame(resizeTimer);
  resizeTimer = requestAnimationFrame(() => refreshScaleBar());
});
