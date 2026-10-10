import { db, firebase } from '../../firebase.js';
import { state } from '../state.js';
import { camposPublicos, esPublicable } from '../../products.js';

// ---------- copia del catalogo en Cloudflare ----------
// Los clientes leen el catalogo de https://api.aphillipsstore.com/catalogo (sin gastar lecturas
// de Firebase). Despues de cada sincronizacion el panel publica ahi la lista completa de relojes
// publicables, solo con camposPublicos (el Worker vuelve a filtrar por si acaso).
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

// Copia publica del inventario: solo los campos de camposPublicos() de los relojes publicables.
// _lastSyncedPublico refleja lo que REALMENTE hay en la nube (lo llena el listener de
// catalogo_publico), asi se borran tambien relojes que dejaron de ser publicables en otra
// sesion u otro dispositivo (p. ej. vendidos hace mas de DIAS_AGOTADO_VISIBLE dias).
var _lastSyncedPublico = {};
var _inventarioCargado = false; // sin el inventario real no se puede decidir que borrar
function marcarInventarioCargado(){ _inventarioCargado = true; }
function cargarCatalogoPublicoRemoto(snap){
  var remoto = {};
  snap.forEach(function(doc){
    var d = doc.data();
    var limpio = camposPublicos(d);
    // si el documento tiene campos de mas (p. ej. privados), forzar que se reescriba
    var extras = Object.keys(d).some(function(k){ return !(k in limpio); });
    remoto[doc.id] = extras ? '' : JSON.stringify(limpio);
  });
  Object.keys(_lastSyncedPublico).forEach(function(id){ delete _lastSyncedPublico[id]; });
  Object.assign(_lastSyncedPublico, remoto);
}
async function syncCatalogoPublico(){
  if(!_inventarioCargado) return;
  try{
    var coll=db.collection('catalogo_publico');
    var ops=[];
    var idsVisibles=new Set();
    state.inventario.forEach(function(p){
      if(!esPublicable(p)) return;
      idsVisibles.add(p.id);
      var pub=camposPublicos(p);
      var json=JSON.stringify(pub);
      if(_lastSyncedPublico[p.id]!==json){ ops.push({tipo:'set',id:p.id,item:pub,json:json}); }
    });
    Object.keys(_lastSyncedPublico).forEach(function(id){
      if(!idsVisibles.has(id)) ops.push({tipo:'delete',id:id});
    });
    for(var i=0;i<ops.length;i+=450){
      var chunk=ops.slice(i,i+450);
      var batch=db.batch();
      chunk.forEach(function(op){
        if(op.tipo==='set'){ batch.set(coll.doc(op.id),op.item); }
        else { batch.delete(coll.doc(op.id)); }
      });
      await batch.commit();
      chunk.forEach(function(op){
        if(op.tipo==='set'){ _lastSyncedPublico[op.id]=op.json; }
        else { delete _lastSyncedPublico[op.id]; }
      });
    }
  }catch(e){
    // El catalogo publico es un extra; si falla, no debe romper el sync normal del negocio.
  }
  publicarCatalogoCloudflare();
}

export { _lastSyncedPublico, cargarCatalogoPublicoRemoto, marcarInventarioCargado, publicarCatalogoCloudflare, syncCatalogoPublico };
