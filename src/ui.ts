/* ============================================================
 * ui — Top-level UI wiring: menu, info dialog, camera, map
 * mode, body click (pin placement), button disable state,
 * and clear trail.
 * ============================================================ */

import {
  menuBtn,
  panel,
  overlay,
  infoBtn,
  infoDialog,
  infoOverlay,
  infoCloseBtn,
  cameraBtn,
  fileInput,
  compassBtn,
  mapBtn,
  unitsBtn,
  rotationBtn,
  st,
  debugLatInput,
  debugLonInput,
  debugAccInput,
  pinContainer,
  mapBg,
} from "./state.js";
import { placePin, updateDistanceDisplay, startReplay, stopReplay, cyclePathStyle, redrawPath } from "./pins.js";
import { removeGpsPin, startTracking, updateGpsPin, updateOffscreenIndicator } from "./gps.js";
import { refreshScaleBar } from "./scale.js";
import { showElevation, hideElevation, updateElevation } from "./elevation.js";
import { VERSION } from "./version.js";

function toggleMenu(open?: boolean) {
  const isOpen = open ?? !panel?.classList.contains("open");
  panel?.classList.toggle("open", isOpen);
  overlay?.classList.toggle("open", isOpen);
}

function toggleInfo(open?: boolean) {
  const isOpen = open ?? !infoDialog?.classList.contains("open");
  infoDialog?.classList.toggle("open", isOpen);
  infoOverlay?.classList.toggle("open", isOpen);
}

/* --- Menu toggle + overlay dismiss --- */
menuBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMenu();
});
panel?.addEventListener("click", (e) => e.stopPropagation());
overlay?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMenu(false);
});

/* --- Info dialog open/close --- */
infoBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMenu(false);
  toggleInfo(true);
});
infoDialog?.addEventListener("click", (e) => e.stopPropagation());
infoCloseBtn?.addEventListener("click", () => toggleInfo(false));
infoOverlay?.addEventListener("click", () => toggleInfo(false));

/* --- Camera: trigger hidden file input --- */
cameraBtn?.addEventListener("click", () => fileInput.click());

/* --- On image select: set background, reset GPS state, enable buttons --- */
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    removeGpsPin();
    st.lastFpLat = null;
    st.lastFpLng = null;
    st.lastFpAcc = null;
    st.fpBuffer = [];
    st.rotation = 0;
    st.zoom = 1;
    st.panX = 0;
    st.panY = 0;
    applyZoom();
    st.originalImage = reader.result as string;
    const titleEl = document.getElementById("appTitle");
    if (titleEl) titleEl.style.display = "none";
    applyRotation();
    if (st.watchId === null) startTracking();
    st.mapMode = true;
    mapBtn?.classList.add("active");
    menuBtn?.classList.add("active");
  };
  reader.readAsDataURL(file);
});

/* --- Map Mode: requires GPS to be active --- */
mapBtn?.addEventListener("click", () => {
  if (st.watchId === null) {
    if (st.mapMode) {
      st.mapMode = false;
      mapBtn!.classList.remove("active");
      menuBtn?.classList.remove("active");
    }
    return;
  }
  st.mapMode = !st.mapMode;
  mapBtn!.classList.toggle("active", st.mapMode);
  if (st.mapMode) {
    menuBtn?.classList.add("active");
  } else {
    menuBtn?.classList.remove("active");
  }
});

/* --- Units toggle: switch between metric (m/km) and imperial (mi) --- */
const unitsBtnEl = unitsBtn;
unitsBtnEl?.addEventListener("click", () => {
  st.unit = st.unit === "metric" ? "imperial" : "metric";
  unitsBtnEl.classList.toggle("active", st.unit === "imperial");
  refreshScaleBar();
  updateDistanceDisplay();
  updateOffscreenIndicator();
  updateElevation();
});

/* --- Image rotation: 90° counter-clockwise via canvas --- */
function applyRotation() {
  if (!st.originalImage) return;
  const img = new Image();
  img.onload = () => {
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

const rotationBtnEl = rotationBtn;
rotationBtnEl?.addEventListener("click", () => {
  st.rotation = (st.rotation - 90 + 360) % 360;
  applyRotation();
});

/* Disables GPS and Map buttons until a photo is loaded. */
function updateButtonsDisabledState() {
  const hasPhoto = !!mapBg.style.backgroundImage;
  for (const btn of [compassBtn, rotationBtn]) {
    if (btn) {
      if (hasPhoto) btn.removeAttribute("disabled");
      else btn.setAttribute("disabled", "");
    }
  }
  if (mapBtn) {
    if (hasPhoto && st.watchId !== null) mapBtn.removeAttribute("disabled");
    else mapBtn.setAttribute("disabled", "");
  }
}
updateButtonsDisabledState();

/* --- Body click: place a reference pin (zoom-adjusted) --- */
document.body.addEventListener("click", (e: MouseEvent) => {
  if (!mapBg.style.backgroundImage) return;
  if (!st.mapMode) return;
  let gps = st.lastGps ?? undefined;
  if (st.debugActive) {
    const lat = parseFloat(debugLatInput.value);
    const lng = parseFloat(debugLonInput.value);
    if (!isNaN(lat) && !isNaN(lng)) {
      const acc = parseFloat(debugAccInput.value) || 10;
      gps = { lat: lat.toFixed(6), lng: lng.toFixed(6), acc: acc.toFixed(0) };
    }
  }
  const [docX, docY] = screenToDoc(e.clientX, e.clientY);
  placePin(docX, docY, gps);
  if (gps) {
    const lat = parseFloat(gps.lat);
    const lng = parseFloat(gps.lng);
    if (!isNaN(lat) && !isNaN(lng)) updateGpsPin(lat, lng, gps.acc);
  }
});

/* --- Clear trail: remove all footprints after confirmation --- */
document.getElementById("clearFpBtn")?.addEventListener("click", () => {
  if (
    confirm(
      "Clear the trail?\n\nThis will permanently erase every footprint from your map. All tracked footsteps will be removed, but your reference map pins will be kept.\n\nThis cannot be undone. Continue?",
    )
  ) {
    pinContainer.querySelectorAll('svg[data-type="footprint"]').forEach((el) => el.remove());
    st.lastFpLat = null;
    st.lastFpLng = null;
    st.lastFpAcc = null;
    st.fpBuffer = [];
    st.totalDistanceM = 0;
    st.gapBeforeNextFp = false;
    updateDistanceDisplay();
    redrawPath();
    updateElevation();
  }
});

/* --- Replay trail button --- */
document.getElementById("replayBtn")?.addEventListener("click", startReplay);

/* --- Top stop button while replaying --- */
document.getElementById("replayTopBtn")?.addEventListener("click", stopReplay);

/* --- Version display --- */
const verEl = document.getElementById("versionDisplay");
if (verEl) verEl.textContent = `v${VERSION}`;

/* --- Path style toggle --- */
document.getElementById("pathStyleBtn")?.addEventListener("click", cyclePathStyle);

/* --- Elevation profile toggle --- */
document.getElementById("elevationBtn")?.addEventListener("click", () => {
  if (st.elevationEnabled) {
    hideElevation();
  } else {
    showElevation();
  }
});

/* ============================================================
 * Pinch-to-zoom & pan
 * ============================================================ */

export function applyZoom() {
  const t = `translate(${st.panX}px, ${st.panY}px) scale(${st.zoom})`;
  mapBg.style.transform = t;
  mapBg.style.transformOrigin = "0 0";
  pinContainer.style.transform = t;
  pinContainer.style.transformOrigin = "0 0";
  pinContainer.style.setProperty("--zoom", st.zoom.toString());
  refreshScaleBar();
}

export function screenToDoc(sx: number, sy: number): [number, number] {
  return [(sx - st.panX) / st.zoom, (sy - st.panY) / st.zoom];
}

function getTouchDist(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(t1: Touch, t2: Touch): [number, number] {
  return [(t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2];
}

/* --- Touch: pan (1 finger) & pinch-zoom (2 fingers) --- */
mapBg.addEventListener("touchstart", (e: TouchEvent) => {
  if (!mapBg.style.backgroundImage) return;
  if (e.touches.length === 1) {
    st.isPanning = true;
    st.isPinching = false;
    st.panStartX = st.panX;
    st.panStartY = st.panY;
    st.panStartMouseX = e.touches[0].clientX;
    st.panStartMouseY = e.touches[0].clientY;
  } else if (e.touches.length === 2) {
    st.isPinching = true;
    st.isPanning = false;
    st.pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
    st.pinchStartZoom = st.zoom;
    const [cx, cy] = getTouchCenter(e.touches[0], e.touches[1]);
    st.pinchCenterDocX = (cx - st.panX) / st.zoom;
    st.pinchCenterDocY = (cy - st.panY) / st.zoom;
  }
});

mapBg.addEventListener("touchmove", (e: TouchEvent) => {
  if (!mapBg.style.backgroundImage) return;
  if (st.isPanning && e.touches.length === 1) {
    st.panX = st.panStartX + (e.touches[0].clientX - st.panStartMouseX);
    st.panY = st.panStartY + (e.touches[0].clientY - st.panStartMouseY);
    applyZoom();
  } else if (st.isPinching && e.touches.length >= 2) {
    const dist = getTouchDist(e.touches[0], e.touches[1]);
    if (dist < 5) return;
    const scale = dist / st.pinchStartDist;
    let newZoom = st.pinchStartZoom * scale;
    newZoom = Math.max(0.25, Math.min(10, newZoom));
    st.zoom = newZoom;
    const [cx, cy] = getTouchCenter(e.touches[0], e.touches[1]);
    st.panX = cx - st.pinchCenterDocX * st.zoom;
    st.panY = cy - st.pinchCenterDocY * st.zoom;
    applyZoom();
  }
});

let _touchendTimeout: ReturnType<typeof setTimeout> | null = null;
mapBg.addEventListener("touchend", () => {
  if (_touchendTimeout) clearTimeout(_touchendTimeout);
  _touchendTimeout = setTimeout(() => {
    st.isPanning = false;
    st.isPinching = false;
  }, 80);
});

/* --- Mouse wheel zoom (desktop) --- */
mapBg.addEventListener("wheel", (e: WheelEvent) => {
  if (!mapBg.style.backgroundImage) return;
  e.preventDefault();
  const delta = -e.deltaY * 0.001;
  const newZoom = Math.max(0.25, Math.min(10, st.zoom * (1 + delta)));
  const docX = (e.clientX - st.panX) / st.zoom;
  const docY = (e.clientY - st.panY) / st.zoom;
  st.zoom = newZoom;
  st.panX = e.clientX - docX * st.zoom;
  st.panY = e.clientY - docY * st.zoom;
  applyZoom();
}, { passive: false });
