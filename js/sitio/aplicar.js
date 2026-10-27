// =================== APLICAR LO PUBLICADO DESDE EL EDITOR EN LA TIENDA ===================
// 1) Un script corto en el <head> de cada pagina pone el ultimo diseno guardado en este navegador antes de
//    pintar (sin parpadeo de colores viejos).
// 2) Este modulo aplica de inmediato la ultima configuracion guardada (textos y orden de la portada), pide la
//    publicada (api /sitio), la aplica y la guarda para la proxima visita.
// 3) Vista previa del panel: con ?vista-previa=1 dentro del panel, aplica lo que el editor manda por mensaje
//    (sin guardarlo y sin contar visitas ni clics).
// 4) Enlace de vista previa (?vista=<codigo>, creado en Tienda > Control): muestra ese borrador a quien tenga el
//    enlace, con una franja que lo avisa; no se guarda ni cuenta visitas.
import { cssDeTema } from './tema.js';
import { aplicarPortada } from './portada.js';
import { aplicarPromos } from './promos-tienda.js';
import { aplicarContenido } from './contenido.js';
import { aplicarControl, contarSecciones } from './control.js';

const API = 'https://api.aphillipsstore.com/sitio';
const CLAVE_CSS = 'aph_tema_css', CLAVE_SITIO = 'aph_sitio';
const VISTA_PREVIA = new URLSearchParams(location.search).has('vista-previa') && window.parent !== window;
const CODIGO_VISTA = (new URLSearchParams(location.search).get('vista') || '').match(/^[a-f0-9]{32}$/) ? new URLSearchParams(location.search).get('vista') : '';

function poner(css){
  var s = document.getElementById('tema-sitio');
  if(!s){ s = document.createElement('style'); s.id = 'tema-sitio'; document.head.appendChild(s); }
  if(s.textContent !== css) s.textContent = css;
}
function aplicar(sitio){
  sitio = sitio || {};
  poner(cssDeTema(sitio.tema || {}));
  try{ aplicarPortada(sitio.portada || {}); }catch(e){}
  try{ aplicarPromos(sitio.promos || {}); }catch(e){}
  try{ aplicarContenido(sitio.contenido || {}); }catch(e){}
  try{ aplicarControl(sitio.control || {}); }catch(e){}
}

if(VISTA_PREVIA){
  // en la vista previa del panel no se muestra el aviso de cookies (taparia la tienda)
  var sc = document.createElement('style'); sc.textContent = '#aviso-cookies,.aviso-cookies,.cookies{display:none !important;}'; document.head.appendChild(sc);
  window.addEventListener('message', function(e){
    if(e.origin !== location.origin || !e.data) return;
    if(e.data.tipo === 'aph-sitio') aplicar(e.data.sitio);
    if(e.data.tipo === 'aph-tema') poner(cssDeTema(e.data.tema));   // compatibilidad con la fase 1
    if(e.data.tipo === 'aph-popup') aplicarPromos(e.data.promos, { forzarPopup: true });   // "Ver la ventana" del editor
  });
  try{ window.parent.postMessage({ tipo: 'aph-vista-lista' }, location.origin); }catch(e){}
} else if(CODIGO_VISTA){
  window.__vistaPrevia = true;   // no cuenta visitas ni muestra la ventana emergente
  fetch(API + '?vista=' + CODIGO_VISTA, { cache: 'no-store' }).then(function(r){ return r.json().then(function(d){ return { ok: r.ok, d: d }; }); }).then(function(x){
    var f = document.createElement('div'); f.className = 'franja-vista-previa';
    f.textContent = x.ok ? 'Vista previa: así se verá la tienda con los cambios. Los clientes todavía no la ven.' : 'Este enlace de vista previa ya venció o no existe.';
    document.body.appendChild(f);
    if(x.ok) aplicar(x.d);
  }).catch(function(){});
} else {
  try{ var guardado = JSON.parse(localStorage.getItem(CLAVE_SITIO) || 'null'); if(guardado){ aplicarPortada(guardado.portada || {}); aplicarPromos(guardado.promos || {}); aplicarContenido(guardado.contenido || {}); aplicarControl(guardado.control || {}); } }catch(e){}
  fetch(API, { cache: 'no-cache' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
    if(!d) return;
    aplicar(d);
    var css = cssDeTema(d.tema || {});
    try{
      if(css) localStorage.setItem(CLAVE_CSS, css); else localStorage.removeItem(CLAVE_CSS);
      localStorage.setItem(CLAVE_SITIO, JSON.stringify({ portada: d.portada || {}, promos: d.promos || {}, contenido: d.contenido || {}, control: d.control || {} }));
    }catch(e){}
  }).catch(function(){ /* sin internet: queda lo ultimo guardado */ });
  contarSecciones();
}
