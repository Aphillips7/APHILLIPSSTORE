// =================== PWA: instalar como app ===================
var _pwaInstallEvent = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  _pwaInstallEvent = e;
  var card = document.getElementById('card-instalar-pwa');
  if (card) card.style.display = 'flex';
});
function instalarPWA() {
  if (!_pwaInstallEvent) return;
  _pwaInstallEvent.prompt();
  _pwaInstallEvent.userChoice.then(function () {
    _pwaInstallEvent = null;
    var card = document.getElementById('card-instalar-pwa');
    if (card) card.style.display = 'none';
  });
}
window.addEventListener('appinstalled', function () {
  var card = document.getElementById('card-instalar-pwa');
  if (card) card.style.display = 'none';
});

// =================== PWA: registrar el service worker ===================
// Solo en https:// (o localhost) — nunca en file:// para no romper pruebas locales.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {
      // Si falla (ej. abierto como archivo local), la app sigue funcionando normal, solo sin PWA.
    });
  });
}

export { _pwaInstallEvent, instalarPWA };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { instalarPWA });
