/* ============================================================
 * debug — Simulated GPS input for local testing.
 *
 * Only available on localhost/127.0.0.1. Provides manual
 * lat/lng/acc input fields that drive the same GPS pin
 * and footprint logic as real GPS tracking.
 * ============================================================ */

import { st, testBtn, debugPanel, debugLatInput, debugLonInput, debugAccInput, statusEl, isLocal } from "./state.js";
import { placeFootprint } from "./pins.js";
import { updateGpsPin, removeGpsPin, resetGpsTimeout, setGpsPinColor } from "./gps.js";

/* Hide debug controls on the live site; only show them locally. */
if (!isLocal) {
  testBtn?.classList.add("hidden");
  debugPanel?.classList.add("hidden");
}

/** Reads the manual lat/lng/acc inputs, places accuracy-circle
 *  footprints at GPS-distance-threshold intervals, and updates
 *  the green GPS pin. Called on each input change and every 1s
 *  while debug mode is active. */
function updateDebugGps() {
  if (st.watchId === null || !st.debugGpsEnabled) return;
  resetGpsTimeout();
  const lat = parseFloat(debugLatInput.value);
  const lng = parseFloat(debugLonInput.value);
  if (isNaN(lat) || isNaN(lng)) return;
  const acc = parseFloat(debugAccInput.value) || 10;
  placeFootprint(lat, lng, acc);
  updateGpsPin(lat, lng, acc.toFixed(0));
  statusEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}  ±${acc}m`;
  const gp = st.gpsPin;
  if (gp) {
    statusEl.textContent += `  (${parseFloat(gp.style.left).toFixed(0)}, ${parseFloat(gp.style.top).toFixed(0)})`;
  }
}

/* --- Debug button: toggles simulated GPS mode --- */
if (testBtn && isLocal) {
  testBtn.addEventListener("click", () => {
    st.debugActive = !st.debugActive;
    testBtn!.classList.toggle("active", st.debugActive);
    debugPanel.classList.toggle("hidden", !st.debugActive);
    if (st.debugActive) {
      updateDebugGps();
      st.debugInterval = setInterval(updateDebugGps, 1000);
    } else {
      if (st.debugInterval) {
        clearInterval(st.debugInterval);
        st.debugInterval = null;
      }
      if (st.watchId !== null && st.lastGps) {
        const lat = parseFloat(st.lastGps.lat);
        const lng = parseFloat(st.lastGps.lng);
        updateGpsPin(lat, lng, st.lastGps.acc);
        statusEl.textContent = `${st.lastGps.lat}, ${st.lastGps.lng}  ±${st.lastGps.acc}m`;
        const gp2 = st.gpsPin;
        if (gp2) {
          statusEl.textContent += `  (${parseFloat(gp2.style.left).toFixed(0)}, ${parseFloat(gp2.style.top).toFixed(0)})`;
        }
      } else {
        removeGpsPin();
        statusEl.style.display = "none";
      }
    }
  });
}

/* --- Wire debug GPS toggle (local only) --- */
if (isLocal) {
  const toggleBtn = document.getElementById("debugGpsToggle") as HTMLButtonElement;
  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      st.debugGpsEnabled = !st.debugGpsEnabled;
      toggleBtn.classList.toggle("active", st.debugGpsEnabled);
      toggleBtn.textContent = st.debugGpsEnabled ? "GPS Updates: ON" : "GPS Updates: OFF";
      if (st.debugGpsEnabled) {
        updateDebugGps();
      }
    });
  }
}

/* --- Wire live input events (local only) --- */
if (isLocal) {
  debugPanel.addEventListener("click", (e) => e.stopPropagation());
  debugLatInput.addEventListener("input", updateDebugGps);
  debugLonInput.addEventListener("input", updateDebugGps);
  debugAccInput.addEventListener("input", updateDebugGps);
}
