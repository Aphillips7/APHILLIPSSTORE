// =================== APLICAR EL DISENO PUBLICADO EN LA TIENDA ===================
// 1) Un script corto en el <head> de cada pagina pone el ultimo diseno guardado en este navegador antes de
//    pintar (sin parpadeo de colores viejos).
// 2) Este modulo pide el diseno publicado (api /sitio), lo aplica y lo guarda para la proxima visita.
// 3) Vista previa del panel: con ?vista-previa=1 dentro del panel, aplica lo que el editor manda por mensaje
//    (sin guardarlo y sin contar visitas ni clics).
import { cssDeTema } from './tema.js';

const API = 'https://api.aphillipsstore.com/sitio';
const CLAVE = 'aph_tema_css';
const VISTA_PREVIA = new URLSearchParams(location.search).has('vista-previa') && window.parent !== window;

function poner(css){
  var s = document.getElementById('tema-sitio');
  if(!s){ s = document.createElement('style'); s.id = 'tema-sitio'; document.head.appendChild(s); }
  if(s.textContent !== css) s.textContent = css;
}

if(VISTA_PREVIA){
  // en la vista previa del panel no se muestra el aviso de cookies (taparia la tienda)
  var sc = document.createElement('style'); sc.textContent = '#aviso-cookies,.aviso-cookies,.cookies{display:none !important;}'; document.head.appendChild(sc);
  window.addEventListener('message', function(e){
    if(e.origin !== location.origin || !e.data || e.data.tipo !== 'aph-tema') return;
    poner(cssDeTema(e.data.tema));
  });
  try{ window.parent.postMessage({ tipo: 'aph-vista-lista' }, location.origin); }catch(e){}
} else {
  fetch(API, { cache: 'no-cache' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
    if(!d) return;
    var css = cssDeTema(d.tema || {});
    poner(css);
    try{ if(css) localStorage.setItem(CLAVE, css); else localStorage.removeItem(CLAVE); }catch(e){}
  }).catch(function(){ /* sin internet: queda el ultimo diseno guardado */ });
}
