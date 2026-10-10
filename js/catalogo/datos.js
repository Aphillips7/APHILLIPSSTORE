import { render } from './grid.js';
import { abrir } from './modal.js';
import { db } from '../firebase.js';

let relojes = [];

let _deepLinkHandled = false;
const _idInicial = new URLSearchParams(location.search).get('id');
if(_idInicial){ history.replaceState(null, '', location.pathname); }

db.collection('catalogo_publico').onSnapshot(function(snap){
  relojes = [];
  snap.forEach(function(doc){
    var d = doc.data(); d.id = doc.id;
    relojes.push(d);
  });
  relojes.sort(function(a,b){ return (b._ts||0)-(a._ts||0); });
  render();
  if(!_deepLinkHandled){
    _deepLinkHandled = true;
    if(_idInicial){ abrir(_idInicial); }
  }
}, function(){
  document.getElementById('grid').innerHTML = '<div class="empty" style="grid-column:1/-1;"><span>&#9906;</span>No se pudo cargar el catalogo. Revisa tu conexion.</div>';
});

export { _deepLinkHandled, _idInicial, relojes };
