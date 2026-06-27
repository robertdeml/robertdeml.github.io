import { getTransformCoeffs, getMetersPerDeg } from "./transform.js";
import { st, pinContainer } from "./state.js";

const SCALE_BAR_ID = "mapScaleBar";

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

function formatScaleValue(v: number): string {
  return v % 1 === 0 ? v.toString() : parseFloat(v.toFixed(4)).toString();
}

function countRefPins(): number {
  return pinContainer.querySelectorAll<SVGElement>('svg[data-lat]:not([data-type="footprint"])').length;
}

function getDisplayedImageSize(): { w: number; h: number } | null {
  if (!st.originalImage || !st.imageNaturalWidth || !st.imageNaturalHeight) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / st.imageNaturalWidth, vh / st.imageNaturalHeight);
  return { w: st.imageNaturalWidth * scale, h: st.imageNaturalHeight * scale };
}

export function refreshScaleBar(): void {
  let el = document.getElementById(SCALE_BAR_ID) as HTMLDivElement | null;

  const coeffs = getTransformCoeffs();
  const nPins = countRefPins();
  const hasPhoto = !!st.originalImage;

  if (!hasPhoto) {
    if (el) el.style.display = "none";
    return;
  }

  let s: number;
  let refLat: number;

  if (coeffs) {
    s = Math.sqrt(coeffs.a * coeffs.a + coeffs.b * coeffs.b);
    refLat = coeffs.p0.lat;
  } else if (nPins < 2 && st.watchId !== null) {
    const targetMiles = nPins === 0 ? 1 : 0.25;
    const displayed = getDisplayedImageSize();
    if (!displayed) {
      if (el) el.style.display = "none";
      return;
    }
    const longEdgePx = Math.max(displayed.w, displayed.h);
    refLat = st.lastGps ? parseFloat(st.lastGps.lat) : 40;
    s = (getMetersPerDeg(refLat).mPerDegLat * longEdgePx) / (targetMiles * 1609.344);
  } else {
    if (el) el.style.display = "none";
    return;
  }

  const { mPerDegLat } = getMetersPerDeg(refLat);

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

let resizeTimer: number | null = null;
window.addEventListener("resize", () => {
  if (resizeTimer) cancelAnimationFrame(resizeTimer);
  resizeTimer = requestAnimationFrame(() => refreshScaleBar());
});
