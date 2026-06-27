/* ============================================================
 * state — Shared mutable state and DOM element references.
 * All other modules import from here to read/write state.
 * ============================================================ */

export const menuBtn = document.querySelector(".menu-btn button");
export const panel = document.getElementById("buttonsPanel");
export const overlay = document.getElementById("menuOverlay");

export const infoBtn = document.getElementById("infoBtn");
export const infoDialog = document.getElementById("infoDialog");
export const infoOverlay = document.getElementById("infoOverlay");
export const infoCloseBtn = document.getElementById("infoCloseBtn");

export const compassBtn = document.getElementById("compassBtn");

export const testBtn = document.getElementById("testBtn");
export const debugPanel = document.getElementById("debugPanel") as HTMLDivElement;
export const debugLatInput = document.getElementById("debugLat") as HTMLInputElement;
export const debugLonInput = document.getElementById("debugLon") as HTMLInputElement;
export const debugAccInput = document.getElementById("debugAcc") as HTMLInputElement;
export const debugAltInput = document.getElementById("debugAlt") as HTMLInputElement;

export const cameraBtn = document.querySelector('button:has([data-lucide="camera"])');
export const fileInput = document.getElementById("cameraInput") as HTMLInputElement;

export const mapBtn = document.getElementById("mapBtn");
export const rotationBtn = document.getElementById("rotationBtn");

export const pinToolbar = document.getElementById("pinToolbar") as HTMLDivElement;
export const pinOverlay = document.getElementById("pinOverlay") as HTMLDivElement;
export const pinGpsInfo = document.getElementById("pinGpsInfo") as HTMLSpanElement;
export const gpsAdjRow = document.getElementById("gpsAdjRow") as HTMLDivElement;
export const pinAdjLatEl = document.getElementById("pinAdjLat") as HTMLSpanElement;
export const pinAdjLngEl = document.getElementById("pinAdjLng") as HTMLSpanElement;

export const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

export const st = {
  watchId: null as number | null,
  lastGps: null as { lat: string; lng: string; acc: string } | null,
  gpsPin: null as SVGElement | null,
  gpsAccCircle: null as SVGSVGElement | null,
  lastFpLat: null as number | null,
  lastFpLng: null as number | null,
  lastFpAcc: null as number | null,
  lastFpEl: null as SVGElement | null,
  fpBuffer: [] as { lat: number; lng: number; acc: number; alt?: number }[],
  totalDistanceM: 0 as number,
  gapBeforeNextFp: false as boolean,
  replayActive: false as boolean,
  replayPositions: [] as { lat: number; lng: number; acc: number }[],
  replayCurIndex: 0 as number,
  replayIntervalId: null as ReturnType<typeof setInterval> | null,
  replayFinishTimeout: null as ReturnType<typeof setTimeout> | null,
  replayEls: [] as SVGElement[],
  pathStyle: "circles" as "circles" | "line" | "both",
  pathPolyline: null as SVGSVGElement | null,
  elevationEnabled: false as boolean,
  gpsTimeoutId: null as ReturnType<typeof setTimeout> | null,
  wakeLock: null as WakeLockSentinel | null,
  debugActive: false as boolean,
  debugGpsEnabled: true as boolean,
  debugInterval: null as ReturnType<typeof setInterval> | null,
  mapMode: false as boolean,
  unit: "imperial" as "metric" | "imperial",
  rotation: 0,
  originalImage: null as string | null,
  imageNaturalWidth: 0,
  imageNaturalHeight: 0,
  activePin: null as SVGElement | null,

  // Zoom & pan
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panStartMouseX: 0,
  panStartMouseY: 0,
  isPinching: false,
  pinchStartDist: 0,
  pinchStartZoom: 1,
  pinchCenterDocX: 0,
  pinchCenterDocY: 0,
};

export const FUI = (window as any).FloatingUIDOM;

export const mapBg = document.createElement("div");
mapBg.id = "mapBg";
mapBg.style.cssText = "position:fixed;inset:0;z-index:1;overflow:hidden;background-size:contain;background-position:center;background-repeat:no-repeat;touch-action:none;";
document.body.appendChild(mapBg);

export const pinContainer = document.createElement("div");
pinContainer.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;";
document.body.appendChild(pinContainer);

export const statusEl = document.createElement("div");
statusEl.id = "gpsStatus";
statusEl.style.cssText =
  "position:fixed;bottom:8px;left:8px;color:#FF5A00;font-family:monospace;font-size:14px;z-index:10;background:rgba(0,0,0,0.6);padding:4px 8px;border-radius:4px;display:none;";
document.body.appendChild(statusEl);
