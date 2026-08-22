/// <reference lib="webworker" />

/**
 * CyberShield India — Service Worker
 * Provides offline support and caching for critical pages.
 */

const CACHE_NAME = 'cybershield-v1';
const STATIC_ASSETS = [
  '/',
  '/app',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  (self as any).skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  (self as any).clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event: any) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls: network only (don't cache user data)
  if (url.pathname.startsWith('/api/')) return;

  // For navigation: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/') as Promise<Response>)
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache successful responses for static assets
        if (response.ok && url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

export {};
