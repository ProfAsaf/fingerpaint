/* Fingerpaint — offline service worker.
   The app is a single self-contained HTML file, so the worker only needs to
   precache the page shell. Once installed (on the first online visit), the
   Home Screen app launches with no network at all.
   Bump CACHE (v1 -> v2 -> ...) whenever index.html changes to ship an update. */
const CACHE = 'fingerpaint-v1';
const CORE = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);                              // essential shell
    try { await cache.add('./launcher.html'); } catch (e) {/* best-effort */}
    await self.skipWaiting();                              // activate immediately
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));  // drop old versions
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;  // only handle our own files
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;                             // cache-first: instant offline launch
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());      // populate cache as we go
      return res;
    } catch (e) {
      // Offline and not cached: fall back to the app shell for page loads.
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html', { ignoreSearch: true })
                   || await cache.match('./', { ignoreSearch: true });
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
