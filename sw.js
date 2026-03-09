const CACHE_NAME = 'csa-trainer-v2.0';
const urlsToCache = [
  './',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Força a instalação imediata do novo Service Worker
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Estratégia: Network First, mas NUNCA faz cache de HTML, CSS, JS
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isAsset = url.pathname.endsWith('.png') || 
                  url.pathname.endsWith('.jpg') || 
                  url.pathname.endsWith('.svg') ||
                  url.pathname.endsWith('.json');
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Só faz cache de assets (imagens, manifest)
        if (isAsset) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Se falhar, usa a cache (só para assets)
        return caches.match(event.request);
      })
  );
});

// Limpa caches antigas e assume controlo imediatamente
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});
