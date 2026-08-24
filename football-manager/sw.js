// Offline cache for the installed game. Everything is static, so the shell is
// cached on install and served cache-first; bump CACHE to ship an update.
const CACHE = 'kalahari-manager-v1';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './js/main.js',
  './js/rng.js',
  './js/data.js',
  './js/players.js',
  './js/formations.js',
  './js/lineup.js',
  './js/engine.js',
  './js/league.js',
  './js/state.js',
  './js/storage.js',
  './js/dom.js',
  './js/screens.js',
  './js/matchview.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, cache as the fallback. Cache-first would be faster by a
// millisecond and would also keep serving last week's code after an update —
// including inside the APK, where "the network" is just the app's own assets.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match('./index.html')))
  );
});
