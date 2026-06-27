import { st, pinContainer, mapBg } from "./state.js";
import { createPinSvg, redrawPath } from "./pins.js";
import { showElevation, hideElevation, updateElevation } from "./elevation.js";
import { refreshScaleBar } from "./scale.js";
import { gpsToPixel, accToPixelRadius, getTransformCoeffs } from "./transform.js";
import { applyZoom } from "./ui.js";

const DATA_KEY = "hikenow-save";
const IMAGE_KEY = "hikenow-save-image";

interface RefPinData {
  lat: string;
  lng: string;
  acc: string;
  adjLat: string;
  adjLng: string;
  x: number;
  y: number;
}

interface FpData {
  lat: number;
  lng: number;
  acc: number;
  alt?: number;
}

interface SaveData {
  version: 1;
  view: { zoom: number; panX: number; panY: number };
  settings: {
    unit: "metric" | "imperial";
    pathStyle: "circles" | "line" | "both";
    elevationEnabled: boolean;
    mapMode: boolean;
  };
  refPins: RefPinData[];
  footprints: FpData[];
  totalDistanceM: number;
  rotation: number;
}

function collectSaveData(): SaveData {
  const refPins: RefPinData[] = [];
  pinContainer.querySelectorAll<SVGElement>('svg[data-lat]:not([data-type="footprint"])').forEach((svg) => {
    refPins.push({
      lat: svg.dataset.lat ?? "",
      lng: svg.dataset.lng ?? "",
      acc: svg.dataset.acc ?? "",
      adjLat: svg.dataset.adjLat ?? svg.dataset.lat ?? "",
      adjLng: svg.dataset.adjLng ?? svg.dataset.lng ?? "",
      x: parseFloat(svg.style.left),
      y: parseFloat(svg.style.top),
    });
  });

  const footprints: FpData[] = [];
  pinContainer.querySelectorAll<SVGElement>('svg[data-type="footprint"]').forEach((svg) => {
    const alt = svg.dataset.alt;
    footprints.push({
      lat: parseFloat(svg.dataset.lat!),
      lng: parseFloat(svg.dataset.lng!),
      acc: parseFloat(svg.dataset.acc!),
      ...(alt !== undefined ? { alt: parseFloat(alt) } : {}),
    });
  });

  return {
    version: 1,
    view: { zoom: st.zoom, panX: st.panX, panY: st.panY },
    settings: {
      unit: st.unit,
      pathStyle: st.pathStyle,
      elevationEnabled: st.elevationEnabled,
      mapMode: st.mapMode,
    },
    refPins,
    footprints,
    totalDistanceM: st.totalDistanceM,
    rotation: st.rotation,
  };
}

export function autoSave() {
  const data = collectSaveData();
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    // silent fail for autosave
  }
}

export function saveState() {
  const data = collectSaveData();

  try {
    localStorage.setItem(IMAGE_KEY, JSON.stringify({ data: st.originalImage }));
  } catch (e) {
    showToast("Save failed — storage may be full");
    return;
  }

  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    showToast("Saved");
  } catch (e) {
    showToast("Save failed — storage may be full");
  }
}

export function restoreState() {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) { showToast("No saved state found"); return; }

  let data: SaveData;
  try { data = JSON.parse(raw); } catch { showToast("Save data corrupted"); return; }

  // Clear current DOM state
  pinContainer.querySelectorAll("svg").forEach((el) => el.remove());
  mapBg.style.backgroundImage = "";

  // Reset runtime state
  st.lastFpLat = null;
  st.lastFpLng = null;
  st.lastFpAcc = null;
  st.lastFpEl = null;
  st.fpBuffer = [];

  // --- Extract image data ---
  let imageData: string | null = null;
  let rotation = 0;

  const imageRaw = localStorage.getItem(IMAGE_KEY);
  if (imageRaw) {
    try {
      const img = JSON.parse(imageRaw);
      imageData = img.data ?? null;
    } catch {}
  }

  // Fall back to old embedded-image format
  if (!imageData) {
    try {
      const old = JSON.parse(raw);
      if (old.image && old.image.data) {
        imageData = old.image.data;
        rotation = old.image.rotation ?? 0;
      }
    } catch {}
  } else {
    rotation = data.rotation ?? 0;
  }

  // Restore image
  st.originalImage = imageData;
  st.rotation = rotation;
  if (st.originalImage) {
    applyRotation();
    const titleEl = document.getElementById("appTitle");
    if (titleEl) titleEl.style.display = "none";
  }

  // Restore zoom / pan
  st.zoom = data.view.zoom;
  st.panX = data.view.panX;
  st.panY = data.view.panY;
  applyZoom();

  // Restore settings
  st.unit = data.settings.unit;
  st.pathStyle = data.settings.pathStyle;
  st.elevationEnabled = data.settings.elevationEnabled;
  st.mapMode = data.settings.mapMode;
  st.totalDistanceM = data.totalDistanceM;

  const ns = "http://www.w3.org/2000/svg";

  // Restore reference pins
  for (const p of data.refPins) {
    const svg = createPinSvg(p.x, p.y, "#FF5A00", true, { lat: p.lat, lng: p.lng, acc: p.acc });
    svg.dataset.adjLat = p.adjLat;
    svg.dataset.adjLng = p.adjLng;
    pinContainer.appendChild(svg);
  }

  // Show accuracy circles if transform is ready
  const hasTransform = getTransformCoeffs() !== null;
  if (hasTransform) {
    pinContainer.querySelectorAll<SVGElement>('svg[data-lat]:not([data-type="footprint"])').forEach((pin) => showAccCircle(pin));
    refreshScaleBar();
  }

  // Restore footprints
  for (const f of data.footprints) {
    const r = Math.max(accToPixelRadius(f.acc), 2);
    const svg = document.createElementNS(ns, "svg");
    svg.dataset.type = "footprint";
    svg.dataset.lat = f.lat.toFixed(6);
    svg.dataset.lng = f.lng.toFixed(6);
    svg.dataset.acc = f.acc.toFixed(0);
    if (f.alt !== undefined) svg.dataset.alt = f.alt.toFixed(0);
    svg.style.cssText = `position:absolute;left:0;top:0;width:${r * 2 + 10}px;height:${r * 2 + 10}px;pointer-events:none;z-index:4;`;
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
  }

  // Reposition footprints via transform
  pinContainer.querySelectorAll<SVGElement>('svg[data-type="footprint"]').forEach((svg) => {
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
    const c = svg.querySelector("circle")!;
    c.setAttribute("cx", (r + 5).toString());
    c.setAttribute("cy", (r + 5).toString());
    c.setAttribute("r", r.toString());
  });

  redrawPath();
  updateElevation();
  if (data.settings.elevationEnabled) showElevation(); else hideElevation();

  updateDistanceDisplay();
  updateMapModeUI();
  updatePathStyleUI();
  updateButtonsDisabledState();
  showToast("Restored");
}

/* --- helpers duplicated from pins.ts / ui.ts to avoid over-exporting --- */

function showAccCircle(pin: SVGElement) {
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

function applyRotation() {
  if (!st.originalImage) return;
  const img = new Image();
  img.onload = () => {
    st.imageNaturalWidth = img.naturalWidth;
    st.imageNaturalHeight = img.naturalHeight;
    const canvas = document.createElement("canvas");
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (st.rotation === 90 || st.rotation === 270) {
      canvas.width = h;
      canvas.height = w;
    } else {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((st.rotation * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2);
    mapBg.style.backgroundImage = `url(${canvas.toDataURL("image/jpeg", 0.92)})`;
    updateButtonsDisabledState();
  };
  img.src = st.originalImage;
}

function updateDistanceDisplay() {
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

function updateMapModeUI() {
  if (st.mapMode) {
    mapBtn()?.classList.add("active");
    menuBtn()?.classList.add("active");
  } else {
    mapBtn()?.classList.remove("active");
    menuBtn()?.classList.remove("active");
  }
}

function updateButtonsDisabledState() {
  const hasPhoto = !!mapBg.style.backgroundImage;
  for (const btn of [document.getElementById("compassBtn"), document.getElementById("rotationBtn")]) {
    if (btn) {
      if (hasPhoto) btn.removeAttribute("disabled");
      else btn.setAttribute("disabled", "");
    }
  }
  const mapBtnEl = document.getElementById("mapBtn");
  if (mapBtnEl) {
    if (hasPhoto && st.watchId !== null) mapBtnEl.removeAttribute("disabled");
    else mapBtnEl.setAttribute("disabled", "");
  }
}

function updatePathStyleUI() {
  const btn = document.getElementById("pathStyleBtn");
  if (!btn) return;
  const labels: Record<string, string> = { circles: "Circles only", line: "Line only", both: "Circles + line" };
  btn.title = labels[st.pathStyle];
  const dot = btn.querySelector(".path-dot") as HTMLElement;
  const slash = btn.querySelector(".path-slash") as HTMLElement;
  if (dot) dot.style.display = st.pathStyle !== "line" ? "" : "none";
  if (slash) slash.style.display = st.pathStyle !== "circles" ? "" : "none";
}

function menuBtn() { return document.getElementById("menuBtn"); }

function mapBtn() { return document.getElementById("mapBtn"); }

/* --- Toast --- */
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
