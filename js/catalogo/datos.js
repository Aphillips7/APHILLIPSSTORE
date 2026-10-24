import { render } from './grid.js';
import { abrir } from './modal.js';
import { aplicarMmDeUrl } from './filtros.js';

// Relojes del catalogo publico.
// Se leen de Cloudflare (https://api.aphillipsstore.com/catalogo) y se vuelven a pedir cada minuto
// mientras la pagina esta visible (si no cambio, el servidor responde 304 sin mandar nada).
// La ultima lista buena se guarda en el navegador: si Cloudflare no responde, se muestra esa.
const API_CATALOGO = 'https://api.aphillipsstore.com/catalogo';
const REFRESCO_MS = 60000;
const CLAVE_LOCAL = 'aphillips_catalogo';

let relojes = [];

let _deepLinkHandled = false;
const _idInicial = new URLSearchParams(location.search).get('id');
if(_idInicial){ history.replaceState(null, '', location.pathname); }

let _ultimoJson = '';
function aplicar(lista){
  var json = JSON.stringify(lista);
  if(json === _ultimoJson) return;          // sin cambios: no se vuelve a dibujar
  _ultimoJson = json;
  relojes = lista.slice();
  // el panel guarda el movimiento sin acentos (valores del selector): aqui se muestra bien escrito
  var MOVIMIENTOS = { 'cuarzo japones': 'Cuarzo', 'cuarzo japonés': 'Cuarzo', 'automatico': 'Automático', 'cronografo cuarzo': 'Cronógrafo de cuarzo' };
  relojes.forEach(function(r){ var m = MOVIMIENTOS[String(r.movimiento || '').trim().toLowerCase()]; if(m) r.movimiento = m; });
  relojes.sort(function(a,b){ return (b._ts||0)-(a._ts||0); });
  aplicarMmDeUrl();   // si viene de la guia de tamanos con ?mm=
  render();
  if(!_deepLinkHandled){
    _deepLinkHandled = true;
    if(_idInicial){ abrir(_idInicial); }
  }
}
function errorCarga(){
  document.getElementById('grid').innerHTML = '<div class="empty" style="grid-column:1/-1;"><span>&#9906;</span>No se pudo cargar el catálogo. Revisa tu conexión.</div>';
}

async function pedirCloudflare(){
  // no-cache: el navegador pregunta con If-None-Match y, si no cambio, el servidor responde 304
  // sin volver a mandar el catalogo (se usa la copia que ya tiene)
  var r = await fetch(API_CATALOGO, { cache: 'no-cache' });
  if(!r.ok) throw new Error('catalogo ' + r.status);
  var d = await r.json();
  if(!Array.isArray(d.relojes)) throw new Error('catalogo sin relojes');
  return d.relojes;
}

function guardarLocal(lista){ try{ localStorage.setItem(CLAVE_LOCAL, JSON.stringify(lista)); }catch(e){} }
function leerLocal(){ try{ var l = JSON.parse(localStorage.getItem(CLAVE_LOCAL) || 'null'); return Array.isArray(l) ? l : null; }catch(e){ return null; } }
function actualizar(){
  return pedirCloudflare().then(function(lista){ guardarLocal(lista); aplicar(lista); });
}

(async function(){
  try{
    await actualizar();
  }catch(e){
    var guardada = leerLocal();
    if(guardada) aplicar(guardada); else errorCarga();
  }
  setInterval(function(){
    if(!document.hidden) actualizar().catch(function(){});
  }, REFRESCO_MS);
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden) actualizar().catch(function(){});
  });
})();

export { _deepLinkHandled, _idInicial, relojes };
