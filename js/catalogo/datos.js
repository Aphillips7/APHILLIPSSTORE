import { render } from './grid.js';
import { abrir } from './modal.js';
import { db } from '../firebase.js';

// Relojes del catalogo publico.
// 1) Se leen de Cloudflare (https://api.aphillipsstore.com/catalogo): rapido y sin gastar
//    lecturas de Firebase. Se vuelven a pedir cada minuto mientras la pagina esta visible.
// 2) Si Cloudflare no responde (o el catalogo aun no se publico), se usa Firestore
//    (catalogo_publico) como antes, en tiempo real.
const API_CATALOGO = 'https://api.aphillipsstore.com/catalogo';
const REFRESCO_MS = 60000;

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
  relojes.sort(function(a,b){ return (b._ts||0)-(a._ts||0); });
  render();
  if(!_deepLinkHandled){
    _deepLinkHandled = true;
    if(_idInicial){ abrir(_idInicial); }
  }
}
function errorCarga(){
  document.getElementById('grid').innerHTML = '<div class="empty" style="grid-column:1/-1;"><span>&#9906;</span>No se pudo cargar el catalogo. Revisa tu conexion.</div>';
}

async function pedirCloudflare(){
  var r = await fetch(API_CATALOGO, { cache: 'no-store' });
  if(!r.ok) throw new Error('catalogo ' + r.status);
  var d = await r.json();
  if(!Array.isArray(d.relojes)) throw new Error('catalogo sin relojes');
  return d.relojes;
}

let _usandoFirestore = false;
function usarFirestore(){
  if(_usandoFirestore) return;
  _usandoFirestore = true;
  db.collection('catalogo_publico').onSnapshot(function(snap){
    var lista = [];
    snap.forEach(function(doc){ var d = doc.data(); d.id = doc.id; lista.push(d); });
    aplicar(lista);
  }, function(){ if(!relojes.length) errorCarga(); });
}

(async function(){
  try{
    aplicar(await pedirCloudflare());
  }catch(e){
    usarFirestore();
    return;
  }
  setInterval(function(){
    if(document.hidden || _usandoFirestore) return;
    pedirCloudflare().then(aplicar).catch(function(){});
  }, REFRESCO_MS);
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden && !_usandoFirestore) pedirCloudflare().then(aplicar).catch(function(){});
  });
})();

export { _deepLinkHandled, _idInicial, relojes };
