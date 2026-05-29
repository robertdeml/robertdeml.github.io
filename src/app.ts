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
    if (gpsPin) { gpsPin.remove(); gpsPin = null; }
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
        updateGpsPin(pos.coords.latitude, pos.coords.longitude);
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
  updateGpsPin(lat, lng);
  statusEl.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}  ±10m`;
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
        updateGpsPin(lat, lng);
        statusEl.textContent = `${lastGps.lat}, ${lastGps.lng}  ±${lastGps.acc}m`;
        const gp2 = gpsPin;
        if (gp2) {
          statusEl.textContent += `  (${parseFloat(gp2.style.left).toFixed(0)}, ${parseFloat(gp2.style.top).toFixed(0)})`;
        }
      } else {
        if (gpsPin) { gpsPin.remove(); gpsPin = null; }
        statusEl.style.display = "none";
      }
    }
  });
}

debugPanel.addEventListener("click", (e) => e.stopPropagation());
debugLatInput.addEventListener("input", updateDebugGps);
debugLonInput.addEventListener("input", updateDebugGps);

const cameraBtn = document.querySelector('button:has([data-lucide="camera"])');
const fileInput = document.getElementById("cameraInput") as HTMLInputElement;

cameraBtn?.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (gpsPin) { gpsPin.remove(); gpsPin = null; }
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
      lat: parseFloat(el.dataset.lat!),
      lng: parseFloat(el.dataset.lng!),
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
    });
  });
  return refs;
}

function gpsToPixel(lat: number, lng: number) {
  const refs = getRefPins();
  if (refs.length < 2) return null;

  const match = refs.find((p) => Math.abs(p.lat - lat) < 1e-8 && Math.abs(p.lng - lng) < 1e-8);
  if (match) return { x: match.x, y: match.y };

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
    const w = 1;
    sumA += w * (dX * dLat + dY * dLng) / denom;
    sumB += w * (dY * dLat - dX * dLng) / denom;
    sumW += w;
  }

  if (sumW < 0.5) return null;
  const a = sumA / sumW;
  const b = sumB / sumW;

  const dLat = lat - p0.lat;
  const dLng = lng - p0.lng;
  return {
    x: p0.x + a * dLat - b * dLng,
    y: p0.y + b * dLat + a * dLng,
  };
}

function updateGpsPin(lat: number, lng: number) {
  const pos = gpsToPixel(lat, lng);
  if (!pos) return;
  if (gpsPin) gpsPin.remove();
  gpsPin = createPinSvg(pos.x, pos.y, "#22c55e", false);
  pinContainer.appendChild(gpsPin);
}

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
      gps = { lat: lat.toFixed(6), lng: lng.toFixed(6), acc: "10" };
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
    pinGpsInfo.innerHTML = `<div>Lat: ${pin.dataset.lat}</div><div>Lon: ${pin.dataset.lng}</div><div>Acc: ±${pin.dataset.acc}m</div><div>X: ${x}  Y: ${y}</div>`;
    pinGpsInfo.style.display = "flex";
    copyBtn.style.display = "";
  } else {
    pinGpsInfo.innerHTML = "";
    pinGpsInfo.style.display = "none";
    copyBtn.style.display = "none";
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
  const text = `Lat: ${activePin.dataset.lat}\nLon: ${activePin.dataset.lng}\nX: ${parseFloat(activePin.style.left).toFixed(0)}  Y: ${parseFloat(activePin.style.top).toFixed(0)}`;
  navigator.clipboard.writeText(text);
});

pinToolbar.querySelector("[data-trash]")?.addEventListener("click", (e) => {
  e.stopPropagation();
  activePin?.remove();
  hideToolbar();
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
