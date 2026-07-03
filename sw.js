const CACHE_VERSION = 'v8';
const STATIC_CACHE = `snapverse-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `snapverse-dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/assets/manifest.json',
  '/assets/murray.png',
  '/snapverse/manifest.json',
  '/murray.png',
  '/snapverse/murray.png',
  '/snapverse/messages.html',
  '/snapverse/settings.html',
  '/snapverse/profile.html',
  '/snapverse/explore.html',
  '/snapverse/search.html',
  '/snapverse/reels.html',
  '/snapverse/saved.html',
  '/snapverse/hashtag.html',
  '/snapverse/admin.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS.map((url) => new Request(url, { cache: 'reload' }))).then(() => self.skipWaiting()))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
          return caches.delete(cacheName);
        }
        return null;
      })
    )).then(() => self.clients.claim())
  );
});

function getCacheStrategy(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return 'network-first';
  if (STATIC_ASSETS.some((asset) => (asset.startsWith('http') ? url.href === asset : url.pathname === asset))) return 'cache-first';
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic')) return 'network-first';
  if (request.destination === 'image') return 'cache-first';
  if (request.destination === 'document' || request.destination === 'script' || request.destination === 'style' || request.destination === 'worker') return 'network-first';
  return 'stale-while-revalidate';
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    throw error;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch((error) => cached || Promise.reject(error));
  return cached || networkPromise;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  try {
    const url = new URL(event.request.url);
    if (url.protocol === 'chrome-extension:' || url.protocol === 'about:' || url.protocol === 'data:') return;
    if (url.origin !== self.location.origin && (url.hostname.includes('cdn.tailwindcss.com') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com'))) return;
  } catch {
    return;
  }
  event.respondWith((async () => {
    const strategy = getCacheStrategy(event.request);
    return strategy === 'cache-first' ? cacheFirst(event.request) : strategy === 'network-first' ? networkFirst(event.request) : staleWhileRevalidate(event.request);
  })());
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-posts') event.waitUntil(syncPosts());
});

async function syncPosts() {
  console.log('Syncing offline posts...');
}

