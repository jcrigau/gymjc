// Service Worker de GymJC — cachea todo para funcionar 100% offline.
const CACHE = 'gymjc-v1.02';

// Todos los recursos de la app (app shell). Al ser rutas relativas
// funciona igual en GitHub Pages dentro de un subdirectorio.
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/router.js',
  './js/store.js',
  './js/data/exercises.js',
  './js/utils/dom.js',
  './js/utils/format.js',
  './js/utils/progression.js',
  './js/components/nav.js',
  './js/components/sheet.js',
  './js/components/toast.js',
  './js/components/chart.js',
  './js/screens/home.js',
  './js/screens/routines.js',
  './js/screens/library.js',
  './js/screens/workout.js',
  './js/screens/history.js',
  './js/screens/stats.js',
  './js/screens/settings.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Estrategia: cache-first con actualización en segundo plano.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
