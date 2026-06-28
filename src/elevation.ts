/* ============================================================
 * elevation — Elevation profile panel (bottom ⅓ of viewport).
 *
 * Reads `data-alt` from footprint elements, renders a
 * distance‑vs‑altitude polyline, and on hover highlights the
 * corresponding footprint on the map.
 * ============================================================ */

import { st, pinContainer } from "./state.js";
import { gpsDistanceMeters } from "./pins.js";

const PANEL_ID = "elevationPanel";
const CHART_ID = "elevationChart";
const CLOSE_ID = "elevationCloseBtn";

/* ── Data helpers ─────────────────────────────────────── */

function getFootprintData(): { dist: number; alt: number; el: SVGElement }[] {
  const fps = pinContainer.querySelectorAll<SVGElement>('svg[data-type="footprint"]');
  const data: { lat: number; lng: number; alt: number; el: SVGElement }[] = [];
  fps.forEach((el) => {
    const lat = parseFloat(el.dataset.lat ?? "");
    const lng = parseFloat(el.dataset.lng ?? "");
    const alt = parseFloat(el.dataset.alt ?? "0");
    if (isNaN(lat) || isNaN(lng)) return;
    data.push({ lat, lng, alt, el });
  });
  if (data.length < 2) return [];

  // Accumulate distance
  let cumDist = 0;
  const result: { dist: number; alt: number; el: SVGElement }[] = [{ dist: 0, alt: data[0].alt, el: data[0].el }];
  for (let i = 1; i < data.length; i++) {
    cumDist += gpsDistanceMeters(data[i - 1].lat, data[i - 1].lng, data[i].lat, data[i].lng);
    result.push({ dist: cumDist, alt: data[i].alt, el: data[i].el });
  }
  return result;
}

/* ── Map highlight ────────────────────────────────────── */

function clearHighlight() {
  pinContainer.querySelectorAll<SVGElement>('svg[data-type="footprint"][data-highlighted]').forEach((el) => {
    const c = el.querySelector("circle");
    if (c) { c.style.stroke = "#FF5A00"; c.style.strokeWidth = "1.5"; }
    el.removeAttribute("data-highlighted");
  });
}

function highlightFootprint(el: SVGElement) {
  clearHighlight();
  el.dataset.highlighted = "1";
  const c = el.querySelector("circle");
  if (c) { c.style.stroke = "#22c55e"; c.style.strokeWidth = "3"; }
}

/* ── Chart rendering ──────────────────────────────────── */

let _svgEl: SVGSVGElement | null = null;
let _crosshair: SVGLineElement | null = null;
let _tooltipEl: HTMLDivElement | null = null;

type ChartDatum = { dist: number; alt: number; el: SVGElement };

function renderChart(data: ChartDatum[]) {
  const container = document.getElementById(CHART_ID);
  if (!container) return;

  // Build / rebuild SVG
  const ns = "http://www.w3.org/2000/svg";
  if (_svgEl) _svgEl.remove();
  _svgEl = document.createElementNS(ns, "svg");
  _svgEl.style.cssText = "display:block;width:100%;height:100%;";
  const containerRect = container.getBoundingClientRect();
  const vbH = 100;
  const vbW = Math.max(vbH, Math.round(vbH * containerRect.width / containerRect.height));
  _svgEl.setAttribute("viewBox", `0 0 ${vbW} ${vbH}`);
  _svgEl.setAttribute("preserveAspectRatio", "none");
  container.appendChild(_svgEl);

  // Crosshair line (drawn once, moved on hover)
  _crosshair = document.createElementNS(ns, "line");
  _crosshair.setAttribute("y1", "0");
  _crosshair.setAttribute("y2", vbH.toString());
  _crosshair.style.stroke = "rgba(255,255,255,0.7)";
  _crosshair.style.strokeWidth = "1";
  _crosshair.style.display = "none";
  _svgEl.appendChild(_crosshair);

  if (data.length < 2) return;

  // Axis padding in viewBox units
  const padL = 8, padR = 4, padT = 6, padB = 12;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;

  const minAlt = Math.min(...data.map((d) => d.alt));
  const maxAlt = Math.max(...data.map((d) => d.alt));
  const altRange = maxAlt - minAlt || 1;
  const maxDist = data[data.length - 1].dist || 1;

  const pts = data.map((d) => {
    const x = padL + (d.dist / maxDist) * plotW;
    const y = padT + (1 - (d.alt - minAlt) / altRange) * plotH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const polyline = document.createElementNS(ns, "polyline");
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "#FF5A00");
  polyline.setAttribute("stroke-width", "0.6");
  polyline.setAttribute("stroke-linejoin", "round");
  polyline.setAttribute("points", pts.join(" "));
  _svgEl.appendChild(polyline);

  // Labels
  function makeLabel(x: number, y: number, text: string, anchor: string) {
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", x.toString());
    t.setAttribute("y", y.toString());
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("fill", "rgba(255,255,255,0.8)");
    t.setAttribute("font-size", "4");
    t.setAttribute("font-family", "monospace");
    t.textContent = text;
    _svgEl!.appendChild(t);
  }

  makeLabel(padL, vbH - 2, formatDist(0), "start");
  makeLabel(vbW - padR, vbH - 2, formatDist(maxDist), "end");
  makeLabel(padL, padT - 1, `${maxAlt.toFixed(0)}m`, "start");
  makeLabel(padL, vbH - padB + 1, `${minAlt.toFixed(0)}m`, "start");

  /* ── Hover ──────────────────────────────────────────── */
  _svgEl.onmousemove = (e: MouseEvent) => {
    const rect = (_svgEl as SVGSVGElement).getBoundingClientRect();
    const fracX = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(fracX * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));

    if (_crosshair) {
      _crosshair.setAttribute("x1", (padL + (data[clamped].dist / maxDist) * plotW).toFixed(2));
      _crosshair.setAttribute("x2", (padL + (data[clamped].dist / maxDist) * plotW).toFixed(2));
      _crosshair.style.display = "block";
    }

    highlightFootprint(data[clamped].el);

    // Tooltip
    if (!_tooltipEl) {
      _tooltipEl = document.createElement("div");
      _tooltipEl.style.cssText = "position:absolute;pointer-events:none;font:bold 12px/1 monospace;color:#fff;background:rgba(0,0,0,0.75);padding:3px 6px;border-radius:3px;white-space:nowrap;z-index:2;";
      container.appendChild(_tooltipEl);
    }
    const d = data[clamped];
    _tooltipEl.textContent = `${formatDist(d.dist)}  ${d.alt.toFixed(0)}m`;
    _tooltipEl.style.left = `${Math.min(e.clientX - rect.left + 8, rect.width - 80)}px`;
    _tooltipEl.style.top = `${Math.max(e.clientY - rect.top - 28, 2)}px`;
  };

  _svgEl.onmouseleave = () => {
    if (_crosshair) _crosshair.style.display = "none";
    if (_tooltipEl) _tooltipEl.style.display = "none";
    clearHighlight();
  };
}

function formatDist(m: number): string {
  if (st.unit === "imperial") {
    const ft = m * 3.28084;
    return ft >= 528 ? `${(ft / 5280).toFixed(1)} mi` : `${ft.toFixed(0)} ft`;
  }
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m.toFixed(0)} m`;
}

/* ── Public API ───────────────────────────────────────── */

export function showElevation() {
  st.elevationEnabled = true;
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.style.display = "block";
  const btn = document.getElementById("elevationBtn");
  if (btn) btn.classList.add("active");
  updateElevation();
}

export function hideElevation() {
  st.elevationEnabled = false;
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.style.display = "none";
  const btn = document.getElementById("elevationBtn");
  if (btn) btn.classList.remove("active");
  if (_svgEl) { _svgEl.remove(); _svgEl = null; }
  if (_tooltipEl) { _tooltipEl.remove(); _tooltipEl = null; }
  clearHighlight();
}

export function updateElevation() {
  if (!st.elevationEnabled) return;
  const data = getFootprintData();
  renderChart(data);
}

/* --- Close button --- */
document.getElementById(CLOSE_ID)?.addEventListener("click", hideElevation);
