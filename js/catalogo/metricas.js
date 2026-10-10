import { db, firebase } from '../firebase.js';

var _vistasContadas = new Set();
function incMetrica(id, campo){
  if(!id) return;
  var upd = {}; upd[campo] = firebase.firestore.FieldValue.increment(1);
  upd['_ultima'] = Date.now();
  db.collection('metricas_catalogo').doc(id).set(upd, {merge:true}).catch(function(){});
}

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

export { _io, _vistasContadas, incMetrica };
