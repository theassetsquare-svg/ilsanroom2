// 일산룸 현지인 가이드 Service Worker
// version: 2026-06-02
const CACHE = 'ilsanroom2-v2026-06-02';
const ASSETS = [
  '/',
  '/style.css',
  '/script.js',
  '/og-image.png',
  '/site.webmanifest',
  '/guide/',
  '/review/',
  '/reservation/',
  '/parking/',
  '/area/',
  '/faq/',
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

  // HTML navigations → network-first (so deploys appear immediately, no stale page).
  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy).catch(function () {}); });
        }
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (cached) { return cached || caches.match('/'); });
      })
    );
    return;
  }

  // Static assets → stale-while-revalidate.
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
