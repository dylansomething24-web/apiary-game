const CACHE = 'apiary-v5';
const BASE = self.registration.scope;
const ASSETS = [
    BASE,
    BASE + 'index.html',
    BASE + 'manifest.json',
    BASE + 'phaser.min.js',
    BASE + 'icons/icon-192.png',
    BASE + 'icons/icon-512.png',
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ));
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
