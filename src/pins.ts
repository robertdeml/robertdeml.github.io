/* ============================================================
 * pins — Pin creation, placement, toolbar interaction, and
 * accuracy circle rendering.
 *
 * Reference pins are placed by the user on recognizable
 * features. Footprints are auto-dropped by GPS tracking.
 * The pin toolbar shows GPS info, nudger arrows, NSEW
 * 1-meter adjustments, copy, and delete.
 * ============================================================ */

import { st, pinContainer, pinToolbar, pinOverlay, pinGpsInfo, gpsAdjRow, pinAdjLatEl, pinAdjLngEl, FUI } from "./state.js";
import { gpsToPixel, accToPixelRadius, getTransformCoeffs, getMetersPerDeg } from "./transform.js";

/** Creates an SVG location-pin element at (x,y).
 *  If `gps` is provided, stores lat/lng/acc as data attributes.
 *  `clickable` controls pointer-events and cursor. */
export function createPinSvg(x: number, y: number, color: string, clickable: boolean, gps?: { lat: string; lng: string; acc: string }) {
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
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0");
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

/** Drops a footprint SVG at the GPS-coordinate-derived pixel position.
 *  Called automatically by GPS tracking when the user moves
 *  more than 20px from the previous footprint. */
export function placeFootprint(gpsLat: number, gpsLng: number) {
  const pos = gpsToPixel(gpsLat, gpsLng);
  if (!pos) return;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.dataset.lat = gpsLat.toFixed(6);
  svg.dataset.lng = gpsLng.toFixed(6);
  svg.style.fill = "none";
  svg.style.stroke = "#FF5A00";
  svg.style.strokeWidth = "2";
  svg.dataset.type = "footprint";
  svg.style.strokeLinecap = "round";
  svg.style.strokeLinejoin = "round";
  svg.style.pointerEvents = "auto";
  svg.style.cursor = "pointer";
  svg.style.position = "absolute";
  svg.style.left = `${pos.x}px`;
  svg.style.top = `${pos.y}px`;
  svg.style.transform = "translate(-50%, -100%)";
  const p1 = document.createElementNS(ns, "path");
  p1.setAttribute("d", "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z");
  svg.appendChild(p1);
  const p2 = document.createElementNS(ns, "path");
  p2.setAttribute("d", "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z");
  svg.appendChild(p2);
  const p3 = document.createElementNS(ns, "path");
  p3.setAttribute("d", "M16 17h4");
  svg.appendChild(p3);
  const p4 = document.createElementNS(ns, "path");
  p4.setAttribute("d", "M4 13h4");
  svg.appendChild(p4);
  pinContainer.appendChild(svg);
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
  const r = accToPixelRadius(acc, adjLat);
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
    if (svg) { svg.remove(); delete (pin as any)._accCircle; }
  } else {
    pinContainer.querySelectorAll("svg[data-lat]").forEach(p => hideAccuracyCircle(p as SVGElement));
  }
}

/** Iterates all reference pins and shows/hides their accuracy
 *  circles depending on whether the affine transform is ready. */
function refreshAccuracyCircles() {
  const hasTransform = getTransformCoeffs() !== null;
  pinContainer.querySelectorAll("svg[data-lat]").forEach(p => {
    const pin = p as SVGElement;
    if (hasTransform) {
      showAccuracyCircle(pin);
    } else {
      hideAccuracyCircle(pin);
    }
  });
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
    const adjLat = pin.dataset.adjLat;
    const adjLng = pin.dataset.adjLng;
    const isAdj = adjLat !== pin.dataset.lat || adjLng !== pin.dataset.lng;
    pinGpsInfo.innerHTML = `<div>Lat: ${pin.dataset.lat}${isAdj ? ` <span style="color:#FF5A00">→ ${adjLat}</span>` : ""}</div><div>Lon: ${pin.dataset.lng}${isAdj ? ` <span style="color:#FF5A00">→ ${adjLng}</span>` : ""}</div><div>Acc: ±${pin.dataset.acc}m</div><div>X: ${x}  Y: ${y}</div>`;
    pinGpsInfo.style.display = "flex";
    copyBtn.style.display = "";
    gpsAdjRow.style.display = "flex";
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
  if (st.activePin === svg) { hideToolbar(); return; }
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
    showToolbar(st.activePin);
  });
});

pinToolbar.addEventListener("click", (e) => e.stopPropagation());
document.getElementById("copyGpsBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!st.activePin || !st.activePin.dataset.lat) return;
  const adjLat = st.activePin.dataset.adjLat ?? st.activePin.dataset.lat;
  const adjLng = st.activePin.dataset.adjLng ?? st.activePin.dataset.lng;
  const text = `Lat: ${st.activePin.dataset.lat}\nLon: ${st.activePin.dataset.lng}\nAdjLat: ${adjLat}\nAdjLng: ${adjLng}\nAcc: ±${st.activePin.dataset.acc}m\nX: ${parseFloat(st.activePin.style.left).toFixed(0)}  Y: ${parseFloat(st.activePin.style.top).toFixed(0)}`;
  navigator.clipboard.writeText(text).catch(() => { /* clipboard not available */ });
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

gpsAdjRow?.querySelectorAll("[data-gps-adj]").forEach(btn => {
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
      case "lat+": adjLat += step / mPerDegLat; break;
      case "lat-": adjLat -= step / mPerDegLat; break;
      case "lng+": adjLng += step / mPerDegLng; break;
      case "lng-": adjLng -= step / mPerDegLng; break;
    }
    clampAndApplyGps(st.activePin, adjLat, adjLng);
  });
});
