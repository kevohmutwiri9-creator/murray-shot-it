const CACHE_VERSION = 'v5';
const CACHE_NAME = snapverse-;
const STATIC_CACHE = snapverse-static-;
const DYNAMIC_CACHE = snapverse-dynamic-;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/mini-fb/manifest.json',
  '/murray.png',
  '/mini-fb/murray.png',
  '/mini-fb/messages.html',
  '/mini-fb/settings.html',
  '/mini-fb/profile.html',
  '/mini-fb/explore.html',
  '/mini-fb/search.html',
  '/mini-fb/reels.html',
  '/mini-fb/saved.html',
  '/mini-fb/hashtag.html',
  '/mini-fb/admin.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
      ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        }
      })
    )).then(() => self.clients.claim())
  );
});

function getCacheStrategy(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return 'network-first';
  if (STATIC_ASSETS.some(a => a.startsWith('http') ? url.href === a : url.pathname === a)) return 'cache-first';
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic')) return 'network-first';
  if (request.destination === 'image') return 'cache-first';
  if (request.destination === 'document') return 'network-first';
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
  } catch (e) { throw e; }
}

async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const p = fetch(request).then(r => { if (r.ok) cache.put(request, r.clone()); return r; }).catch(e => cached || Promise.reject(e));
  return cached || p;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  try {
    const url = new URL(event.request.url);
    if (url.protocol === 'chrome-extension:' || url.protocol === 'about:' || url.protocol === 'data:') return;
    if (url.origin !== self.location.origin && (url.hostname.includes('cdn.tailwindcss.com') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com'))) return;
  } catch { return; }
  event.respondWith((async () => {
    const s = getCacheStrategy(event.request);
    return s === 'cache-first' ? cacheFirst(event.request) : s === 'network-first' ? networkFirst(event.request) : staleWhileRevalidate(event.request);
  })());
});

self.addEventListener('sync', event => { if (event.tag === 'sync-posts') event.waitUntil(syncPosts()); });
async function syncPosts() { console.log('Syncing offline posts...'); }
