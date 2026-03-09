const CACHE_NAME = 'csa-trainer-v1.9';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './flashcards.js',
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

// Estratégia Network First com fallback para cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clona a resposta para guardar em cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        // Se falhar, usa a cache
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
