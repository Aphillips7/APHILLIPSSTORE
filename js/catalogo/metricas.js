// Metricas del catalogo (vistas, aperturas del detalle, clics a WhatsApp).
// Se juntan en memoria y se envian a Cloudflare en un solo envio cada 20 s y al salir de la pagina
// (antes era una escritura de Firestore por cada reloj visto). El servidor cuenta como maximo
// 1 vista / 1 apertura / 1 clic por reloj en cada envio.
const API_METRICAS = 'https://api.aphillipsstore.com/metricas';

var _vistasContadas = new Set();
var _cola = [];
function incMetrica(id, campo){
  if(!id) return;
  // el dueno puede pedir que sus visitas no cuenten (opciones de desarrollador en Mi cuenta)
  try{ if(localStorage.getItem('aphillips_no_contar') === '1') return; }catch(e){}
  _cola.push([id, campo]);
  if(_cola.length >= 100) enviarMetricas();
}
function enviarMetricas(){
  if(!_cola.length) return;
  var cuerpo = JSON.stringify(_cola.splice(0, _cola.length));
  // texto plano: no necesita permiso previo (CORS) y funciona al cerrar la pagina
  var blob = new Blob([cuerpo], { type: 'text/plain' });
  if(navigator.sendBeacon && navigator.sendBeacon(API_METRICAS, blob)) return;
  try{ fetch(API_METRICAS, { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(function(){}); }catch(e){}
}
setInterval(enviarMetricas, 20000);
document.addEventListener('visibilitychange', function(){ if(document.hidden) enviarMetricas(); });
window.addEventListener('pagehide', enviarMetricas);

const _io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
  entries.forEach(function(en){
    if(en.isIntersecting){
      en.target.classList.add('visible');
      var rid = en.target.getAttribute('data-id');
      if(rid && !_vistasContadas.has(rid)){ _vistasContadas.add(rid); incMetrica(rid,'vistas'); }
      _io.unobserve(en.target);
    }
  });
}, {threshold:0.12, rootMargin:'0px 0px -30px 0px'}) : null;

export { _io, _vistasContadas, enviarMetricas, incMetrica };
