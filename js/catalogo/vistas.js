import { relojes } from './datos.js';
import { limpiarFiltros } from './filtros.js';
import { render } from './grid.js';

let _filtroGenero = '';

var _TITULOS_GEN = {'':'Todos los relojes', hombre:'Relojes para hombre', mujer:'Relojes para mujer'};
var _DESC_GEN = {
  '': 'Explora todos los relojes disponibles en Aphillips Store. Toca cualquiera para ver sus detalles y consulta la disponibilidad directamente por WhatsApp.',
  hombre: 'Los relojes para hombre de Aphillips Store combinan elegancia y carácter: diseños audaces, movimientos automáticos y acabados pensados para durar. Consulta la disponibilidad de cada pieza directamente por WhatsApp.',
  mujer: 'Los relojes para mujer de Aphillips Store reúnen estilo y precisión: diseños refinados, detalles cuidados y piezas seleccionadas para acompañarte todos los días. Consulta la disponibilidad de cada pieza directamente por WhatsApp.'
};
var _HASH_GEN = {'#hombre':'hombre', '#mujer':'mujer', '#todos':''};
// Solo hay dos generos. Los relojes registrados como "unisex" aparecen tanto en hombre como en mujer.
function _genOk(r){ return !_filtroGenero || r.genero===_filtroGenero || r.genero==='unisex'; }

function setGenero(g, btn){
  if(g !== _filtroGenero){ limpiarFiltros(); }
  _filtroGenero = g;
  var t = document.getElementById('cat-titulo'); if(t) t.textContent = _TITULOS_GEN[g] || _TITULOS_GEN[''];
  setDescripcion(g);
  if(document.body.classList.contains('vista-catalogo')){ history.replaceState(history.state, '', '#'+(g||'todos')); }
  render();
}
function setDescripcion(g){
  var box = document.getElementById('cat-desc'), p = document.getElementById('cat-desc-txt'), b = document.getElementById('cat-desc-btn');
  if(!p) return;
  p.textContent = _DESC_GEN[g] || _DESC_GEN[''];
  box.classList.remove('abierta'); b.textContent = '+'; b.setAttribute('aria-expanded','false');
  requestAnimationFrame(function(){ b.style.visibility = (p.scrollHeight > p.clientHeight + 1) ? 'visible' : 'hidden'; });
}
function toggleDesc(){
  var box = document.getElementById('cat-desc'), b = document.getElementById('cat-desc-btn');
  var ab = box.classList.toggle('abierta');
  b.textContent = ab ? '−' : '+'; b.setAttribute('aria-expanded', ab ? 'true' : 'false');
}
function _refrescarHeader(){ window.dispatchEvent(new Event('resize')); }
function mostrarCatalogo(g, push){
  var bus = document.getElementById('buscador'); if(bus) bus.value = '';
  var yaEnCatalogo = document.body.classList.contains('vista-catalogo');
  // primero se crea la entrada del historial, y despues se cambia la vista
  if(push && !yaEnCatalogo){ history.pushState({vista:true}, '', '#'+(g||'todos')); }
  document.body.classList.add('vista-catalogo');
  setGenero(g, null);
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
function volverInicio(){
  if(history.state && history.state.vista){ history.back(); }
  else { history.replaceState(null, '', location.pathname + location.search); mostrarInicio(true); }
}
function aplicarVistaDesdeHash(){
  var h = location.hash;
  if(Object.prototype.hasOwnProperty.call(_HASH_GEN, h)){
    var yaEn = document.body.classList.contains('vista-catalogo');
    document.body.classList.add('vista-catalogo');
    setGenero(_HASH_GEN[h], null);
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
// buscar desde el panel o escribiendo => mostrar el catalogo
function buscarEscribiendo(){
  var bus = document.getElementById('buscador');
  if(bus && bus.value.trim() && !document.body.classList.contains('vista-catalogo')){
    history.pushState({vista:true}, '', '#todos');
    document.body.classList.add('vista-catalogo');
    setGenero('', null);
    _refrescarHeader();
  }
  render();
}
// aparicion suave de las tarjetas de genero
(function(){
  var els = document.querySelectorAll('.gen-reveal');
  if(!('IntersectionObserver' in window)){ els.forEach(function(e){ e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
  }, {threshold:0.15});
  els.forEach(function(e){ io.observe(e); });
})();
// si abren la pagina directo en #hombre / #mujer / #todos
setTimeout(function(){ if(Object.prototype.hasOwnProperty.call(_HASH_GEN, location.hash)){ aplicarVistaDesdeHash(); } }, 0);

export { _DESC_GEN, _filtroGenero, _genOk, _HASH_GEN, _refrescarHeader, _TITULOS_GEN, aplicarVistaDesdeHash, buscarEscribiendo, irAGenero, mostrarCatalogo, mostrarInicio, setDescripcion, setGenero, toggleDesc, volverInicio };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { buscarEscribiendo, irAGenero, toggleDesc, volverInicio });
