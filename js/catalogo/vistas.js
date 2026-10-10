import { limpiarFiltros } from './filtros.js';
import { render } from './grid.js';
import { normalizar } from './ui.js';

let _filtroGenero = '';
let _filtroMarca = '';

var _TITULOS_GEN = {'':'Todos los relojes', hombre:'Relojes para hombre', mujer:'Relojes para mujer'};
var _DESC_GEN = {
  '': 'Explora todos los relojes disponibles en Aphillips Store. Toca cualquiera para ver sus detalles y consulta la disponibilidad directamente por WhatsApp.',
  hombre: 'Los relojes para hombre de Aphillips Store combinan elegancia y carácter: diseños audaces, movimientos automáticos y acabados pensados para durar. Consulta la disponibilidad de cada pieza directamente por WhatsApp.',
  mujer: 'Los relojes para mujer de Aphillips Store reúnen estilo y precisión: diseños refinados, detalles cuidados y piezas seleccionadas para acompañarte todos los días. Consulta la disponibilidad de cada pieza directamente por WhatsApp.'
};
var _HASH_GEN = {'#hombre':'hombre', '#mujer':'mujer', '#todos':''};
// Marcas: un reloj es de la marca si su nombre o coleccion la mencionan (sin importar espacios ni acentos)
var _MARCAS = {
  invicta: { nombre:'Invicta', desc:'Fundada en Suiza en 1837, Invicta combina diseño audaz y gran presencia en la muñeca: relojes de buceo y cronógrafos con carácter, a un precio accesible. Consulta la disponibilidad de cada pieza directamente por WhatsApp.' },
  bulova: { nombre:'Bulova', desc:'Desde 1875 en Nueva York, Bulova es sinónimo de innovación y precisión: movimientos automáticos, esferas abiertas y acabados elegantes. Consulta la disponibilidad de cada pieza directamente por WhatsApp.' },
  technomarine: { nombre:'TechnoMarine', desc:'Nacida en Miami en 1997, TechnoMarine mezcla espíritu deportivo y lujo casual, con correas intercambiables y diseños llenos de color. Consulta la disponibilidad de cada pieza directamente por WhatsApp.' }
};
function _marcaDeHash(h){ var m = (h||'').replace(/^#marca-/, ''); return (h||'').indexOf('#marca-')===0 && _MARCAS[m] ? m : ''; }
function _esHashCatalogo(h){ return Object.prototype.hasOwnProperty.call(_HASH_GEN, h) || !!_marcaDeHash(h); }

// Solo hay dos generos. Los relojes registrados como "unisex" aparecen tanto en hombre como en mujer.
function _genOk(r){
  if(_filtroGenero && r.genero!==_filtroGenero && r.genero!=='unisex') return false;
  if(_filtroMarca && !normalizar((r.nombre||'')+' '+(r.coleccion||'')).replace(/\s+/g,'').includes(_filtroMarca)) return false;
  return true;
}

function _ponerTitulo(titulo, desc){
  var t = document.getElementById('cat-titulo'); if(t) t.textContent = titulo;
  setDescripcion(desc);
}
function setGenero(g){
  if(g !== _filtroGenero || _filtroMarca){ limpiarFiltros(); }
  _filtroGenero = g; _filtroMarca = '';
  _ponerTitulo(_TITULOS_GEN[g] || _TITULOS_GEN[''], _DESC_GEN[g] || _DESC_GEN['']);
  if(document.body.classList.contains('vista-catalogo')){ history.replaceState(history.state, '', '#'+(g||'todos')); }
  render();
}
function setMarca(m){
  if(m !== _filtroMarca){ limpiarFiltros(); }
  _filtroMarca = m; _filtroGenero = '';
  _ponerTitulo('Relojes '+_MARCAS[m].nombre, _MARCAS[m].desc);
  if(document.body.classList.contains('vista-catalogo')){ history.replaceState(history.state, '', '#marca-'+m); }
  render();
}
function setDescripcion(texto){
  var box = document.getElementById('cat-desc'), p = document.getElementById('cat-desc-txt'), b = document.getElementById('cat-desc-btn');
  if(!p) return;
  p.textContent = texto;
  box.classList.remove('abierta'); b.textContent = '+'; b.setAttribute('aria-expanded','false');
  requestAnimationFrame(function(){ b.style.visibility = (p.scrollHeight > p.clientHeight + 1) ? 'visible' : 'hidden'; });
}
function toggleDesc(){
  var box = document.getElementById('cat-desc'), b = document.getElementById('cat-desc-btn');
  var ab = box.classList.toggle('abierta');
  b.textContent = ab ? '−' : '+'; b.setAttribute('aria-expanded', ab ? 'true' : 'false');
}
function _refrescarHeader(){ window.dispatchEvent(new Event('resize')); }
// g = genero ('' = todos). marca opcional: si viene, muestra la pagina de esa marca.
function mostrarCatalogo(g, push, marca){
  var bus = document.getElementById('buscador'); if(bus) bus.value = '';
  var yaEnCatalogo = document.body.classList.contains('vista-catalogo');
  var hash = marca ? '#marca-'+marca : '#'+(g||'todos');
  // primero se crea la entrada del historial, y despues se cambia la vista
  if(push && !yaEnCatalogo){ history.pushState({vista:true}, '', hash); }
  document.body.classList.add('vista-catalogo');
  if(marca) setMarca(marca); else setGenero(g);
  window.scrollTo(0, 0);
  _refrescarHeader();
}
function mostrarInicio(irAGeneros){
  document.body.classList.remove('vista-catalogo');
  _refrescarHeader();
  var s = document.getElementById('generos');
  if(irAGeneros && s) s.scrollIntoView();
  else window.scrollTo(0, 0);
}
function irAGenero(g, e){
  if(e && e.preventDefault) e.preventDefault();
  mostrarCatalogo(g, true);
}
function irAMarca(m, e){
  if(e && e.preventDefault) e.preventDefault();
  if(_MARCAS[m]) mostrarCatalogo('', true, m);
}
// ir a una seccion del inicio (ej. "marcas") desde cualquier vista
function irASeccion(id, e){
  if(e && e.preventDefault) e.preventDefault();
  if(document.body.classList.contains('vista-catalogo')){
    history.replaceState(null, '', location.pathname + location.search);
    document.body.classList.remove('vista-catalogo');
    _refrescarHeader();
  }
  var s = document.getElementById(id);
  if(s) s.scrollIntoView({behavior:'smooth'});
}
// Logo: siempre a la pagina principal, cerrando lo que este abierto (reloj, buscador, paneles, menu)
function irAInicio(e){
  if(e && e.preventDefault) e.preventDefault();
  ['cerrarMenu','cerrarFavoritos','cerrarCuenta','cerrarFiltros','cerrarOrden'].forEach(function(f){ if(typeof window[f]==='function') window[f](); });
  if(document.getElementById('site-header').classList.contains('search-open') && typeof window.toggleBuscador==='function'){
    var bb = Array.prototype.find.call(document.querySelectorAll('.icon-btn[aria-label="Buscar"]'), function(x){ return x.offsetParent !== null; });
    if(bb) window.toggleBuscador(bb);
  }
  var m = document.getElementById('modal');
  if(m && m.classList.contains('open')){ m.classList.remove('open'); m.setAttribute('aria-hidden','true'); document.body.classList.remove('prod-abierto'); }
  document.body.style.overflow = '';
  history.replaceState(null, '', location.pathname);
  document.body.classList.remove('vista-catalogo');
  window.scrollTo(0, 0);
  _refrescarHeader();
}
function volverInicio(){
  if(history.state && history.state.vista){ history.back(); }
  else { history.replaceState(null, '', location.pathname + location.search); mostrarInicio(true); }
}
function aplicarVistaDesdeHash(){
  var h = location.hash;
  if(_esHashCatalogo(h)){
    var yaEn = document.body.classList.contains('vista-catalogo');
    document.body.classList.add('vista-catalogo');
    var m = _marcaDeHash(h);
    if(m) setMarca(m); else setGenero(_HASH_GEN[h]);
    if(!yaEn){ window.scrollTo(0,0); }
    _refrescarHeader();
  } else if(document.body.classList.contains('vista-catalogo')){
    mostrarInicio(true);
  }
}
window.addEventListener('popstate', aplicarVistaDesdeHash);
// los enlaces placeholder href="#" no deben cambiar la direccion (si no, sacan al usuario de la vista actual)
document.addEventListener('click', function(e){
  var a = e.target.closest ? e.target.closest('a') : null;
  if(a && a.getAttribute('href') === '#'){ e.preventDefault(); }
});
// aparicion suave de las tarjetas de genero y de marca
(function(){
  var els = document.querySelectorAll('.gen-reveal');
  if(!('IntersectionObserver' in window)){ els.forEach(function(e){ e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, {threshold:0.15});
  els.forEach(function(e){ io.observe(e); });
})();
// si abren la pagina directo en #hombre / #mujer / #todos / #marca-...
setTimeout(function(){ if(_esHashCatalogo(location.hash)){ aplicarVistaDesdeHash(); } }, 0);

export { _DESC_GEN, _filtroGenero, _filtroMarca, _genOk, _HASH_GEN, _MARCAS, _refrescarHeader, _TITULOS_GEN, aplicarVistaDesdeHash, irAGenero, irAInicio, irAMarca, irASeccion, mostrarCatalogo, mostrarInicio, setDescripcion, setGenero, setMarca, toggleDesc, volverInicio };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { irAGenero, irAInicio, irAMarca, irASeccion, toggleDesc, volverInicio });
