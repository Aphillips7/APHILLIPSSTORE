import { db } from '../../firebase.js';
import { state } from '../state.js';
import { camposPublicos, esPublicable } from '../../products.js';

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
}

export { _lastSyncedPublico, cargarCatalogoPublicoRemoto, marcarInventarioCargado, syncCatalogoPublico };
