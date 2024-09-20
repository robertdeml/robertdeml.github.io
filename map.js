const debugGps = false;

let gpsToMapRotation;
let gpsToMapScale;
let gpsLatitude;
let gpsLongitude;
let mapOriginX;
let mapOriginY;
let currentPositionInterval;
let imgOffsetX = 0;
let imgOffsetY = 0;

function measure(lat1, lon1, lat2, lon2) {  // generally used geo measurement function
  var R = 6378.137; // Radius of earth in KM
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

  const gpsDistanceMeters = measure(b.dataset.latitude, b.dataset.longitude, a.dataset.latitude, a.dataset.longitude);

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

let positionCount = 0;
const plotCurrentPosition = (currentCoords) => {
  document.getElementById('posCount').innerHTML = positionCount++;

  // RJD: create current mark at start off screen
  // Create a marker element
  let lastPositionMarker = document.querySelector(".current-position-marker");
  const markerCreated = !lastPositionMarker;
  if (!lastPositionMarker) {
    lastPositionMarker = document.createElement("div");
  }
  lastPositionMarker.className = "current-position-marker";

  const lastBreadcrumbMarker = document.querySelector("#breadcrumb-container div:last-of-type");
  const { latitude: latStr, longitude: longStr } = lastBreadcrumbMarker?.dataset || {};
  const { latitude: markerLatitude = +latStr, longitude: markerLongitude = +longStr } = {};

  const { latitude, longitude, accuracy } = currentCoords;

  const gpsDistanceMeters = measure(latitude, longitude, +markerLatitude, +markerLongitude);

  lastPositionMarker.dataset.latitude = latitude;
  lastPositionMarker.dataset.longitude = longitude;

  // Set the marker's position based on rotation and scale
  const translateX = longitude - gpsLongitude; // translate to a known point
  const translateY = latitude - gpsLatitude;
  const rotateX = translateX * Math.cos(gpsToMapRotation) - translateY * Math.sin(gpsToMapRotation); // rotate the point
  const rotateY = translateY * Math.cos(gpsToMapRotation) + translateX * Math.sin(gpsToMapRotation);
  const scaleX = rotateX * gpsToMapScale; // scale to map units
  const scaleY = rotateY * gpsToMapScale;
  const x = scaleX + mapOriginX + imgOffsetX; // translate to map coordinates
  const y = -scaleY + mapOriginY + imgOffsetY;

  lastPositionMarker.style.left = x + "px";
  lastPositionMarker.style.top = y + "px";
  lastPositionMarker.dataset.x = x;
  lastPositionMarker.dataset.y = y;

  if (gpsDistanceMeters > accuracy || !lastBreadcrumbMarker) {
    const breadcrumb = document.createElement("div");
    breadcrumb.className = "breadcrumb-position-marker";

    breadcrumb.style.left = x + "px";
    breadcrumb.style.top = y + "px";
    breadcrumb.dataset.x = x;
    breadcrumb.dataset.y = y;
    breadcrumb.dataset.latitude = currentCoords.latitude;
    breadcrumb.dataset.longitude = currentCoords.longitude;
    breadcrumbContainer.appendChild(breadcrumb);
  }

  document.getElementById("longitude").innerHTML = longitude.toFixed(6);
  document.getElementById("latitude").innerHTML = latitude.toFixed(6);
  document.getElementById("accuracy").innerHTML = currentCoords.accuracy.toFixed(2);
  document.getElementById("translateX").innerHTML = translateX.toFixed(6);
  document.getElementById("translateY").innerHTML = translateY.toFixed(6);
  document.getElementById("rotateX").innerHTML = rotateX.toFixed(6);
  document.getElementById("rotateY").innerHTML = rotateY.toFixed(6);
  document.getElementById("scaleX").innerHTML = scaleX.toFixed(4);
  document.getElementById("scaleY").innerHTML = scaleY.toFixed(4);
  document.getElementById("mapX").innerHTML = x.toFixed(2);
  document.getElementById("mapY").innerHTML = y.toFixed(2);

  // Append the marker to the container
  if (markerCreated) {
    imageContainer.appendChild(lastPositionMarker);
  }
}

let markerId = 0;

// Get the image element and container
const section = document.getElementById("section");
const image = document.getElementById("image");
const imageContainer = document.getElementById("image-container");
const breadcrumbContainer = document.getElementById("breadcrumb-container");

const appendNewPoint = (clientX, clientY) => {
  // Create a marker element
  const marker = document.createElement("div");
  marker.className = "marker";

  // Set the marker's position based on click coordinates
  const mouseX = clientX + section.scrollLeft;
  const mouseY = clientY + section.scrollTop;
  marker.style.left = mouseX + "px";
  marker.style.top = mouseY + "px";
  marker.dataset.x = mouseX;
  marker.dataset.y = mouseY;
  markerId++;
  marker.id = `marker_${markerId}`;

  // Append the marker to the container
  imageContainer.appendChild(marker);
  return marker.id;
};

const plotPoint = (clientX, clientY, coords) => {
  const markerId = appendNewPoint(clientX, clientY);

  const { latitude, longitude, accuracy } = coords;

  // find up to 3 markers
  const [markerA, markerB, markerC] = document.querySelectorAll('.marker');

  // very first marker
  if (markerA && !markerB && !markerC) {
    // first marker
    markerA.dataset.latitude = +latitude;
    markerA.dataset.longitude = +longitude;
    markerA.dataset.accuracy = +accuracy;

    document.getElementById('markerALong').innerHTML = longitude.toFixed(6);
    document.getElementById('markerALat').innerHTML = latitude.toFixed(6);
    document.getElementById('markerAAcc').innerHTML = accuracy.toFixed(2);
  }
  // 2nd marker
  else if (markerA && markerB && !markerC) {
    if (measure(latitude, longitude, +markerA.dataset.latitude, +markerA.dataset.longitude) < 0) { // accuracy + +markerA.dataset.accuracy) {
      markerB.remove();
      return;
    }

    // second marker
    markerB.dataset.latitude = +latitude;
    markerB.dataset.longitude = +longitude;
    markerB.dataset.accuracy = +accuracy;

    document.getElementById('markerBLong').innerHTML = longitude.toFixed(6);
    document.getElementById('markerBLat').innerHTML = latitude.toFixed(6);
    document.getElementById('markerBAcc').innerHTML = accuracy.toFixed(2);

    saveTransformations(markerA, markerB);
  }
  // 3rd marker.  Replace the first
  else {
    if (measure(latitude, longitude, +markerB.dataset.latitude, +markerB.dataset.longitude) < 0) { // accuracy + +markerB.dataset.accuracy) {
      markerC.remove();
      return;
    }

    // replace first marker
    markerA.remove();

    markerC.dataset.latitude = +latitude;
    markerC.dataset.longitude = +longitude;
    markerC.dataset.accuracy = +accuracy;

    document.getElementById('markerALong').innerHTML = Number(markerB.dataset.longitude).toFixed(6);
    document.getElementById('markerALat').innerHTML = Number(markerB.dataset.latitude).toFixed(6);
    document.getElementById('markerAAcc').innerHTML = Number(markerB.dataset.accuracy).toFixed(2);

    document.getElementById('markerBLong').innerHTML = Number(markerC.dataset.longitude).toFixed(6);
    document.getElementById('markerBLat').innerHTML = Number(markerC.dataset.latitude).toFixed(6);
    document.getElementById('markerBAcc').innerHTML = Number(markerC.dataset.accuracy).toFixed(2);

    saveTransformations(markerB, markerC);
  }
}

function movePoint(x, y) {
  const [marker, prevMarker] = Array.from(document.querySelectorAll('.marker')).reverse();
  if (!marker) return;

  const xCoord = Number(marker.dataset.x) + x;
  const yCoord = Number(marker.dataset.y) + y;
  marker.style.left = xCoord + "px";
  marker.style.top = yCoord + "px";
  marker.dataset.x = xCoord;
  marker.dataset.y = yCoord;

  if (prevMarker) {
    saveTransformations(marker, prevMarker);
  }
}

function clearFootprints() {
  document.getElementById('breadcrumb-container').replaceChildren();
}

function attachClickHandler(image) {
  const rect = document.querySelector('#image-container').getBoundingClientRect();
  imgOffsetX = rect.x;
  imgOffsetY = rect.y;
  image.addEventListener("click", (e) => {
    imageClickHandler(e.clientX - imgOffsetX, e.clientY - imgOffsetY);
  });
  document.querySelector("#clear-footprints").addEventListener('click', () => clearFootprints());
  document.querySelector("#point-up").addEventListener('click', () => movePoint(0, -1));
  document.querySelector("#point-down").addEventListener('click', () => movePoint(0, 1));
  document.querySelector("#point-left").addEventListener('click', () => movePoint(-1, 0));
  document.querySelector("#point-right").addEventListener('click', () => movePoint(1, 0));
};

/**
 * Click Event Handler
 * Get the GPS location, then plot this point on the image
 * */
function imageClickHandler(posX, posY) {
  const locationError = () => {
    console.log('error getting location.');
  }

  const locationSuccess = (position) => {
    plotPoint(posX, posY, position.coords);
  };

  if (!navigator.geolocation) {
    console.log("Geolocation is not supported by your browser");
  } else {
    const options = {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 27000,
    };
    !debugGps && navigator.geolocation.getCurrentPosition(locationSuccess, locationError, options);
  }
};

if (!navigator.geolocation) {
  console.log("Geolocation is not supported by your browser");
} else {
  const options = {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 27000,
  };


  function error() {
    alert("Sorry, no position available.");
  }

  !debugGps && navigator.geolocation.watchPosition((p) => plotCurrentPosition(p.coords), error, options);
}

let coord;
let screen;

debugGps && document.addEventListener('keydown', (e) => {

  switch (e.key) {
    case '1': plotPoint(100, 100, coord); break;
    case '2': plotPoint(100, 50, coord); break;

    case 'q': coord = { longitude: -71, latitude: 45, accuracy: 1 }; screen = { x: 0, y: 0 }; break;
    case 'w': coord = { longitude: -70, latitude: 45, accuracy: 1 }; screen = { x: 50, y: 0 }; break;
    case 'e': coord = { longitude: -69, latitude: 45, accuracy: 1 }; screen = { x: 100, y: 0 }; break;

    case 'a': coord = { longitude: -71, latitude: 44, accuracy: 1 }; screen = { x: 0, y: 0 }; break;
    case 's': coord = { longitude: -70, latitude: 44, accuracy: 1 }; screen = { x: 50, y: 50 }; break;
    case 'd': coord = { longitude: -69, latitude: 44, accuracy: 1 }; screen = { x: 100, y: 100 }; break;

    case 'z': coord = { longitude: -71, latitude: 43, accuracy: 1 }; screen = { x: 0, y: 0 }; break;
    case 'x': coord = { longitude: -70, latitude: 43, accuracy: 1 }; screen = { x: 50, y: 50 }; break;
    case 'c': coord = { longitude: -69, latitude: 43, accuracy: 1 }; screen = { x: 100, y: 100 }; break;

    case 'p': plotCurrentPosition(coord); break;
    case 'o': plotPoint(screen.x, screen.y, coord);
  }
});
