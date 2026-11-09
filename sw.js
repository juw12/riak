// Offline cache. Bump VERSION when shipping changes.
const VERSION = "riak-v1.5.0";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "fonts/fonts.css",
  "fonts/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeA.woff2",
  "fonts/nwpStKy2OAdR1K-IwhWudF-R3w8aZQ.woff2",
  "js/angler.js",
  "js/anglerui.js",
  "js/app.js",
  "js/audio.js",
  "js/core.js",
  "js/data.js",
  "js/draw.js",
  "js/fishing.js",
  "js/focus.js",
  "js/garden.js",
  "js/i18n.js",
  "js/journal.js",
  "js/pond.js",
  "js/pondaudio.js",
  "js/share.js",
  "js/sim.js",
  "js/tank.js",
  "js/tankpanel.js",
  "js/ui.js",
  "js/util.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Network first for pages so updates arrive; cache first for everything else.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("index.html", copy));
          return res;
        })
        .catch(() => caches.match("index.html")),
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
