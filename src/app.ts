const menuBtn = document.querySelector('.menu-btn button');
const panel = document.getElementById("buttonsPanel");
const overlay = document.getElementById("menuOverlay");

function toggleMenu(open?: boolean) {
  const isOpen = open ?? !panel?.classList.contains("open");
  panel?.classList.toggle("open", isOpen);
  overlay?.classList.toggle("open", isOpen);
}

menuBtn?.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
panel?.addEventListener("click", (e) => e.stopPropagation());
overlay?.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(false); });

let watchId: number | null = null;
let lastGps: { lat: string; lng: string; acc: string } | null = null;
let gpsPin: SVGElement | null = null;
let gpsAccCircle: SVGSVGElement | null = null;
let lastFpLat: number | null = null;
let lastFpLng: number | null = null;
const compassBtn = document.getElementById("compassBtn");
const statusEl = document.createElement("div");
statusEl.id = "gpsStatus";
statusEl.style.cssText = "position:fixed;bottom:8px;left:8px;color:#FF5A00;font-family:monospace;font-size:14px;z-index:10;background:rgba(0,0,0,0.6);padding:4px 8px;border-radius:4px;display:none;";
document.body.appendChild(statusEl);

if (navigator.geolocation && compassBtn) {
  compassBtn.classList.remove("hidden");

  function stopTracking() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    lastGps = null;
    lastFpLat = null;
    lastFpLng = null;
    removeGpsPin();
    menuBtn?.classList.remove("active");
    compassBtn?.classList.remove("active");
    statusEl.style.display = "none";
  }

  function startTracking() {
    menuBtn?.classList.add("active");
    compassBtn?.classList.add("active");
    statusEl.style.display = "";
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastGps = {
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          acc: pos.coords.accuracy.toFixed(0),
        };
        if (debugActive) return;
        const curLat = pos.coords.latitude;
        const curLng = pos.coords.longitude;
        if (lastFpLat !== null && lastFpLng !== null) {
          const fpPos = gpsToPixel(lastFpLat, lastFpLng);
          if (fpPos) {
            const curPos = gpsToPixel(curLat, curLng);
            if (curPos) {
              const dx = curPos.x - fpPos.x;
              const dy = curPos.y - fpPos.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 20) {
                placeFootprint(curLat, curLng);
                lastFpLat = curLat;
                lastFpLng = curLng;
              }
            }
          }
        } else {
          lastFpLat = curLat;
          lastFpLng = curLng;
        }
        updateGpsPin(pos.coords.latitude, pos.coords.longitude, lastGps.acc);
        statusEl.textContent = `${lastGps.lat}, ${lastGps.lng}  ±${lastGps.acc}m`;
        const gp = gpsPin;
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

  compassBtn.addEventListener("click", () => {
    if (watchId !== null) {
      stopTracking();
    } else {
      startTracking();
    }
  });
}

let debugActive = false;
let debugInterval: ReturnType<typeof setInterval> | null = null;
const testBtn = document.getElementById("testBtn");
const debugPanel = document.getElementById("debugPanel") as HTMLDivElement;
const debugLatInput = document.getElementById("debugLat") as HTMLInputElement;
const debugLonInput = document.getElementById("debugLon") as HTMLInputElement;
const debugAccInput = document.getElementById("debugAcc") as HTMLInputElement;

function updateDebugGps() {
  const lat = parseFloat(debugLatInput.value);
  const lng = parseFloat(debugLonInput.value);
  if (isNaN(lat) || isNaN(lng)) return;
  if (lastFpLat !== null && lastFpLng !== null) {
    const fpPos = gpsToPixel(lastFpLat, lastFpLng);
    if (fpPos) {
      const curPos = gpsToPixel(lat, lng);
      if (curPos) {
        const dx = curPos.x - fpPos.x;
        const dy = curPos.y - fpPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 20) {
          placeFootprint(lat, lng);
          lastFpLat = lat;
          lastFpLng = lng;
        }
      }
    }
  } else {
    lastFpLat = lat;
    lastFpLng = lng;
  }
  const acc = parseFloat(debugAccInput.value) || 10;
  updateGpsPin(lat, lng, acc.toFixed(0));
  statusEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}  ±${acc}m`;
  const gp = gpsPin;
  if (gp) {
    statusEl.textContent += `  (${parseFloat(gp.style.left).toFixed(0)}, ${parseFloat(gp.style.top).toFixed(0)})`;
  }
}

if (testBtn) {
  testBtn.addEventListener("click", () => {
    debugActive = !debugActive;
    testBtn.classList.toggle("active", debugActive);
    debugPanel.classList.toggle("hidden", !debugActive);
    if (debugActive) {
      updateDebugGps();
      debugInterval = setInterval(updateDebugGps, 1000);
    } else {
      if (debugInterval) { clearInterval(debugInterval); debugInterval = null; }
      if (watchId !== null && lastGps) {
        const lat = parseFloat(lastGps.lat);
        const lng = parseFloat(lastGps.lng);
        updateGpsPin(lat, lng, lastGps.acc);
        statusEl.textContent = `${lastGps.lat}, ${lastGps.lng}  ±${lastGps.acc}m`;
        const gp2 = gpsPin;
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

debugPanel.addEventListener("click", (e) => e.stopPropagation());
debugLatInput.addEventListener("input", updateDebugGps);
debugLonInput.addEventListener("input", updateDebugGps);
debugAccInput.addEventListener("input", updateDebugGps);

const cameraBtn = document.querySelector('button:has([data-lucide="camera"])');
const fileInput = document.getElementById("cameraInput") as HTMLInputElement;

cameraBtn?.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    removeGpsPin();
    lastFpLat = null;
    lastFpLng = null;
    document.body.style.backgroundImage = `url(${reader.result})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
  };
  reader.readAsDataURL(file);
});

const pinContainer = document.createElement("div");
pinContainer.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;";
document.body.appendChild(pinContainer);

function createPinSvg(x: number, y: number, color: string, clickable: boolean, gps?: { lat: string; lng: string; acc: string }) {
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

function placePin(x: number, y: number, gps?: { lat: string; lng: string; acc: string }) {
  const svg = createPinSvg(x, y, "#FF5A00", true, gps);
  pinContainer.appendChild(svg);
  refreshAccuracyCircles();
}

function placeFootprint(gpsLat: number, gpsLng: number) {
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

function getRefPins() {
  const refs: { lat: number; lng: number; x: number; y: number }[] = [];
  pinContainer.querySelectorAll("svg[data-lat]").forEach((svg) => {
    const el = svg as SVGElement;
    refs.push({
      lat: parseFloat(el.dataset.adjLat ?? el.dataset.lat!),
      lng: parseFloat(el.dataset.adjLng ?? el.dataset.lng!),
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
    });
  });
  return refs;
}

function getTransformCoeffs() {
  const refs = getRefPins();
  if (refs.length < 2) return null;
  const [p0] = refs;
  let sumA = 0, sumB = 0, sumW = 0;
  for (let i = 1; i < refs.length; i++) {
    const p = refs[i];
    const dLat = p.lat - p0.lat;
    const dLng = p.lng - p0.lng;
    const dX = p.x - p0.x;
    const dY = p.y - p0.y;
    const denom = dLat * dLat + dLng * dLng;
    if (denom < 1e-12) continue;
    sumA += (dX * dLat + dY * dLng) / denom;
    sumB += (dY * dLat - dX * dLng) / denom;
    sumW += 1;
  }
  if (sumW < 0.5) return null;
  return { a: sumA / sumW, b: sumB / sumW, p0 };
}

function gpsToPixel(lat: number, lng: number) {
  const coeffs = getTransformCoeffs();
  if (!coeffs) return null;
  const { a, b, p0 } = coeffs;
  const dLat = lat - p0.lat;
  const dLng = lng - p0.lng;
  return {
    x: p0.x + a * dLat - b * dLng,
    y: p0.y + b * dLat + a * dLng,
  };
}

function removeGpsPin() {
  if (gpsPin) { gpsPin.remove(); gpsPin = null; }
  if (gpsAccCircle) { gpsAccCircle.remove(); gpsAccCircle = null; }
}

function updateGpsPin(lat: number, lng: number, acc?: string) {
  const pos = gpsToPixel(lat, lng);
  if (!pos) return;
  removeGpsPin();
  gpsPin = createPinSvg(pos.x, pos.y, "#22c55e", false);
  pinContainer.appendChild(gpsPin);

  if (acc) {
    const accNum = parseFloat(acc);
    if (!isNaN(accNum)) {
      const r = accToPixelRadius(accNum, lat);
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
      gpsAccCircle = svg;
    }
  }
}

function accToPixelRadius(accMeters: number, lat: number): number {
  const coeffs = getTransformCoeffs();
  if (!coeffs) return 10;
  const { a, b } = coeffs;
  return Math.sqrt(a * a + b * b) * accMeters / 111320;
}

function getMetersPerDeg(lat: number) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
  return { mPerDegLat, mPerDegLng };
}

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

function hideAccuracyCircle(pin?: SVGElement) {
  if (pin) {
    const svg = (pin as any)._accCircle;
    if (svg) { svg.remove(); delete (pin as any)._accCircle; }
  } else {
    pinContainer.querySelectorAll("svg[data-lat]").forEach(p => hideAccuracyCircle(p as SVGElement));
  }
}

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

const gpsAdjRow = document.getElementById("gpsAdjRow") as HTMLDivElement;
const pinAdjLatEl = document.getElementById("pinAdjLat") as HTMLSpanElement;
const pinAdjLngEl = document.getElementById("pinAdjLng") as HTMLSpanElement;

function clampAndApplyGps(pin: SVGElement, newAdjLat: number, newAdjLng: number) {
  const origLat = parseFloat(pin.dataset.lat!);
  const origLng = parseFloat(pin.dataset.lng!);
  const acc = parseFloat(pin.dataset.acc!);
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

function updateAdjDisplay(pin: SVGElement) {
  pinAdjLatEl.textContent = pin.dataset.adjLat ?? pin.dataset.lat ?? "";
  pinAdjLngEl.textContent = pin.dataset.adjLng ?? pin.dataset.lng ?? "";
}

gpsAdjRow?.querySelectorAll("[data-gps-adj]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!activePin || !activePin.dataset.lat) return;
    const dir = (btn as HTMLElement).dataset.gpsAdj!;
    const origLat = parseFloat(activePin.dataset.lat!);
    const { mPerDegLat, mPerDegLng } = getMetersPerDeg(origLat);
    const step = 1;
    let adjLat = parseFloat(activePin.dataset.adjLat ?? activePin.dataset.lat!);
    let adjLng = parseFloat(activePin.dataset.adjLng ?? activePin.dataset.lng!);
    switch (dir) {
      case "lat+": adjLat += step / mPerDegLat; break;
      case "lat-": adjLat -= step / mPerDegLat; break;
      case "lng+": adjLng += step / mPerDegLng; break;
      case "lng-": adjLng -= step / mPerDegLng; break;
    }
    clampAndApplyGps(activePin, adjLat, adjLng);
  });
});

let mapMode = false;
const mapBtn = document.getElementById("mapBtn");

mapBtn?.addEventListener("click", () => {
  mapMode = !mapMode;
  mapBtn.classList.toggle("active", mapMode);
  if (mapMode) {
    menuBtn?.classList.add("active");
  } else {
    menuBtn?.classList.remove("active");
  }
});

document.body.addEventListener("click", (e: MouseEvent) => {
  if (!document.body.style.backgroundImage) return;
  if (watchId === null && !debugActive && !mapMode) return;
  let gps = lastGps ?? undefined;
  if (debugActive) {
    const lat = parseFloat(debugLatInput.value);
    const lng = parseFloat(debugLonInput.value);
    if (!isNaN(lat) && !isNaN(lng)) {
      const acc = parseFloat(debugAccInput.value) || 10;
      gps = { lat: lat.toFixed(6), lng: lng.toFixed(6), acc: acc.toFixed(0) };
    }
  }
  placePin(e.clientX, e.clientY, gps);
});

const pinToolbar = document.getElementById("pinToolbar") as HTMLDivElement;
const pinOverlay = document.getElementById("pinOverlay") as HTMLDivElement;
const pinGpsInfo = document.getElementById("pinGpsInfo") as HTMLSpanElement;
let activePin: SVGElement | null = null;
const FUI = (window as any).FloatingUIDOM;

function hideToolbar() {
  pinToolbar.style.display = "none";
  pinOverlay.style.display = "none";
  activePin = null;
}

function showToolbar(pin: SVGElement) {
  activePin = pin;
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

pinContainer.addEventListener("click", (e) => {
  const svg = (e.target as Element).closest("svg") as SVGElement | null;
  if (!svg) return;
  e.stopPropagation();
  if (activePin === svg) { hideToolbar(); return; }
  showToolbar(svg);
});

pinToolbar.querySelectorAll("[data-dir]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!activePin) return;
    const dir = (btn as HTMLElement).dataset.dir!;
    const left = parseFloat(activePin.style.left) || 0;
    const top = parseFloat(activePin.style.top) || 0;
    const moves: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = moves[dir];
    activePin.style.left = `${left + dx}px`;
    activePin.style.top = `${top + dy}px`;
    showToolbar(activePin);
  });
});

pinToolbar.addEventListener("click", (e) => e.stopPropagation());
document.getElementById("copyGpsBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!activePin || !activePin.dataset.lat) return;
  const adjLat = activePin.dataset.adjLat ?? activePin.dataset.lat;
  const adjLng = activePin.dataset.adjLng ?? activePin.dataset.lng;
  const text = `Lat: ${activePin.dataset.lat}\nLon: ${activePin.dataset.lng}\nAdjLat: ${adjLat}\nAdjLng: ${adjLng}\nAcc: ±${activePin.dataset.acc}m\nX: ${parseFloat(activePin.style.left).toFixed(0)}  Y: ${parseFloat(activePin.style.top).toFixed(0)}`;
  navigator.clipboard.writeText(text);
});

pinToolbar.querySelector("[data-trash]")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!activePin) return;
  hideAccuracyCircle(activePin);
  activePin.remove();
  hideToolbar();
  refreshAccuracyCircles();
});

pinOverlay.addEventListener("click", (e) => {
  e.stopPropagation();
  hideToolbar();
});

document.getElementById("clearFpBtn")?.addEventListener("click", () => {
  if (confirm("Clear the trail?\n\nThis will permanently erase every footprint from your map. All tracked footsteps will be removed, but your reference map pins will be kept.\n\nThis cannot be undone. Continue?")) {
    pinContainer.querySelectorAll('svg[data-type="footprint"]').forEach(el => el.remove());
    lastFpLat = null;
    lastFpLng = null;
  }
});
