// =================== PROMOCIONES EN LA TIENDA (fase 3) ===================
// Barra de anuncios que rota (cada 5 s, con fundido) y ventana emergente (una sola vez por visitante y por
// contenido; al entrar despues de unos segundos o al intentar salir). Avisa al catalogo cuando llegan las
// promociones (evento "sitio-promos") para que vuelva a pintar precios y etiquetas.
import { validarPromos, vigente } from './promos.js';

var _rotar = null, _popupHecho = false;

function aplicarPromos(p, opc){
  p = validarPromos(p); opc = opc || {};
  window.__promos = p;
  barra(p);
  popup(p, opc);
  try{ document.dispatchEvent(new CustomEvent('sitio-promos', { detail: p })); }catch(e){}
}

// ---------- barra de anuncios ----------
function barra(p){
  var b = document.querySelector('.barra-aviso'); if(!b) return;
  clearInterval(_rotar);
  var lista = p.anuncios.filter(function(a){ return vigente(a.desde, a.hasta); }).map(function(a){ return a.texto; });
  // sin anuncios vigentes queda el texto de la barra (el original o el puesto en Portada, que se aplica antes)
  b.style.opacity = '';
  if(!lista.length) return;
  var i = 0; b.textContent = lista[0]; b.style.transition = 'opacity .35s ease';
  if(lista.length < 2) return;
  _rotar = setInterval(function(){
    b.style.opacity = '0';
    setTimeout(function(){ i = (i + 1) % lista.length; b.textContent = lista[i]; b.style.opacity = '1'; }, 350);
  }, 5000);
}

// ---------- ventana emergente ----------
function huella(q){ var s = q.titulo + '|' + q.texto + '|' + q.boton, h = 0; for(var i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) | 0; } return String(h); }
function vista(clave){ try{ return localStorage.getItem('aph_popup_visto') === clave; }catch(e){ return false; } }
function marcarVista(clave){ try{ localStorage.setItem('aph_popup_visto', clave); }catch(e){} }
function popup(p, opc){
  var q = p.popup;
  if(opc.forzarPopup){ mostrarPopup(q, null); return; }
  if(_popupHecho || !q.activo || !(q.titulo || q.texto) || !vigente(q.desde, q.hasta) || window.__vistaPrevia) return;
  if(!document.getElementById('catalogo')) return;   // solo en la tienda (no en la guia ni en las paginas legales)
  var clave = huella(q); if(vista(clave)) return;
  _popupHecho = true;
  var tactil = window.matchMedia && window.matchMedia('(hover: none)').matches;
  if(q.momento === 'salida' && !tactil){
    var alSalir = function(e){ if(e.clientY <= 0 && !e.relatedTarget){ document.removeEventListener('mouseout', alSalir); mostrarPopup(q, clave); } };
    setTimeout(function(){ document.addEventListener('mouseout', alSalir); }, 4000);
  } else {
    // en celular no hay "salida": se muestra despues de un rato mas largo
    setTimeout(function(){ mostrarPopup(q, clave); }, (q.momento === 'salida' ? 2 : 1) * q.segundos * 1000);
  }
}
function mostrarPopup(q, clave){
  var viejo = document.getElementById('aph-popup'); if(viejo) viejo.remove();
  if(document.body.classList.contains('prod-abierto') && clave) return;   // no interrumpe la ficha de un reloj
  var f = document.createElement('div'); f.id = 'aph-popup'; f.className = 'aph-popup'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true');
  var c = document.createElement('div'); c.className = 'aph-popup-caja';
  var x = document.createElement('button'); x.type = 'button'; x.className = 'aph-popup-x'; x.setAttribute('aria-label', 'Cerrar'); x.textContent = '×';
  var h = document.createElement('h2'); h.textContent = q.titulo;
  var t = document.createElement('p'); t.textContent = q.texto;
  c.appendChild(x); if(q.titulo) c.appendChild(h); if(q.texto) c.appendChild(t);
  if(q.boton && q.destino !== 'ninguno'){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'aph-popup-btn'; b.textContent = q.boton;
    b.addEventListener('click', function(){
      cerrar();
      if(q.destino === 'reloj' && q.reloj && window.abrir) window.abrir(q.reloj);
      else if(q.destino === 'boletin'){ var bo = document.querySelector('.bol-caja, #boletin, .pie-boletin'); if(bo) bo.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else if(window.irAGenero) window.irAGenero('', null); else location.href = '/relojes';
    });
    c.appendChild(b);
  }
  f.appendChild(c); document.body.appendChild(f);
  requestAnimationFrame(function(){ f.classList.add('abierta'); });
  function cerrar(){ if(clave) marcarVista(clave); f.classList.remove('abierta'); setTimeout(function(){ f.remove(); }, 250); document.removeEventListener('keydown', esc); }
  function esc(e){ if(e.key === 'Escape') cerrar(); }
  x.addEventListener('click', cerrar);
  f.addEventListener('click', function(e){ if(e.target === f) cerrar(); });
  document.addEventListener('keydown', esc);
  if(clave) marcarVista(clave);   // aunque recargue la pagina, no vuelve a salir
  setTimeout(function(){ x.focus(); }, 50);
}

export { aplicarPromos };
