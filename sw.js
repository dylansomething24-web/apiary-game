const CACHE = 'apiary-v3';
const ASSETS = [
    '/apiary-game/',
    '/apiary-game/index.html',
    '/apiary-game/manifest.json',
    '/apiary-game/phaser.min.js',
    '/apiary-game/icons/icon-192.png',
    '/apiary-game/icons/icon-512.png',
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
