/* ============================================================
 * ui — Top-level UI wiring: menu, info dialog, camera, map
 * mode, body click (pin placement), button disable state,
 * and clear trail.
 * ============================================================ */

import { menuBtn, panel, overlay, infoBtn, infoDialog, infoOverlay, infoCloseBtn, cameraBtn, fileInput, compassBtn, mapBtn, unitsBtn, st, debugLatInput, debugLonInput, debugAccInput, pinContainer } from "./state.js";
import { placePin } from "./pins.js";
import { removeGpsPin } from "./gps.js";
import { refreshScaleBar } from "./scale.js";

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
menuBtn?.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
panel?.addEventListener("click", (e) => e.stopPropagation());
overlay?.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(false); });

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
    document.body.style.backgroundImage = `url(${reader.result})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
    updateButtonsDisabledState();
  };
  reader.readAsDataURL(file);
});

/* --- Map Mode toggle: allows pin placement without GPS --- */
mapBtn?.addEventListener("click", () => {
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
});

/* Disables GPS and Map buttons until a photo is loaded. */
function updateButtonsDisabledState() {
  const hasPhoto = !!document.body.style.backgroundImage;
  if (compassBtn) {
    if (hasPhoto) compassBtn.removeAttribute("disabled");
    else compassBtn.setAttribute("disabled", "");
  }
  if (mapBtn) {
    if (hasPhoto) mapBtn.removeAttribute("disabled");
    else mapBtn.setAttribute("disabled", "");
  }
}
updateButtonsDisabledState();

/* --- Body click: place a reference pin --- */
document.body.addEventListener("click", (e: MouseEvent) => {
  if (!document.body.style.backgroundImage) return;
  if (st.watchId === null && !st.debugActive && !st.mapMode) return;
  let gps = st.lastGps ?? undefined;
  if (st.debugActive) {
    const lat = parseFloat(debugLatInput.value);
    const lng = parseFloat(debugLonInput.value);
    if (!isNaN(lat) && !isNaN(lng)) {
      const acc = parseFloat(debugAccInput.value) || 10;
      gps = { lat: lat.toFixed(6), lng: lng.toFixed(6), acc: acc.toFixed(0) };
    }
  }
  placePin(e.clientX, e.clientY, gps);
});

/* --- Clear trail: remove all footprints after confirmation --- */
document.getElementById("clearFpBtn")?.addEventListener("click", () => {
  if (confirm("Clear the trail?\n\nThis will permanently erase every footprint from your map. All tracked footsteps will be removed, but your reference map pins will be kept.\n\nThis cannot be undone. Continue?")) {
    pinContainer.querySelectorAll('svg[data-type="footprint"]').forEach(el => el.remove());
    st.lastFpLat = null;
    st.lastFpLng = null;
  }
});
