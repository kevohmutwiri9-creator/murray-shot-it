const CACHE_NAME = 'snapverse-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/mini-fb/search.html',
  '/mini-fb/explore.html',
  '/mini-fb/profile.html',
  '/mini-fb/admin.html',
  '/mini-fb/hashtag.html',
  '/mini-fb/settings.html',
  '/mini-fb/messages.html',
  '/mini-fb/saved.html',
  '/mini-fb/manifest.json',
  '/mini-fb/murray.png',
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
