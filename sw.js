const CACHE_VERSION = 'v3';
const CACHE_NAME = `snapverse-${CACHE_VERSION}`;
const STATIC_CACHE = `snapverse-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `snapverse-dynamic-${CACHE_VERSION}`;

// Static assets to cache on install
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

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Determine caching strategy based on request
function getCacheStrategy(request) {
  const url = new URL(request.url);

  // Only cache GET requests
  if (request.method !== 'GET') {
    return 'network-first';
  }

  // Static assets - cache first
  if (STATIC_ASSETS.some(asset => {
    if (asset.startsWith('http')) {
      return url.href === asset;
    }
    return url.pathname === asset;
  })) {
    return 'cache-first';
  }

  // API calls - network first
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic')) {
    return 'network-first';
  }

  // Images - cache first with short TTL
  if (request.destination === 'image') {
    return 'cache-first';
  }

  // HTML pages - network first with cache fallback
  if (request.destination === 'document') {
    return 'network-first';
  }

  // Default - stale while revalidate
  return 'stale-while-revalidate';
}

// Cache-first strategy
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Cache-first failed:', error);
    throw error;
  }
}

// Network-first strategy
async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(error => {
    console.error('Fetch failed in stale-while-revalidate:', error);
    if (cached) return cached;
    throw error;
  });

  return cached || fetchPromise;
}

// Fetch event - apply appropriate caching strategy
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Bypass service worker for cross-origin static asset requests like Tailwind CDN
  if (requestUrl.origin !== self.location.origin) {
    if (
      requestUrl.hostname.includes('cdn.tailwindcss.com') ||
      requestUrl.hostname.includes('fonts.googleapis.com') ||
      requestUrl.hostname.includes('fonts.gstatic.com')
    ) {
      return; // Let the browser handle cross-origin CDN and font fetches directly
    }
  }

  event.respondWith(
    (async () => {
      const strategy = getCacheStrategy(event.request);

      switch (strategy) {
        case 'cache-first':
          return cacheFirst(event.request);
        case 'network-first':
          return networkFirst(event.request);
        case 'stale-while-revalidate':
          return staleWhileRevalidate(event.request);
        default:
          return staleWhileRevalidate(event.request);
      }
    })()
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  }
});

// Sync posts when back online
async function syncPosts() {
  // Implementation for syncing offline posts
  console.log('Syncing offline posts...');
}
