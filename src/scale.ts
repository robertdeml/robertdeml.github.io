/* ============================================================
 * scale — Map scale bar.
 *
 * Once the affine transform is ready (2+ reference pins),
 * displays a horizontal scale bar in the bottom-right corner
 * showing a "nice" distance (1, 2, or 5 × 10ⁿ) in m or km
 * with a line approximately ⅓ the viewport width.
 * ============================================================ */

import { getTransformCoeffs, getMetersPerDeg } from "./transform.js";

const SCALE_BAR_ID = "mapScaleBar";

/** Rounds a target distance (in meters) to the nearest "nice"
 *  scale value: 1, 2, or 5 times a power of 10.
 *  Returns the rounded value and the appropriate unit (m or km). */
function getNiceScale(targetMeters: number): { value: number; unit: string } {
  if (targetMeters <= 0) return { value: 1, unit: "m" };
  const pow10 = Math.pow(10, Math.floor(Math.log10(targetMeters)));
  const firstDigit = targetMeters / pow10;
  let niceValue: number;
  if (firstDigit < 1.5) niceValue = 1;
  else if (firstDigit < 3.5) niceValue = 2;
  else if (firstDigit < 7.5) niceValue = 5;
  else niceValue = 10;
  niceValue *= pow10;
  if (niceValue >= 1000) {
    return { value: niceValue / 1000, unit: "km" };
  }
  return { value: niceValue, unit: "m" };
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
  const targetMeters = targetPx * mPerDegLat / s;

  const nice = getNiceScale(targetMeters);
  const niceMeters = nice.unit === "km" ? nice.value * 1000 : nice.value;
  const actualPx = niceMeters * s / mPerDegLat;

  if (!el) {
    el = document.createElement("div");
    el.id = SCALE_BAR_ID;
    document.body.appendChild(el);
  }

  el.style.cssText = [
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

  el.innerHTML = `<div style="border-top:2px solid #FF5A00;width:${actualPx}px;margin:0 2px;"></div><span>${nice.value} ${nice.unit}</span>`;
}

/* --- Refresh on viewport resize (debounced via rAF) --- */
let resizeTimer: number | null = null;
window.addEventListener("resize", () => {
  if (resizeTimer) cancelAnimationFrame(resizeTimer);
  resizeTimer = requestAnimationFrame(() => refreshScaleBar());
});
