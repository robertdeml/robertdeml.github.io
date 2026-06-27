import { st } from "./state.js";
import { getTransformCoeffs } from "./transform.js";

const COMPASS_ID = "mapCompass";

export function refreshCompass(): void {
  let el = document.getElementById(COMPASS_ID) as HTMLElement | null;

  const hasGps = st.watchId !== null;
  const hasPhoto = !!st.originalImage;

  if (!hasGps || !hasPhoto) {
    if (el) el.style.display = "none";
    return;
  }

  if (!el) {
    el = createCompassEl();
    document.body.appendChild(el);
  }
  el.style.display = "block";

  const coeffs = getTransformCoeffs();
  let rotationDeg = 0;

  if (coeffs) {
    const { a, b } = coeffs;
    rotationDeg = Math.atan2(a, -b) * (180 / Math.PI);
  }

  const arrow = el.querySelector(".compass-arrow") as HTMLElement;
  if (arrow) {
    arrow.style.transform = `rotate(${rotationDeg}deg)`;
  }
}

function createCompassEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = COMPASS_ID;

  const outer = document.createElement("div");
  outer.style.cssText = [
    "position:relative",
    "width:44px",
    "height:44px",
    "border-radius:50%",
    "background:rgba(0,0,0,0.6)",
    "border:2px solid #FF5A00",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "overflow:hidden",
  ].join(";");

  const arrow = document.createElement("div");
  arrow.className = "compass-arrow";
  arrow.style.cssText = [
    "transition:transform .3s ease",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "gap:1px",
  ].join(";");

  const triangle = document.createElement("div");
  triangle.style.cssText = [
    "width:0",
    "height:0",
    "border-left:9px solid transparent",
    "border-right:9px solid transparent",
    "border-bottom:16px solid #FF5A00",
  ].join(";");

  const nLabel = document.createElement("span");
  nLabel.textContent = "N";
  nLabel.style.cssText = [
    "font:bold 11px/1 monospace",
    "color:#FF5A00",
    "margin-top:-1px",
  ].join(";");

  arrow.appendChild(triangle);
  arrow.appendChild(nLabel);
  outer.appendChild(arrow);
  el.appendChild(outer);

  el.style.cssText = [
    "position:fixed",
    "bottom:90px",
    "right:16px",
    "z-index:10",
    "display:none",
  ].join(";");

  return el;
}
