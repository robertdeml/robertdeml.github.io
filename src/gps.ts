/* ============================================================
 * gps — Real GPS tracking via Geolocation API.
 *
 * Manages watchPosition lifecycle, renders a green GPS pin
 * + accuracy circle at the transformed pixel location, and
 * auto-drops footprints when the user moves >20px.
 * ============================================================ */

import { st, compassBtn, menuBtn, mapBtn, pinContainer, statusEl } from "./state.js";
import { createPinSvg } from "./pins.js";
import { gpsToPixel, accToPixelRadius, getTransformCoeffs, getMetersPerDeg } from "./transform.js";
import { placeFootprint } from "./pins.js";
import { refreshCompass } from "./compass.js";
import { refreshScaleBar } from "./scale.js";

const GPS_YELLOW = "#eab308";

export function setGpsPinColor(
  fill: string,
  accFill: string,
  accStroke: string,
) {
  if (st.gpsPin) st.gpsPin.style.fill = fill;
  if (st.gpsAccCircle) {
    const c = st.gpsAccCircle.querySelector("circle");
    if (c) {
      c.style.fill = accFill;
      c.style.stroke = accStroke;
    }
  }
}

/** Resets the 60-second stale-GPS timer.  Fires and turns the pin
 *  yellow when no position arrives within the window. */
export function resetGpsTimeout() {
  if (st.gpsTimeoutId !== null) clearTimeout(st.gpsTimeoutId);
  st.gpsTimeoutId = setTimeout(() => {
    setGpsPinColor(GPS_YELLOW, "rgba(234, 179, 8, 0.1)", GPS_YELLOW);
    st.gpsTimeoutId = null;
    st.gapBeforeNextFp = true;
  }, 60000);
}

/** Removes the green GPS pin and its accuracy circle from the DOM. */
export function removeGpsPin() {
  if (st.gpsPin) {
    st.gpsPin.remove();
    st.gpsPin = null;
  }
  if (st.gpsAccCircle) {
    st.gpsAccCircle.remove();
    st.gpsAccCircle = null;
  }
  updateOffscreenIndicator();
}

/** Off-screen GPS pin indicator: arrow on viewport border + distance label. */
let _offscreenEl: HTMLElement | null = null;

function getOffscreenEl(): HTMLElement {
  if (!_offscreenEl) {
    const el = document.createElement("div");
    el.id = "gpsOffscreen";
    el.style.cssText = "position:fixed;z-index:50;pointer-events:none;display:none;";
    el.innerHTML = [
      '<svg id="gpsOffscreenArrow" viewBox="0 0 24 24" width="28" height="28" style="display:block;position:absolute;left:-14px;top:-14px;">',
      '<circle cx="12" cy="12" r="10.5" fill="rgba(34,197,94,0.15)" stroke="#22c55e" stroke-width="2"/>',
      '<path d="M5 12h14M12 5l7 7-7 7" stroke="#22c55e" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      '</svg>',
      '<span id="gpsOffscreenDist" style="position:absolute;white-space:nowrap;font:bold 12px/1 monospace;color:#22c55e;background:rgba(0,0,0,0.65);padding:2px 5px;border-radius:3px;"></span>',
    ].join("");
    document.body.appendChild(el);
    _offscreenEl = el;
  }
  return _offscreenEl;
}

/** Formats a distance in meters to a short readable string in the current unit system. */
function formatDist(m: number): string {
  if (st.unit === "imperial") {
    const feet = m * 3.28084;
    if (feet >= 528) return `${(feet / 5280).toFixed(feet >= 52800 ? 0 : 1)} mi`;
    return `${feet.toFixed(0)} ft`;
  }
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
  if (m >= 10) return `${m.toFixed(0)} m`;
  return `${m.toFixed(1)} m`;
}

/** Shows or hides the off-screen indicator based on the GPS pin
 *  position relative to the viewport. Handles all 8 quadrants.
 *  Accounts for zoom/pan transform. */
export function updateOffscreenIndicator() {
  const pin = st.gpsPin;
  const el = getOffscreenEl();
  if (!pin) { el.style.display = "none"; return; }

  const px = parseFloat(pin.style.left);
  const py = parseFloat(pin.style.top);
  if (isNaN(px) || isNaN(py)) { el.style.display = "none"; return; }

  // Convert document coords to screen coords
  const sx = px * st.zoom + st.panX;
  const sy = py * st.zoom + st.panY;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (sx >= 0 && sx <= vw && sy >= 0 && sy <= vh) { el.style.display = "none"; return; }

  const cx = vw / 2;
  const cy = vh / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const pad = 16;

  let ix: number, iy: number;
  if (absDx * vh > absDy * vw) {
    ix = dx > 0 ? vw - pad : pad;
    iy = cy + (dy / absDx) * (vw / 2 - pad);
  } else {
    iy = dy > 0 ? vh - pad : pad;
    ix = cx + (dx / absDy) * (vh / 2 - pad);
  }
  ix = Math.max(8, Math.min(vw - 8, ix));
  iy = Math.max(8, Math.min(vh - 8, iy));

  // Position & rotate the arrow using screen coords
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  el.style.display = "block";
  el.style.left = `${ix}px`;
  el.style.top = `${iy}px`;
  const arrow = document.getElementById("gpsOffscreenArrow") as HTMLElement | null;
  if (arrow) arrow.style.transform = `rotate(${angle}deg)`;

  // --- Off-screen distance in meters ---
  const screenDistPx = Math.sqrt((sx - ix) ** 2 + (sy - iy) ** 2);
  // Convert back to document pixels for meters-per-pixel calc
  const docDistPx = screenDistPx / st.zoom;
  const coeffs = getTransformCoeffs();
  const label = document.getElementById("gpsOffscreenDist") as HTMLElement | null;
  if (!label) return;

  if (!coeffs) {
    label.style.display = "none";
    return;
  }
  label.style.display = "block";

  const s = Math.sqrt(coeffs.a * coeffs.a + coeffs.b * coeffs.b);
  const { mPerDegLat } = getMetersPerDeg(coeffs.p0.lat);
  const distM = (docDistPx * mPerDegLat) / s;
  label.textContent = formatDist(distM);

  // Position label toward viewport center (so it's visible inside the border)
  const tx = cx - ix, ty = cy - iy;
  const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
  const labelOfs = 22;
  label.style.left = `${(tx / tlen) * labelOfs}px`;
  label.style.top = `${(ty / tlen) * labelOfs - 6}px`;
}

window.addEventListener("resize", updateOffscreenIndicator);

/** Creates or updates the green GPS pin at the pixel position
 *  corresponding to (lat,lng). Also draws a dashed accuracy
 *  circle if `acc` is provided. */
export function updateGpsPin(lat: number, lng: number, acc?: string) {
  const pos = gpsToPixel(lat, lng);
  if (!pos) return;
  removeGpsPin();
  st.gpsPin = createPinSvg(pos.x, pos.y, "#22c55e", false);
  pinContainer.appendChild(st.gpsPin);

  if (acc) {
    const accNum = parseFloat(acc);
    if (!isNaN(accNum)) {
      const r = accToPixelRadius(accNum);
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.style.cssText = `position:absolute;left:${pos.x - r - 5}px;top:${pos.y - r - 5}px;width:${r * 2 + 10}px;height:${r * 2 + 10}px;pointer-events:none;z-index:4;`;
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", (r + 5).toString());
      circle.setAttribute("cy", (r + 5).toString());
      circle.setAttribute("r", Math.max(r, 2).toString());
      circle.style.fill = "rgba(34, 197, 94, 0.1)";
      circle.style.stroke = "#22c55e";
      circle.style.strokeWidth = "1.5";
      circle.style.strokeDasharray = "4 3";
      svg.appendChild(circle);
      pinContainer.appendChild(svg);
      st.gpsAccCircle = svg;
    }
  }
  updateOffscreenIndicator();
}

/** Stops GPS watching, clears state, and turns the GPS pin yellow. */
async function releaseWakeLock() {
  if (st.wakeLock) {
    try { await st.wakeLock.release(); } catch { /* ignore */ }
    st.wakeLock = null;
  }
}
function stopTracking() {
  if (st.watchId !== null) {
    navigator.geolocation.clearWatch(st.watchId);
    st.watchId = null;
  }
  if (st.gpsTimeoutId !== null) {
    clearTimeout(st.gpsTimeoutId);
    st.gpsTimeoutId = null;
  }
  setGpsPinColor(GPS_YELLOW, "rgba(234, 179, 8, 0.1)", GPS_YELLOW);
  st.lastGps = null;
  st.lastFpLat = null;
  st.lastFpLng = null;
  st.lastFpAcc = null;
  st.lastFpEl = null;
  st.fpBuffer = [];
  st.gapBeforeNextFp = true;
  st.mapMode = false;
  menuBtn?.classList.remove("active");
  compassBtn?.classList.remove("active");
  mapBtn?.classList.remove("active");
  mapBtn?.setAttribute("disabled", "");
  releaseWakeLock();
  statusEl.style.display = "none";
  refreshCompass();
  refreshScaleBar();
}

/** Starts GPS watching with high accuracy. On each position
 *  update, places a green GPS pin, auto-drops footprints
 *  every 20px of movement, and updates the status bar. */
async function requestWakeLock() {
  try {
    st.wakeLock = await navigator.wakeLock.request("screen");
    st.wakeLock.addEventListener("release", () => { st.wakeLock = null; });
  } catch { /* wake lock not supported or denied */ }
}

export function startTracking() {
  requestWakeLock();
  menuBtn?.classList.add("active");
  compassBtn?.classList.add("active");
  mapBtn?.removeAttribute("disabled");
  statusEl.style.display = "";
  st.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      st.lastGps = {
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
        acc: pos.coords.accuracy.toFixed(0),
      };
      resetGpsTimeout();
      if (st.debugActive) return;
      const curLat = pos.coords.latitude;
      const curLng = pos.coords.longitude;
      const curAcc = pos.coords.accuracy;
      const curAlt = pos.coords.altitude || undefined;
      placeFootprint(curLat, curLng, curAcc, curAlt);
      updateGpsPin(pos.coords.latitude, pos.coords.longitude, st.lastGps.acc);
      statusEl.textContent = `${st.lastGps.lat}, ${st.lastGps.lng}  ±${st.lastGps.acc}m`;
      const gp = st.gpsPin;
      if (gp) {
        statusEl.textContent += `  (${parseFloat(gp.style.left).toFixed(0)}, ${parseFloat(gp.style.top).toFixed(0)})`;
      }
    },
    (err) => {
      if (err.code === 1) {
        statusEl.textContent = "Location denied — enable in browser settings";
      } else {
        statusEl.textContent = `GPS error: ${err.message}`;
      }
    },
    { enableHighAccuracy: true },
  );
  refreshCompass();
  refreshScaleBar();
}

/* --- Compass button wiring --- */
if (navigator.geolocation && compassBtn) {
  compassBtn.classList.remove("hidden");
  compassBtn.addEventListener("click", () => {
    if (st.watchId !== null) {
      stopTracking();
    } else {
      startTracking();
    }
  });
}
