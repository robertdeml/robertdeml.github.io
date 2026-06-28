/* ============================================================
 * transform — GPS-to-pixel affine transform math.
 *
 * Given 2+ GPS-tagged reference pins on the photo, computes
 * a least-squares similarity transform (scale + rotation,
 * no skew) that maps (lat,lng) → (x,y) pixel coordinates.
 * ============================================================ */

import { pinContainer } from "./state.js";

const MAX_ACC_RADIUS_PX = 500;

/** Iterates all reference pins (SVGs with data-lat) and returns
 *  their adjusted GPS coords + pixel positions. */
function getRefPins() {
  const refs: { lat: number; lng: number; x: number; y: number }[] = [];
  pinContainer.querySelectorAll('svg[data-lat]:not([data-type="footprint"])').forEach((svg) => {
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

/** Computes affine transform coefficients from placed reference pins.
 *  Returns null when fewer than 2 pins exist or all pins are co-located.
 *  Uses least-squares over all pin-pairs relative to the first pin. */
export function getTransformCoeffs() {
  const refs = getRefPins();
  if (refs.length < 2) return null;
  const [p0] = refs;
  let sumA = 0,
    sumB = 0,
    sumW = 0;
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

/** Default scale (pixels-per-degree) fallback when only 1 ref pin exists.
 *  Uses the same heuristic as the scale bar: assumes the viewport's long
 *  edge spans ~0.25 miles at the reference latitude. */
function defaultScale(refLat: number): number {
  const { mPerDegLat } = getMetersPerDeg(refLat);
  const longEdgePx = Math.max(window.innerWidth, window.innerHeight);
  const targetMiles = 1.0;
  return (mPerDegLat * longEdgePx) / (targetMiles * 1609.344);
}

/** Converts (lat,lng) to pixel (x,y) via the affine transform.
 *  Returns null when no reference pins exist.
 *  With exactly 1 pin, uses a default scale and north-up projection. */
export function gpsToPixel(lat: number, lng: number) {
  const coeffs = getTransformCoeffs();

  if (coeffs) {
    const { a, b, p0 } = coeffs;
    const dLat = lat - p0.lat;
    const dLng = lng - p0.lng;
    return {
      x: p0.x + a * dLat - b * dLng,
      y: p0.y + b * dLat + a * dLng,
    };
  }

  const refs = getRefPins();
  if (refs.length === 1) {
    const p0 = refs[0];
    const dLat = lat - p0.lat;
    const dLng = lng - p0.lng;
    const s = defaultScale(p0.lat);
    return {
      x: p0.x + s * dLng,
      y: p0.y - s * dLat,
    };
  }

  return null;
}

/** Converts GPS accuracy (meters) to a pixel radius on screen.
 *  Capped at MAX_ACC_RADIUS_PX to prevent over-sized circles.
 *  Falls back to the default 1-pin scale when no affine transform is ready. */
export function accToPixelRadius(accMeters: number): number {
  const coeffs = getTransformCoeffs();
  let s: number;

  if (coeffs) {
    s = Math.sqrt(coeffs.a * coeffs.a + coeffs.b * coeffs.b);
  } else {
    const refs = getRefPins();
    if (refs.length === 0) return 10;
    s = defaultScale(refs[0].lat);
  }

  const radius = (s * accMeters) / 111320;
  return Math.min(radius, MAX_ACC_RADIUS_PX);
}

/** Returns meters-per-degree for latitude and longitude at
 *  a given latitude. Used for 1-meter GPS nudge calculations. */
export function getMetersPerDeg(lat: number) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  return { mPerDegLat, mPerDegLng };
}
