/* =========================================================
   service-worker.js — cache offline untuk PWA / WebView APK
   ========================================================= */

const CACHE_NAME = 'tabungku-cache-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/animation.css',
  './css/streak.css',
  './css/responsive.css',
  './js/utils.js',
  './js/storage.js',
  './js/chart.js',
  './js/dashboard.js',
  './js/income.js',
  './js/expense.js',
  './js/saving.js',
  './js/target.js',
  './js/reminder.js',
  './js/cycle.js',
  './js/streak.js',
  './js/report.js',
  './js/settings.js',
  './js/ai-assistant.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/streak/level1_pemula.png',
  './assets/icons/streak/level2_konsisten.png',
  './assets/icons/streak/level3_ahli.png',
  './assets/icons/streak/level4_elite.png',
  './assets/icons/streak/level5_master.png',
  './assets/icons/streak/level6_legend.png',
  './assets/icons/streak/level7_mythic.png',
  './assets/icons/streak/level8_immortal.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200){
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || networkFetch;
    })
  );
});
