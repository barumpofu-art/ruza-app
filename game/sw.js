/* sw.js — offline shell. Bump CACHE on every release. */
var CACHE = 'kgosi-cadre-v6';
var ASSETS = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './icon.svg', './icon-maskable.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './js/core.js', './js/data-countries.js', './js/data-ladder.js', './js/data-actions.js',
  './js/data-events.js', './js/data-dialogue.js', './js/people.js', './js/elections.js',
  './js/engine.js', './js/governance.js', './js/dialogue.js', './js/crisis.js', './js/sprint.js', './js/revolt.js',
  './js/ui.js', './js/main.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (r) {
      var copy = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return r;
    }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('./index.html'); }); })
  );
});
