// Minimal service worker — exists only so the app is installable (PWA).
// Navigations fall back to a plain offline response instead of a network error;
// API calls and everything else bypass the worker entirely.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return;
  event.respondWith(
    fetch(req).catch(
      () =>
        new Response("Tidak ada koneksi. Muat ulang saat online.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
    )
  );
});
