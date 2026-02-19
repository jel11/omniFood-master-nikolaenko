// ============================================================
// Omnifood — Service Worker для офлайн-работы и кэширования
// УП 09.02 — День 4: Кэширование и сетевые оптимизации
// ============================================================

const CACHE_NAME = 'omnifood-v1';

// Статические ресурсы для предварительного кэширования
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/general.css',
    '/css/style.css',
    '/css/queries.css',
    '/js/script.js',
    '/img/omnifood-logo.webp',
    '/img/hero.webp',
    '/img/hero-min.webp',
    '/img/meals/meal-1.webp',
    '/img/meals/meal-2.webp',
    '/img/app/app-screen-1.webp',
    '/img/app/app-screen-2.webp',
    '/img/app/app-screen-3.webp',
    '/img/customers/dave.webp',
    '/img/customers/ben.webp',
    '/img/customers/steve.webp',
    '/img/customers/hannah.webp',
];

// --- Установка: кэшируем статику ---
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// --- Активация: очищаем старые кэши ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// --- Fetch: стратегия Cache First для статики, Network First для HTML ---
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Только для нашего домена
    if (url.origin !== location.origin) return;

    // HTML — Network First (всегда свежий контент)
    if (request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Всё остальное — Cache First
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request).then(response => {
                const cloned = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
                return response;
            });
        })
    );
});
