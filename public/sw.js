// Minimal service worker — exists only to satisfy Chrome's PWA installability
// criteria (a fetch handler is required for beforeinstallprompt to fire).
// Pure network pass-through, no caching.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
