// Import the Capacitor Geolocation plugin
import { Geolocation } from '@capacitor/geolocation';

let gpsToMapRotation;
let gpsToMapScale;
let gpsLatitude;
let gpsLongitude;
let mapOriginX;
let mapOriginY;
let currentPositionInterval;
let imgOffsetX = 0;
let imgOffsetY = 0;

let positionCount = 0;
let markerId = 0;

let lockMapState = false;

// Get the image element and container
const section = document.getElementById("section");
const image = document.getElementById("image");
const imageContainer = document.getElementById("image-container");
const breadcrumbContainer = document.getElementById("breadcrumb-container");

function measure(lat1, lon1, lat2, lon2) {  // general geo measurement function
  var R = 6378.137; // Radius of the earth in KM
  var dLat = lat2 * Math.PI / 180 - lat1 * Math.PI / 180;
  var dLon = lon2 * Math.PI / 180 - lon1 * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d * 1000; // meters
}

const saveTransformations = (a, b) => {
  const gpsAngle = Math.atan2(+b.dataset.latitude - +a.dataset.latitude, +b.dataset.longitude - +a.dataset.longitude);
  const mapAngle = Math.atan2(-Number(b.dataset.y) + Number(a.dataset.y), b.dataset.x - a.dataset.x);
  gpsToMapRotation = mapAngle - gpsAngle;

  const gpsDistance = Math.sqrt(Math.pow(b.dataset.latitude - a.dataset.latitude, 2) + Math.pow(b.dataset.longitude - a.dataset.longitude, 2));
  const mapDistance = Math.sqrt(Math.pow(b.dataset.y - a.dataset.y, 2) + Math.pow(b.dataset.x - a.dataset.x, 2));
  gpsToMapScale = mapDistance / gpsDistance;

  if (!isFinite(gpsToMapScale)) {
    gpsToMapScale = 1;
  }

  gpsLatitude = +a.dataset.latitude;
  gpsLongitude = +a.dataset.longitude;
  mapOriginX = +a.dataset.x;
  mapOriginY = +a.dataset.y;

  document.getElementById('gpsDist').innerHTML = gpsDistance.toFixed(4);
  document.getElementById('mapDist').innerHTML = mapDistance.toFixed(2);
  document.getElementById('scale').innerHTML = gpsToMapScale.toFixed(2);
  document.getElementById('map-angle').innerHTML = mapAngle.toFixed(2);
};

const plotCurrentPosition = async () => {
  try {
    document.getElementById('posCount').innerHTML = positionCount++;

    // Get the current position using Capacitor's Geolocation API
    const position = await Geolocation.getCurrentPosition();
    const { latitude, longitude, accuracy } = position.coords;

    // Create a marker element or use the last one
    let lastPositionMarker = document.querySelector(".current-position-marker");
    if (!lastPositionMarker) {
      lastPositionMarker = document.createElement("div");
      lastPositionMarker.className = "current-position-marker";
      imageContainer.appendChild(lastPositionMarker);
    }

    // Update the marker's position
    lastPositionMarker.dataset.latitude = latitude;
    lastPositionMarker.dataset.longitude = longitude;

    // Transform coordinates for the map
    const translateX = longitude - gpsLongitude;
    const translateY = latitude - gpsLatitude;
    const rotateX = translateX * Math.cos(gpsToMapRotation) - translateY * Math.sin(gpsToMapRotation);
    const rotateY = translateY * Math.cos(gpsToMapRotation) + translateX * Math.sin(gpsToMapRotation);
    const scaleX = rotateX * gpsToMapScale;
    const scaleY = rotateY * gpsToMapScale;
    const x = scaleX + mapOriginX + imgOffsetX;
    const y = -scaleY + mapOriginY + imgOffsetY;

    // Update the marker style
    lastPositionMarker.style.left = x + "px";
    lastPositionMarker.style.top = y + "px";

    // Update UI elements with coordinates
    document.getElementById("longitude").innerHTML = longitude.toFixed(6);
    document.getElementById("latitude").innerHTML = latitude.toFixed(6);
    document.getElementById("accuracy").innerHTML = accuracy.toFixed(2);
  } catch (e) {
    console.error('Error fetching the GPS location:', e);
  }
};

const plotPoint = async (clientX, clientY) => {
  try {
    const position = await Geolocation.getCurrentPosition();
    const { latitude, longitude, accuracy } = position.coords;

    const markerId = appendRefPoint(clientX, clientY, position.coords);
    // Additional logic to handle map plotting with new points...
  } catch (e) {
    console.error('Error fetching the GPS location:', e);
  }
};

const appendRefPoint = (clientX, clientY, coords) => {
  const marker = document.createElement("div");
  marker.className = "marker";
  const mouseX = clientX + section.scrollLeft;
  const mouseY = clientY + section.scrollTop;
  marker.style.left = mouseX + "px";
  marker.style.top = mouseY + "px";
  imageContainer.appendChild(marker);
  return marker.id;
};

// Initiate GPS tracking
(async () => {
  const options = {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 27000,
  };

  try {
    await Geolocation.watchPosition(options, plotCurrentPosition);
  } catch (e) {
    console.error('Error watching the position:', e);
  }
})();