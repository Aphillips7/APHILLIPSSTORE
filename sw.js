// Service Worker de Aphillips Store — version del cache
// Si actualizas index.html y quieres forzar que los dispositivos bajen la version nueva,
// sube este numero (ej: 'aphillips-v2') y listo.
const CACHE_NAME = 'aphillips-v1';

// Solo el "cascaron" de la app: nunca datos, nunca Firebase, nunca fuentes externas.
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES).catch(function () {
        // Si algun archivo no existe todavia (ej. primer deploy), no rompas la instalacion.
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(
        nombres.filter(function (n) { return n !== CACHE_NAME; })
               .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Solo nos metemos en peticiones GET de nuestro propio dominio.
  // Todo lo demas (Firebase, Firestore, Auth, Google Fonts, CDNs) pasa de largo,
  // intacto, directo a la red — nunca lo tocamos ni lo cacheamos.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Red primero (para que siempre uses la version mas nueva si hay internet),
  // y si no hay conexion, cae al cascaron guardado para que la app abra igual.
  event.respondWith(
    fetch(req)
      .then(function (res) {
        var copia = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copia); });
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
  );
});
