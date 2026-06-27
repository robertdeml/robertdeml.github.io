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
  "icons.js",
  "manifest.json",
  "icon-192.svg",
  "icon-512.svg",
];
const TIMEOUT = 5000;

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

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), TIMEOUT),
        );

        Promise.race([fetch(e.request), timeoutPromise])
          .then((res) => {
            if (res.ok) {
              caches.open(CACHE).then((cache) => cache.put(e.request, res));
            }
          })
          .catch(() => { /* stale cache is fine */ });

        return cached;
      }

      return fetch(e.request).then((res) =>
        caches.open(CACHE).then((cache) => {
          cache.put(e.request, res.clone());
          return res;
        }),
      );
    }),
  );
});
