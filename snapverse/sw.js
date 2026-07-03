const CACHE_NAME = 'snapverse-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/snapverse/search.html',
  '/snapverse/explore.html',
  '/snapverse/reels.html',
  '/snapverse/profile.html',
  '/snapverse/admin.html',
  '/snapverse/hashtag.html',
  '/snapverse/settings.html',
  '/snapverse/messages.html',
  '/snapverse/saved.html',
  '/snapverse/manifest.json',
  '/snapverse/murray.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(urlsToCache).catch(() => {
        /* partial cache ok when offline */
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isAppShell =
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('manifest.json');

  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      )
    )
  );
  self.clients.claim();
});

