const CACHE_NAME = 'snapverse-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/mini-fb/search.html',
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
