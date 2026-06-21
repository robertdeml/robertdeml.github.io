/* ============================================================
 * pins — Pin creation, placement, toolbar interaction, and
 * accuracy circle rendering.
 *
 * Reference pins are placed by the user on recognizable
 * features. Footprints are auto-dropped by GPS tracking.
 * The pin toolbar shows GPS info, nudger arrows, NSEW
 * 1-meter adjustments, copy, and delete.
 * ============================================================ */

import {
  st,
  pinContainer,
  pinToolbar,
  pinOverlay,
  pinGpsInfo,
  gpsAdjRow,
  pinAdjLatEl,
  pinAdjLngEl,
  FUI,
} from "./state.js";
import { gpsToPixel, accToPixelRadius, getTransformCoeffs, getMetersPerDeg } from "./transform.js";
import { refreshScaleBar } from "./scale.js";
import { updateElevation } from "./elevation.js";

/** Creates an SVG location-pin element at (x,y).
 *  If `gps` is provided, stores lat/lng/acc as data attributes.
 *  `clickable` controls pointer-events and cursor. */
export function createPinSvg(
  x: number,
  y: number,
  color: string,
  clickable: boolean,
  gps?: { lat: string; lng: string; acc: string },
) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "32");
  svg.setAttribute("height", "32");
  if (gps) {
    svg.dataset.lat = gps.lat;
    svg.dataset.lng = gps.lng;
    svg.dataset.acc = gps.acc;
    svg.dataset.adjLat = gps.lat;
    svg.dataset.adjLng = gps.lng;
  }
  svg.style.fill = color;
  svg.style.stroke = "none";
  svg.style.pointerEvents = clickable ? "auto" : "none";
  svg.style.cursor = clickable ? "pointer" : "default";
  svg.style.position = "absolute";
  svg.style.left = `${x}px`;
  svg.style.top = `${y}px`;
  svg.style.transform = "translate(-50%, -100%)";
  svg.classList.add("counter-scale");
  const path = document.createElementNS(ns, "path");
  path.setAttribute(
    "d",
    "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
  );
  svg.appendChild(path);
  const circle = document.createElementNS(ns, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "10");
  circle.setAttribute("r", "3");
  circle.style.fill = "#fff";
  svg.appendChild(circle);
  return svg;
}

/** Places an orange reference pin at (x,y) and refreshes
 *  accuracy circles for all existing pins. */
export function placePin(x: number, y: number, gps?: { lat: string; lng: string; acc: string }) {
  const svg = createPinSvg(x, y, "#FF5A00", true, gps);
  pinContainer.appendChild(svg);
  refreshAccuracyCircles();
}

/** Returns approximate GPS distance in meters between two coordinates. */
export function gpsDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const avgLat = (lat1 + lat2) / 2;
  const { mPerDegLat, mPerDegLng } = getMetersPerDeg(avgLat);
  const dLat = (lat2 - lat1) * mPerDegLat;
  const dLng = (lng2 - lng1) * mPerDegLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Places an accuracy circle footprint at the GPS position when the
 *  distance from the last footprint exceeds the sum of accuracies.
 *  Before the affine transform is ready, points are buffered and
 *  replayed once 2+ reference pins are placed. */
export function placeFootprint(gpsLat: number, gpsLng: number, gpsAcc: number, gpsAlt?: number) {
  if (gpsAcc <= 0) return;

  // First point: just record the position
  if (st.lastFpLat === null) {
    st.lastFpLat = gpsLat;
    st.lastFpLng = gpsLng;
    st.lastFpAcc = gpsAcc;
    return;
  }

  const dist = gpsDistanceMeters(st.lastFpLat, st.lastFpLng!, gpsLat, gpsLng);
  if (dist <= st.lastFpAcc! + gpsAcc) return;

  // Accumulate travelled distance (skip across gaps)
  if (!st.gapBeforeNextFp) st.totalDistanceM += dist;
  st.gapBeforeNextFp = false;
  updateDistanceDisplay();

  const pos = gpsToPixel(gpsLat, gpsLng);

  if (!pos) {
    // Transform not ready — buffer for later
    st.fpBuffer.push({ lat: gpsLat, lng: gpsLng, acc: gpsAcc, alt: gpsAlt });
  } else {
    drawAccCircle(gpsLat, gpsLng, gpsAcc, pos.x, pos.y, gpsAlt);
  }

  st.lastFpLat = gpsLat;
  st.lastFpLng = gpsLng;
  st.lastFpAcc = gpsAcc;
}

/** Formats `st.totalDistanceM` in the current unit and updates the
 *  `#distanceDisplay` element in the menu panel. */
export function updateDistanceDisplay() {
  const el = document.getElementById("distanceDisplay");
  if (!el) return;

  const m = st.totalDistanceM;
  let text: string;
  if (st.unit === "imperial") {
    const ft = m * 3.28084;
    text = ft >= 528 ? `${(ft / 5280).toFixed(ft >= 52800 ? 0 : 1)} mi` : `${ft.toFixed(0)} ft`;
  } else {
    text = m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${m.toFixed(m >= 10 ? 0 : 1)} m`;
  }
  const val = document.getElementById("distanceValue");
  if (val) val.textContent = text;
}

/** Draws a single accuracy-circle footprint at the given pixel position. */
function drawAccCircle(lat: number, lng: number, acc: number, px: number, py: number, alt?: number) {
  const ns = "http://www.w3.org/2000/svg";
  const r = Math.max(accToPixelRadius(acc), 2);
  const svg = document.createElementNS(ns, "svg");
  svg.dataset.type = "footprint";
  svg.dataset.lat = lat.toFixed(6);
  svg.dataset.lng = lng.toFixed(6);
  svg.dataset.acc = acc.toFixed(0);
  if (alt !== undefined) svg.dataset.alt = alt.toFixed(0);
  svg.style.cssText = `position:absolute;left:${px - r - 5}px;top:${py - r - 5}px;width:${r * 2 + 10}px;height:${r * 2 + 10}px;pointer-events:none;z-index:4;`;
  const circle = document.createElementNS(ns, "circle");
  circle.setAttribute("cx", (r + 5).toString());
  circle.setAttribute("cy", (r + 5).toString());
  circle.setAttribute("r", r.toString());
  circle.style.fill = "rgba(255, 90, 0, 0.08)";
  circle.style.stroke = "#FF5A00";
  circle.style.strokeWidth = "1.5";
  svg.appendChild(circle);
  if (st.pathStyle === "line") svg.style.display = "none";
  pinContainer.appendChild(svg);
  redrawPath();
  updateElevation();
}

/** Flushes the GPS point buffer once the affine transform is ready.
 *  Each buffered point is drawn as an accuracy-circle footprint. */
function flushFootprintBuffer() {
  const buf = st.fpBuffer;
  st.fpBuffer = [];
  for (const p of buf) {
    const pos = gpsToPixel(p.lat, p.lng);
    if (pos) drawAccCircle(p.lat, p.lng, p.acc, pos.x, pos.y, p.alt);
  }
}

/** Shows a dashed accuracy circle around a GPS-tagged pin.
 *  The radius is derived from the pin's accuracy (meters)
 *  converted to pixels via the affine transform. */
function showAccuracyCircle(pin: SVGElement) {
  hideAccuracyCircle(pin);
  const acc = parseFloat(pin.dataset.acc ?? "");
  const adjLat = parseFloat(pin.dataset.adjLat ?? pin.dataset.lat ?? "");
  if (isNaN(acc) || isNaN(adjLat)) return;
  const x = parseFloat(pin.style.left);
  const y = parseFloat(pin.style.top);
  const r = accToPixelRadius(acc);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.style.cssText = `position:absolute;left:${x - r - 5}px;top:${y - r - 5}px;width:${r * 2 + 10}px;height:${r * 2 + 10}px;pointer-events:none;z-index:4;`;
  const circle = document.createElementNS(ns, "circle");
  circle.setAttribute("cx", (r + 5).toString());
  circle.setAttribute("cy", (r + 5).toString());
  circle.setAttribute("r", Math.max(r, 2).toString());
  circle.style.fill = "rgba(255, 90, 0, 0.08)";
  circle.style.stroke = "#FF5A00";
  circle.style.strokeWidth = "1.5";
  circle.style.strokeDasharray = "4 3";
  svg.appendChild(circle);
  pinContainer.appendChild(svg);
  (pin as any)._accCircle = svg;
}

/** Removes the accuracy circle SVG from a pin (or all pins).
 *  Uses an expando _accCircle reference stored on the pin. */
function hideAccuracyCircle(pin?: SVGElement) {
  if (pin) {
    const svg = (pin as any)._accCircle;
    if (svg) {
      svg.remove();
      delete (pin as any)._accCircle;
    }
  } else {
    pinContainer.querySelectorAll('svg[data-lat]:not([data-type="footprint"])').forEach((p) => hideAccuracyCircle(p as SVGElement));
  }
}

/** Re-positions all footprints from their stored GPS coordinates.
 *  Called after reference pin adjustments that affect the transform. */
function repositionFootprints() {
  pinContainer.querySelectorAll('svg[data-type="footprint"]').forEach((el) => {
    const svg = el as SVGSVGElement;
    const lat = parseFloat(svg.dataset.lat ?? "");
    const lng = parseFloat(svg.dataset.lng ?? "");
    const acc = parseFloat(svg.dataset.acc ?? "");
    if (isNaN(lat) || isNaN(lng) || isNaN(acc)) return;
    const pos = gpsToPixel(lat, lng);
    if (!pos) return;
    const r = Math.max(accToPixelRadius(acc), 2);
    svg.style.left = `${pos.x - r - 5}px`;
    svg.style.top = `${pos.y - r - 5}px`;
    svg.style.width = `${r * 2 + 10}px`;
    svg.style.height = `${r * 2 + 10}px`;
    const circle = svg.querySelector("circle")!;
    circle.setAttribute("cx", (r + 5).toString());
    circle.setAttribute("cy", (r + 5).toString());
    circle.setAttribute("r", r.toString());
  });
}

/** Iterates all reference pins and shows/hides their accuracy
 *  circles depending on whether the affine transform is ready.
 *  When the transform first becomes available, flushed buffered
 *  GPS points as accuracy-circle footprints. */
function refreshAccuracyCircles() {
  const hasTransform = getTransformCoeffs() !== null;
  pinContainer.querySelectorAll('svg[data-lat]:not([data-type="footprint"])').forEach((p) => {
    const pin = p as SVGElement;
    if (hasTransform) {
      showAccuracyCircle(pin);
    } else {
      hideAccuracyCircle(pin);
    }
  });
  refreshScaleBar();
  if (hasTransform) {
    flushFootprintBuffer();
    repositionFootprints();
  }
}

/** Adjusts a pin's GPS coords within its accuracy bounds (clamped),
 *  recalculates its pixel position, and refreshes the toolbar. */
function clampAndApplyGps(pin: SVGElement, newAdjLat: number, newAdjLng: number) {
  const origLat = parseFloat(pin.dataset.lat!);
  const origLng = parseFloat(pin.dataset.lng!);
  const acc = parseFloat(pin.dataset.acc ?? "0");
  if (isNaN(acc) || acc <= 0) return;
  const { mPerDegLat, mPerDegLng } = getMetersPerDeg(origLat);
  const maxDlat = acc / mPerDegLat;
  const maxDlng = acc / mPerDegLng;
  newAdjLat = Math.max(origLat - maxDlat, Math.min(origLat + maxDlat, newAdjLat));
  newAdjLng = Math.max(origLng - maxDlng, Math.min(origLng + maxDlng, newAdjLng));

  const coeffs = getTransformCoeffs();
  if (coeffs) {
    const { a, b, p0 } = coeffs;
    const dLat = newAdjLat - p0.lat;
    const dLng = newAdjLng - p0.lng;
    pin.style.left = `${p0.x + a * dLat - b * dLng}px`;
    pin.style.top = `${p0.y + b * dLat + a * dLng}px`;
  }

  pin.dataset.adjLat = newAdjLat.toFixed(6);
  pin.dataset.adjLng = newAdjLng.toFixed(6);
  refreshAccuracyCircles();
  repositionFootprints();
  showToolbar(pin);
}

/** Updates the lat/lng display spans in the pin toolbar. */
function updateAdjDisplay(pin: SVGElement) {
  pinAdjLatEl.textContent = pin.dataset.adjLat ?? pin.dataset.lat ?? "";
  pinAdjLngEl.textContent = pin.dataset.adjLng ?? pin.dataset.lng ?? "";
}

/** Hides the floating pin toolbar and clears activePin. */
function hideToolbar() {
  pinToolbar.style.display = "none";
  pinOverlay.style.display = "none";
  st.activePin = null;
}

/** Shows the floating pin toolbar positioned next to the given pin.
 *  Displays GPS data if the pin has it, or hides GPS section for
 *  non-GPS pins (e.g. placed in Map Mode). */
function showToolbar(pin: SVGElement) {
  st.activePin = pin;
  pinToolbar.style.display = "flex";
  pinOverlay.style.display = "block";
  const copyBtn = document.getElementById("copyGpsBtn") as HTMLButtonElement;
  if (pin.dataset.lat) {
    const x = parseFloat(pin.style.left).toFixed(0);
    const y = parseFloat(pin.style.top).toFixed(0);
    const adjLat = pin.dataset.adjLat ?? pin.dataset.lat;
    const adjLng = pin.dataset.adjLng ?? pin.dataset.lng;
    const isAdj = adjLat !== pin.dataset.lat || adjLng !== pin.dataset.lng;
    pinGpsInfo.innerHTML = `<div>Lat: ${pin.dataset.lat}${isAdj ? ` <span style="color:#FF5A00">→ ${adjLat}</span>` : ""}</div><div>Lon: ${pin.dataset.lng}${isAdj ? ` <span style="color:#FF5A00">→ ${adjLng}</span>` : ""}</div><div>Acc: ±${pin.dataset.acc}m</div><div>X: ${x}  Y: ${y}</div>`;
    pinGpsInfo.style.display = "flex";
    copyBtn.style.display = "";
    gpsAdjRow.style.display = "none";
    updateAdjDisplay(pin);
  } else {
    pinGpsInfo.innerHTML = "";
    pinGpsInfo.style.display = "none";
    copyBtn.style.display = "none";
    gpsAdjRow.style.display = "none";
  }
  FUI.computePosition(pin, pinToolbar, {
    placement: "right",
    middleware: [FUI.flip({ fallbackPlacements: ["left"] }), FUI.shift({ padding: 8 }), FUI.offset(8)],
  }).then(({ x, y }: { x: number; y: number }) => {
    pinToolbar.style.left = `${x}px`;
    pinToolbar.style.top = `${y}px`;
  });
}

/* --- Event listeners --- */

pinContainer.addEventListener("click", (e) => {
  const svg = (e.target as Element).closest("svg") as SVGElement | null;
  if (!svg) return;
  e.stopPropagation();
  if (st.activePin === svg) {
    hideToolbar();
    return;
  }
  showToolbar(svg);
});

pinToolbar.querySelectorAll("[data-dir]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!st.activePin) return;
    const dir = (btn as HTMLElement).dataset.dir!;
    const left = parseFloat(st.activePin.style.left) || 0;
    const top = parseFloat(st.activePin.style.top) || 0;
    const moves: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = moves[dir];
    st.activePin.style.left = `${left + dx}px`;
    st.activePin.style.top = `${top + dy}px`;
    refreshAccuracyCircles();
    repositionFootprints();
    showToolbar(st.activePin);
  });
});

/** Shows a brief toast overlay message that auto-hides after 2 seconds. */
function showToast(msg: string) {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "toast";
  el.textContent = msg;
  el.style.cssText = "position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:50;background:#333;color:#fff;padding:8px 16px;border-radius:6px;font-family:sans-serif;font-size:13px;pointer-events:none;transition:opacity .2s;";
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 200); }, 2000);
}

pinToolbar.addEventListener("click", (e) => e.stopPropagation());
document.getElementById("copyGpsBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!st.activePin || !st.activePin.dataset.lat) return;
  const adjLat = st.activePin.dataset.adjLat ?? st.activePin.dataset.lat;
  const adjLng = st.activePin.dataset.adjLng ?? st.activePin.dataset.lng;
  const text = `Lat: ${st.activePin.dataset.lat}\nLon: ${st.activePin.dataset.lng}\nAdjLat: ${adjLat}\nAdjLng: ${adjLng}\nAcc: ±${st.activePin.dataset.acc}m\nX: ${parseFloat(st.activePin.style.left).toFixed(0)}  Y: ${parseFloat(st.activePin.style.top).toFixed(0)}`;
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard")).catch(() => {
    /* clipboard not available */
  });
});

pinToolbar.querySelector("[data-trash]")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!st.activePin) return;
  hideAccuracyCircle(st.activePin);
  st.activePin.remove();
  hideToolbar();
  refreshAccuracyCircles();
});

pinOverlay.addEventListener("click", (e) => {
  e.stopPropagation();
  hideToolbar();
});

gpsAdjRow?.querySelectorAll("[data-gps-adj]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!st.activePin || !st.activePin.dataset.lat) return;
    const dir = (btn as HTMLElement).dataset.gpsAdj!;
    const origLat = parseFloat(st.activePin.dataset.lat!);
    const { mPerDegLat, mPerDegLng } = getMetersPerDeg(origLat);
    const step = 1;
    let adjLat = parseFloat(st.activePin.dataset.adjLat ?? st.activePin.dataset.lat!);
    let adjLng = parseFloat(st.activePin.dataset.adjLng ?? st.activePin.dataset.lng!);
    switch (dir) {
      case "lat+":
        adjLat += step / mPerDegLat;
        break;
      case "lat-":
        adjLat -= step / mPerDegLat;
        break;
      case "lng+":
        adjLng += step / mPerDegLng;
        break;
      case "lng-":
        adjLng -= step / mPerDegLng;
        break;
    }
    clampAndApplyGps(st.activePin, adjLat, adjLng);
  });
});

/* ============================================================
 * Trail replay — sequentially reveals footprints in green,
 * then fades them to standard orange.
 * ============================================================ */

/** Creates a green accuracy circle for the replay animation. */
function createReplayCircle(lat: number, lng: number, acc: number, px: number, py: number): SVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const r = Math.max(accToPixelRadius(acc), 2);
  const svg = document.createElementNS(ns, "svg");
  svg.dataset.type = "replay-fp";
  svg.style.cssText = `position:absolute;left:${px - r - 5}px;top:${py - r - 5}px;width:${r * 2 + 10}px;height:${r * 2 + 10}px;pointer-events:none;z-index:6;`;
  const circle = document.createElementNS(ns, "circle");
  circle.setAttribute("cx", (r + 5).toString());
  circle.setAttribute("cy", (r + 5).toString());
  circle.setAttribute("r", r.toString());
  circle.style.fill = "rgba(34, 197, 94, 0.2)";
  circle.style.stroke = "#22c55e";
  circle.style.strokeWidth = "2.5";
  svg.appendChild(circle);
  pinContainer.appendChild(svg);
  return svg;
}

/** Advances the replay animation by one frame. */
function replayTick() {
  if (st.replayCurIndex >= st.replayPositions.length) {
    // All shown — turn last one standard, then clean up
    const last = st.replayEls[st.replayEls.length - 1];
    if (last) { const c = last.querySelector("circle"); if (c) { c.style.fill = "rgba(255, 90, 0, 0.08)"; c.style.stroke = "#FF5A00"; c.style.strokeWidth = "1.5"; } }
    if (st.replayIntervalId !== null) { clearInterval(st.replayIntervalId); st.replayIntervalId = null; }
    st.replayFinishTimeout = setTimeout(() => stopReplay(), 1000);
    return;
  }

  const pos = st.replayPositions[st.replayCurIndex];
  const pixelPos = gpsToPixel(pos.lat, pos.lng);
  if (!pixelPos) { stopReplay(); return; }

  // Previous footprint → standard orange
  if (st.replayCurIndex > 0) {
    const prev = st.replayEls[st.replayCurIndex - 1];
    if (prev) { const c = prev.querySelector("circle"); if (c) { c.style.fill = "rgba(255, 90, 0, 0.08)"; c.style.stroke = "#FF5A00"; c.style.strokeWidth = "1.5"; } }
  }

  // Current → green
  st.replayEls.push(createReplayCircle(pos.lat, pos.lng, pos.acc, pixelPos.x, pixelPos.y));
  st.replayCurIndex++;
}

/** Starts replay animation of the footprint trail.
 *  Toggles: if already playing, stops and restores the map. */
export function startReplay() {
  if (st.replayActive) { stopReplay(); return; }

  const fpEls = pinContainer.querySelectorAll<SVGElement>('svg[data-type="footprint"]');
  if (fpEls.length === 0) {
    showToast("No footprints to replay");
    return;
  }

  // Cache positions and assign sequence numbers
  st.replayPositions = [];
  fpEls.forEach((el) => {
    st.replayPositions.push({
      lat: parseFloat(el.dataset.lat!),
      lng: parseFloat(el.dataset.lng!),
      acc: parseFloat(el.dataset.acc!),
    });
    el.dataset.seq = st.replayPositions.length.toString();
  });

  // Hide everything in pinContainer
  pinContainer.querySelectorAll<HTMLElement>('svg').forEach((el) => {
    el.dataset.replayHidden = "1";
    el.style.display = "none";
  });

  st.replayActive = true;
  st.replayCurIndex = 0;
  st.replayEls = [];

  const topBtn = document.getElementById("replayTopBtn");
  if (topBtn) topBtn.style.display = "flex";

  // Show the first footprint immediately
  replayTick();

  st.replayIntervalId = setInterval(replayTick, 500);
}

/** Stops replay and restores the original map state. */
export function stopReplay() {
  st.replayActive = false;

  if (st.replayFinishTimeout !== null) { clearTimeout(st.replayFinishTimeout); st.replayFinishTimeout = null; }
  if (st.replayIntervalId !== null) { clearInterval(st.replayIntervalId); st.replayIntervalId = null; }

  st.replayEls.forEach((el) => el.remove());
  st.replayEls = [];

  pinContainer.querySelectorAll<HTMLElement>('[data-replay-hidden]').forEach((el) => {
    el.style.display = "";
    el.removeAttribute("data-replay-hidden");
  });

  const topBtn = document.getElementById("replayTopBtn");
  if (topBtn) topBtn.style.display = "none";
}

/* ============================================================
 * Path line — polyline connecting footprint centres.
 * Three modes: circles, line, both.
 * ============================================================ */

function getFpCenter(el: SVGElement): { x: number; y: number } | null {
  const left = parseFloat(el.style.left);
  const top = parseFloat(el.style.top);
  if (isNaN(left) || isNaN(top)) return null;
  const c = el.querySelector("circle");
  if (!c) return null;
  const cx = parseFloat(c.getAttribute("cx") || "0");
  const cy = parseFloat(c.getAttribute("cy") || "0");
  return { x: left + cx, y: top + cy };
}

export function redrawPath() {
  const fps = pinContainer.querySelectorAll<SVGElement>('svg[data-type="footprint"]');
  const show = st.pathStyle !== "circles";

  if (fps.length < 2 || !show) {
    if (st.pathPolyline) st.pathPolyline.style.display = "none";
    return;
  }

  const pts: string[] = [];
  fps.forEach((el) => {
    if (el.style.display === "none") return;
    const c = getFpCenter(el);
    if (c) pts.push(`${c.x},${c.y}`);
  });

  if (pts.length < 2) {
    if (st.pathPolyline) st.pathPolyline.style.display = "none";
    return;
  }

  let svg = st.pathPolyline;
  if (!svg) {
    const ns = "http://www.w3.org/2000/svg";
    svg = document.createElementNS(ns, "svg");
    svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:3;";
    pinContainer.appendChild(svg);
    st.pathPolyline = svg;
  }

  svg.style.display = "block";
  svg.innerHTML = `<polyline fill="none" stroke="rgba(255, 90, 0, 0.45)" stroke-width="3" stroke-linejoin="round" points="${pts.join(" ")}"/>`;
}

/** Cycles the path display style: circles → line → both → circles. */
export function cyclePathStyle() {
  const modes: Array<"circles" | "line" | "both"> = ["circles", "line", "both"];
  const idx = modes.indexOf(st.pathStyle);
  st.pathStyle = modes[(idx + 1) % 3];

  const showCircles = st.pathStyle !== "line";
  pinContainer.querySelectorAll<HTMLElement>('svg[data-type="footprint"]').forEach((el) => {
    el.style.display = showCircles ? "" : "none";
  });

  redrawPath();

  const btn = document.getElementById("pathStyleBtn");
  if (!btn) return;
  const labels: Record<string, string> = { circles: "Circles only", line: "Line only", both: "Circles + line" };
  btn.title = labels[st.pathStyle];

  const dot = btn.querySelector(".path-dot") as HTMLElement;
  const slash = btn.querySelector(".path-slash") as HTMLElement;
  if (dot) dot.style.display = st.pathStyle !== "line" ? "" : "none";
  if (slash) slash.style.display = st.pathStyle !== "circles" ? "" : "none";
}
