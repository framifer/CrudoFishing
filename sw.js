/* Game Boy Fishing — Service Worker
 *
 * Strategy: cache-first for the app shell so the whole game works fully offline
 * after the first load. The game is self-contained (single HTML file with inline
 * CSS/JS), so the cache list is tiny. Bump CACHE_VERSION whenever you change any
 * cached file to force clients to pick up the new version.
 */
const CACHE_VERSION = "gb-fishing-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./favicon.png",
];

// Install: pre-cache the app shell.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate this SW immediately without waiting for old tabs to close.
  self.skipWaiting();
});

// Activate: clean up old caches from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache first, fall back to network, and cache new GET
// responses so subsequent visits stay offline-capable.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests; let the browser handle the rest.
  if (req.method !== "GET") return;

  // For navigations, prefer the cached index.html so the game boots offline.
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then(
        (cached) => cached || fetch(req).catch(() => caches.match("./index.html"))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache same-origin successful responses for future offline use.
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached); // offline and not cached -> undefined (browser shows error)
    })
  );
});
