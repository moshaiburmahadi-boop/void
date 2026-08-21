const CACHE_NAME = 'void-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Pass-through fetch handler required for PWA install prompt
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
