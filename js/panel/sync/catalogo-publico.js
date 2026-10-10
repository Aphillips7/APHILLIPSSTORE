import { db } from '../../firebase.js';
import { state } from '../state.js';
import { camposPublicos, esPublicable } from '../../products.js';

var _lastSyncedPublico = {};
async function syncCatalogoPublico(){
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

export { _lastSyncedPublico, syncCatalogoPublico };
