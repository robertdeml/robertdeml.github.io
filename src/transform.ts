import { pinContainer } from "./state.js";

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

export function getTransformCoeffs() {
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

export function gpsToPixel(lat: number, lng: number) {
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

export function accToPixelRadius(accMeters: number, lat: number): number {
  const coeffs = getTransformCoeffs();
  if (!coeffs) return 10;
  const { a, b } = coeffs;
  return Math.sqrt(a * a + b * b) * accMeters / 111320;
}

export function getMetersPerDeg(lat: number) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
  return { mPerDegLat, mPerDegLng };
}
