// 일산룸 현지인 가이드 Service Worker
// version: 2026-05-21
const CACHE = 'ilsanroom2-v2026-05-21';
const ASSETS = [
  '/',
  '/style.css',
  '/script.js',
  '/og-image.png',
  '/site.webmanifest',
  '/legal/'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS).catch(function () {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        const network = fetch(req).then(function (resp) {
          if (resp && resp.status === 200) {
            cache.put(req, resp.clone()).catch(function () {});
          }
          return resp;
        }).catch(function () { return cached; });
        return cached || network;
      });
    })
  );
});
