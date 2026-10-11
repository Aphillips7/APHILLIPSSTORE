import { firebase } from '../../firebase.js';
import { state } from '../state.js';
import { camposPublicos, esPublicable } from '../../products.js';

// ---------- catalogo publico en Cloudflare ----------
// Los clientes leen el catalogo de https://api.aphillipsstore.com/catalogo. Despues de cada
// sincronizacion el panel publica ahi la lista completa de relojes publicables, solo con
// camposPublicos (el Worker vuelve a filtrar por si acaso). Como se publica la lista completa,
// lo que deja de ser publicable (vendido hace mas de DIAS_AGOTADO_VISIBLE dias, oculto...)
// desaparece solo.
var API_CATALOGO = 'https://api.aphillipsstore.com/catalogo';
var _ultimoPublicadoCF = null, _publicandoCF = false, _pendienteCF = false;
async function publicarCatalogoCloudflare(){
  if(_publicandoCF){ _pendienteCF = true; return; }
  var usuario = firebase.auth && firebase.auth().currentUser;
  if(!usuario || !navigator.onLine) return;
  var relojes = state.inventario.filter(esPublicable).map(function(p){
    var o = camposPublicos(p); o.id = p.id; return o;
  });
  relojes.sort(function(a,b){ return (b._ts||0)-(a._ts||0); });
  var json = JSON.stringify(relojes);
  if(json === _ultimoPublicadoCF) return;   // nada cambio desde la ultima publicacion
  _publicandoCF = true;
  try{
    var token = await usuario.getIdToken();
    var r = await fetch(API_CATALOGO, { method:'PUT', headers:{ 'Authorization':'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ relojes: relojes }) });
    if(r.ok) _ultimoPublicadoCF = json;
  }catch(e){ /* sin conexion o error: se reintenta en la proxima sincronizacion */ }
  _publicandoCF = false;
  if(_pendienteCF){ _pendienteCF = false; publicarCatalogoCloudflare(); }
}

// Sin el inventario confirmado por la nube no se publica (se borrarian relojes del catalogo)
var _inventarioCargado = false;
function marcarInventarioCargado(){ _inventarioCargado = true; }
async function syncCatalogoPublico(){
  if(!_inventarioCargado) return;
  await publicarCatalogoCloudflare();
}

export { marcarInventarioCargado, publicarCatalogoCloudflare, syncCatalogoPublico };
