const CACHE = "hikenow-v2";
const ASSETS = [
  "/",
  "index.html",
  "app.js",
  "state.js",
  "transform.js",
  "pins.js",
  "gps.js",
  "debug.js",
  "scale.js",
  "ui.js",
  "save.js",
  "lucide.js",
  "floating-ui.core.umd.js",
  "floating-ui.dom.umd.js",
  "manifest.json",
  "icon-192.svg",
  "icon-512.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
