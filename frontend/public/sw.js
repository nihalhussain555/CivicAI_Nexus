// CivicAI Nexus — service worker
//
// Written by hand (no vite-plugin-pwa) using a runtime-caching strategy so
// it doesn't need to know Vite's hashed build filenames ahead of time:
//   - Page navigations: network-first, falling back to the cached shell
//     when offline, so people see something instead of a browser error.
//   - Same-origin static assets (JS/CSS/images/icons): cache-first, so
//     repeat visits are fast and the app keeps working offline once a
//     page has been opened at least once.
//   - Anything going to the API: network-only, NEVER cached. Grievance
//     data must always be current — a citizen seeing a stale "resolved"
//     status because of a cached response would be actively misleading.

const CACHE_VERSION = "civicai-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("civicai-") && key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

const isApiRequest = (url) => url.pathname.startsWith("/api/") || url.pathname === "/health";

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET — POST/PUT/DELETE (grievance actions) must always hit
  // the real network; caching or intercepting those would be dangerous.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API/health calls.
  if (isApiRequest(url)) return;

  // Cross-origin requests (fonts, etc.) — let the browser handle normally.
  if (url.origin !== self.location.origin) return;

  // Page navigations — network-first, cache fallback for offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Static assets — cache-first, updating the cache in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});