/*
 * Archery MVP — Service Worker (minimal, no Workbox).
 *
 * Strategy:
 *  - Static assets (`/_next/static/`, `/icons/`, manifest): cache-first.
 *  - HTML navigations: network-first with offline fallback to `/offline`.
 *  - API (`/api/`) and auth callbacks: network-only. Never cached.
 *  - Sensitive write methods (POST/PUT/PATCH/DELETE): bypass entirely.
 *
 * Bumping CACHE_NAME invalidates the old cache on next activation.
 */

const CACHE_NAME = 'archery-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [OFFLINE_URL, '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS).catch(() => {
        // ignore individual failures — offline page is the only critical one
      });
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only GET requests are eligible for caching. Everything else passes
  // straight through so server actions, login POSTs, etc. are untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only — no cross-origin caching (CDN/fonts handled by browser).
  if (url.origin !== self.location.origin) return;

  // Never cache auth or API routes. Always network.
  if (
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML navigations: network-first, fallback to offline page if dead.
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Optionally cache the navigation response for offline visit.
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(OFFLINE_URL);
        })
    );
  }
});
