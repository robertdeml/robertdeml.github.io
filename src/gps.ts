/* ============================================================
 * gps — Real GPS tracking via Geolocation API.
 *
 * Manages watchPosition lifecycle, renders a green GPS pin
 * + accuracy circle at the transformed pixel location, and
 * auto-drops footprints when the user moves >20px.
 * ============================================================ */

import { st, compassBtn, menuBtn, pinContainer, statusEl } from "./state.js";
import { createPinSvg } from "./pins.js";
import { gpsToPixel, accToPixelRadius } from "./transform.js";
import { placeFootprint } from "./pins.js";

/** Removes the green GPS pin and its accuracy circle from the DOM. */
export function removeGpsPin() {
  if (st.gpsPin) { st.gpsPin.remove(); st.gpsPin = null; }
  if (st.gpsAccCircle) { st.gpsAccCircle.remove(); st.gpsAccCircle = null; }
}

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
}

/** Stops GPS watching, clears state, and removes the GPS pin. */
function stopTracking() {
  if (st.watchId !== null) {
    navigator.geolocation.clearWatch(st.watchId);
    st.watchId = null;
  }
  st.lastGps = null;
  st.lastFpLat = null;
  st.lastFpLng = null;
  removeGpsPin();
  menuBtn?.classList.remove("active");
  compassBtn?.classList.remove("active");
  statusEl.style.display = "none";
}

/** Starts GPS watching with high accuracy. On each position
 *  update, places a green GPS pin, auto-drops footprints
 *  every 20px of movement, and updates the status bar. */
function startTracking() {
  menuBtn?.classList.add("active");
  compassBtn?.classList.add("active");
  statusEl.style.display = "";
  st.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      st.lastGps = {
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
        acc: pos.coords.accuracy.toFixed(0),
      };
      if (st.debugActive) return;
      const curLat = pos.coords.latitude;
      const curLng = pos.coords.longitude;
      if (st.lastFpLat !== null && st.lastFpLng !== null) {
        const fpPos = gpsToPixel(st.lastFpLat, st.lastFpLng);
        if (fpPos) {
          const curPos = gpsToPixel(curLat, curLng);
          if (curPos) {
            const dx = curPos.x - fpPos.x;
            const dy = curPos.y - fpPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 20) {
              placeFootprint(curLat, curLng);
              st.lastFpLat = curLat;
              st.lastFpLng = curLng;
            }
          }
        }
      } else {
        st.lastFpLat = curLat;
        st.lastFpLng = curLng;
      }
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
    { enableHighAccuracy: true }
  );
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
