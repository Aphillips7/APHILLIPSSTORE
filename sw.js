// Service Worker de Aphillips Store — version del cache
// Cada vez que publiques cambios en HTML, CSS o JS, sube este numero
// (ej: 'aphillips-v3'). Al activarse la version nueva se borra el cache viejo.
const CACHE_NAME = 'aphillips-v2';

// Solo el "cascaron" de la app: nunca datos, nunca Firebase, nunca fuentes externas.
// Si agregas o renombras un archivo en /css o /js, agregalo tambien aqui.
const SHELL_FILES = [
  './',
  './index.html',
  './catalogo.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './img/logo.png',
  './img/logo-acceso.png',
  // CSS del panel
  './css/panel/base.css',
  './css/panel/componentes.css',
  './css/panel/finanzas.css',
  './css/panel/auth.css',
  './css/panel/modales.css',
  './css/panel/movil.css',
  // CSS del catalogo
  './css/catalogo/base.css',
  './css/catalogo/tarjetas.css',
  './css/catalogo/paneles.css',
  './css/catalogo/generos.css',
  './css/catalogo/vistas.css',
  './css/catalogo/modal.css',
  './css/catalogo/buscador.css',
  './css/catalogo/hero.css',
  './css/catalogo/destacados.css',
  './css/catalogo/listado.css',
  './css/catalogo/filtros.css',
  // JS compartido
  './js/firebase.js',
  './js/products.js',
  // JS del panel
  './js/panel/main.js',
  './js/panel/state.js',
  './js/panel/nav.js',
  './js/panel/inicio.js',
  './js/panel/catalogo-admin.js',
  './js/panel/contenido.js',
  './js/panel/sesion.js',
  './js/panel/respaldo.js',
  './js/panel/pwa.js',
  './js/panel/auth/totp.js',
  './js/panel/auth/auth-overlay.js',
  './js/panel/clientes/clientes.js',
  './js/panel/clientes/cliente-detalle.js',
  './js/panel/finanzas/fechas.js',
  './js/panel/finanzas/finanzas.js',
  './js/panel/finanzas/registrar-venta.js',
  './js/panel/finanzas/registrar-compra.js',
  './js/panel/finanzas/registrar-otros.js',
  './js/panel/finanzas/historial.js',
  './js/panel/finanzas/resumen.js',
  './js/panel/finanzas/analisis.js',
  './js/panel/inventario/lista.js',
  './js/panel/inventario/formulario.js',
  './js/panel/inventario/fotos.js',
  './js/panel/inventario/detalle.js',
  './js/panel/inventario/venta-modal.js',
  './js/panel/inventario/reservas.js',
  './js/panel/inventario/transacciones.js',
  './js/panel/sync/sync.js',
  './js/panel/sync/listeners.js',
  './js/panel/sync/estado-sync.js',
  './js/panel/sync/espacio.js',
  './js/panel/sync/catalogo-publico.js',
  // JS del catalogo
  './js/catalogo/main.js',
  './js/catalogo/ui.js',
  './js/catalogo/whatsapp.js',
  './js/catalogo/favoritos.js',
  './js/catalogo/cuenta.js',
  './js/catalogo/header.js',
  './js/catalogo/metricas.js',
  './js/catalogo/datos.js',
  './js/catalogo/destacados.js',
  './js/catalogo/vistas.js',
  './js/catalogo/filtros.js',
  './js/catalogo/grid.js',
  './js/catalogo/modal.js',
  './js/catalogo/buscador.js'
  // Las fotos grandes del catalogo (img/*.webp) no se precargan: se guardan
  // en el cache la primera vez que se ven, para no gastar datos del celular.
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Uno por uno: si algun archivo falla, los demas igual quedan guardados.
      return Promise.all(SHELL_FILES.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
      }));
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
  // cache:'no-cache' obliga a revisar con el servidor en vez de usar la copia
  // del navegador (GitHub Pages la guarda 10 min), asi el HTML y los modulos
  // JS siempre llegan de la misma version.
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(function (res) {
        if (res.ok) {
          var copia = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copia); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
  );
});
