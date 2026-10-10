import { cerrarCuenta } from './cuenta.js';
import { relojes } from './datos.js';
import { cerrarFavoritos } from './favoritos.js';
import { _nItems, render } from './grid.js';
import { _destEsc } from './ui.js';
import { _genOk } from './vistas.js';

let _orden = 'recientes';

function _busOk(r){
  var bus = document.getElementById('buscador'), q = (bus ? bus.value : '').toLowerCase();
  return !q || (r.nombre||'').toLowerCase().includes(q) || (r.coleccion||'').toLowerCase().includes(q) || (r.sku||'').toLowerCase().includes(q);
}
// filtros del panel (colección, movimiento, tamaño, esfera, correa, caja)
var _FACETAS = [
  {k:'coleccion', t:'Colección'}, {k:'movimiento', t:'Movimiento'}, {k:'mm', t:'Tamaño de caja'},
  {k:'colorEsfera', t:'Color de esfera'}, {k:'materialCorrea', t:'Material de correa'}, {k:'materialCaja', t:'Material de caja'}
];
var _filtros = {}, _fltAbiertas = {};
function limpiarFiltros(){ _filtros = {}; }
function _fval(r,k){ var v = (k==='mm') ? (r.mm ? r.mm+' mm' : '') : r[k]; return v==null ? '' : String(v).trim(); }
function _facOk(r, omit){
  for(var i=0;i<_FACETAS.length;i++){
    var k = _FACETAS[i].k; if(k===omit) continue;
    var sel = _filtros[k]; if(!sel || !Object.keys(sel).length) continue;
    if(!sel[_fval(r,k).toLowerCase()]) return false;
  }
  return true;
}
function _nFiltros(){ var n=0; Object.keys(_filtros).forEach(function(k){ n += Object.keys(_filtros[k]).length; }); return n; }

function setOrden(v){ _orden = v; render(); }

// ---- panel de filtros ----
function abrirFiltros(){
  cerrarFavoritos(); cerrarCuenta();
  renderFiltros();
  var m = document.getElementById('modal-filtros');
  m.classList.add('open'); m.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}
function cerrarFiltros(){
  var m = document.getElementById('modal-filtros'); if(!m || !m.classList.contains('open')) return;
  m.classList.remove('open'); m.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}
function renderFiltros(){
  var body = document.getElementById('flt-body'); if(!body) return;
  var base = relojes.filter(function(r){ return _genOk(r) && _busOk(r); });
  var top = body.scrollTop, html = '';
  _FACETAS.forEach(function(f){
    var mapa = {};
    base.forEach(function(r){
      var v = _fval(r,f.k); if(!v) return;
      var key = v.toLowerCase();
      if(!mapa[key]) mapa[key] = {label:v, n:0};
      if(_facOk(r, f.k)) mapa[key].n++;
    });
    var keys = Object.keys(mapa); if(!keys.length) return;
    keys.sort(function(a,b){ return a.localeCompare(b, 'es', {numeric:true}); });
    var sel = _filtros[f.k] || {};
    html += '<div class="flt-sec'+(_fltAbiertas[f.k]?' abierta':'')+'" data-k="'+f.k+'">'+
      '<button type="button" onclick="fltSec(\''+f.k+'\')"><span>'+f.t+'</span><span class="mas">'+(_fltAbiertas[f.k]?'−':'+')+'</span></button>'+
      '<div class="flt-opts">'+keys.map(function(key){
        return '<label class="flt-opt"><input type="checkbox" data-k="'+f.k+'" data-v="'+_destEsc(key)+'"'+(sel[key]?' checked':'')+' onchange="fltToggle(this)"><span>'+_destEsc(mapa[key].label)+'</span><small>'+mapa[key].n+'</small></label>';
      }).join('')+'</div></div>';
  });
  body.innerHTML = html || '<div class="fav-vacio" style="padding:24px 32px;">No hay filtros disponibles todavia.</div>';
  body.scrollTop = top;
  actualizarFltUI(true);
}
function fltSec(k){
  _fltAbiertas[k] = !_fltAbiertas[k];
  var sec = document.querySelector('#flt-body .flt-sec[data-k="'+k+'"]');
  if(sec){ sec.classList.toggle('abierta', !!_fltAbiertas[k]); sec.querySelector('.mas').textContent = _fltAbiertas[k] ? '−' : '+'; }
}
function fltToggle(el){
  var k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
  var sel = _filtros[k] = _filtros[k] || {};
  if(el.checked) sel[v] = true; else delete sel[v];
  render();
}
function fltReset(){ _filtros = {}; render(); }
function actualizarFltUI(desdePanel){
  var n = _nFiltros(), b = document.getElementById('flt-badge');
  if(b) b.textContent = n ? '('+n+')' : '';
  var ver = document.getElementById('flt-ver');
  if(ver) ver.textContent = _nItems===0 ? 'Sin resultados' : 'Ver '+_nItems+' producto'+(_nItems===1?'':'s');
  var m = document.getElementById('modal-filtros');
  if(!desdePanel && m && m.classList.contains('open')) renderFiltros();
}
// ---- hoja "Ordenar por" ----
function abrirOrden(){
  document.querySelectorAll('#modal-orden .ord-opt').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-o')===_orden); });
  var m = document.getElementById('modal-orden'); m.classList.add('open'); m.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}
function cerrarOrden(){
  var m = document.getElementById('modal-orden'); if(!m || !m.classList.contains('open')) return;
  m.classList.remove('open'); m.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}
function ordSel(v){ setOrden(_orden===v ? 'recientes' : v); cerrarOrden(); }
document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ cerrarFiltros(); cerrarOrden(); } });
window.addEventListener('resize', function(){
  var p = document.getElementById('cat-desc-txt'), b = document.getElementById('cat-desc-btn'), box = document.getElementById('cat-desc');
  if(p && b && box && !box.classList.contains('abierta') && p.clientHeight) b.style.visibility = (p.scrollHeight > p.clientHeight + 1) ? 'visible' : 'hidden';
});

export { _busOk, _FACETAS, _facOk, _filtros, _fltAbiertas, _fval, _nFiltros, _orden, abrirFiltros, abrirOrden, actualizarFltUI, cerrarFiltros, cerrarOrden, fltReset, fltSec, fltToggle, limpiarFiltros, ordSel, renderFiltros, setOrden };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirFiltros, abrirOrden, cerrarFiltros, cerrarOrden, fltReset, fltSec, fltToggle, ordSel });
