// =================== NAVEGACION (rediseno, fase 2) ===================
// 6 secciones: Dashboard, Ventas, Inventario, Clientes, Finanzas, Ajustes. Cada una tiene sub-vistas
// que muestran una de las paginas de siempre (page-*) y, en Finanzas, una de sus pestanas internas.
// PC: barra lateral (se contrae a iconos). Celular: barra inferior + boton "+" central y hoja "Mas".
// showPage/showInner/irARegistrar siguen funcionando (alias) para todo el codigo y HTML viejo.
import { showAuth } from './auth/auth-overlay.js';
import { renderCatalogoAdmin } from './catalogo-admin.js';
import { renderClientes } from './clientes/clientes.js';
import { renderContenido } from './contenido.js';
import { renderAnalisis } from './finanzas/analisis.js';
import { renderCierres } from './finanzas/cierre.js';
import { renderCobrar } from './finanzas/cobrar.js';
import { renderFinanzas } from './finanzas/finanzas.js';
import { renderHistorial } from './finanzas/historial.js';
import { selTipo } from './finanzas/registrar-venta.js';
import { renderResumen } from './finanzas/resumen.js';
import { renderInicio } from './inicio.js';
import { renderInventario } from './inventario/lista.js';
import { mostrarVistaVentas } from './ventas/ventas.js';
import { renderTienda } from './tienda/editor.js';
import { state } from './state.js';

const ICONOS = {
  dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  ventas: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  inventario: '<circle cx="12" cy="12" r="6"/><path d="M12 9v3l2 1M9 2h6l1 4M9 22h6l1-4M8 6l1-4M8 18l1 4"/>',
  clientes: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  finanzas: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
  tienda: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8M10 21v-5h4v5"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  mas_nuevo: '<path d="M12 5v14M5 12h14"/>',
  contraer: '<path d="M15 18l-6-6 6-6"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'
};
function svg(nombre){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONOS[nombre] + '</svg>'; }

// contador: id del badge que ya mantiene cada modulo (se lee su numero)
const SECCIONES = [
  { id: 'dashboard', t: 'Dashboard', subs: [{ id: 'resumen', t: 'Resumen', page: 'inicio' }] },
  { id: 'ventas', t: 'Ventas', subs: [
    { id: 'resumen', t: 'Resumen', page: 'ventas', vista: 'resumen' },
    { id: 'pedidos', t: 'Pedidos web', page: 'ventas', vista: 'pedidos', contador: 'pedidos-web-badge' },
    { id: 'apartados', t: 'Apartados', page: 'ventas', vista: 'apartados' },
    { id: 'historial', t: 'Historial', page: 'ventas', vista: 'historial' },
    { id: 'registrar', t: 'Registrar venta', page: 'finanzas', inner: 'registrar', tipo: 'venta' }] },
  { id: 'inventario', t: 'Inventario', subs: [
    { id: 'relojes', t: 'Relojes', page: 'inventario' },
    { id: 'catalogo', t: 'Catalogo', page: 'catalogo' }] },
  { id: 'clientes', t: 'Clientes', subs: [
    { id: 'clientes', t: 'Clientes', page: 'clientes', vista: 'clientes' },
    { id: 'cuentas', t: 'Cuentas de la tienda', page: 'clientes', vista: 'cuentas', contador: 'cuentas-web-badge' },
    { id: 'boletin', t: 'Boletin', page: 'clientes', vista: 'boletin' }] },
  { id: 'finanzas', t: 'Finanzas', subs: [
    { id: 'resumen', t: 'Resumen', page: 'finanzas', inner: 'resumen' },
    { id: 'analisis', t: 'Rentabilidad', page: 'finanzas', inner: 'analisis' },
    { id: 'cobrar', t: 'Por cobrar', page: 'finanzas', inner: 'cobrar' },
    { id: 'movimientos', t: 'Movimientos', page: 'finanzas', inner: 'historial' },
    { id: 'registrar', t: 'Registrar', page: 'finanzas', inner: 'registrar' },
    { id: 'cierres', t: 'Cierres', page: 'finanzas', inner: 'cierres' }] },
  { id: 'tienda', t: 'Tienda', subs: [
    { id: 'diseno', t: 'Diseño', page: 'tienda' },
    { id: 'portada', t: 'Portada', page: 'tienda' },
    { id: 'promos', t: 'Promociones', page: 'tienda' },
    { id: 'fotos', t: 'Fotos y textos', page: 'tienda' },
    { id: 'control', t: 'Control', page: 'tienda' }] },
  { id: 'ajustes', t: 'Ajustes', subs: [
    { id: 'general', t: 'General', page: 'ajustes', contador: 'salud-badge' },
    { id: 'contenido', t: 'Contenido', page: 'contenido' },
    { id: 'sync', t: 'Sync y respaldo', page: 'config', auth: true }] }
];
// pestanas viejas -> seccion/sub-vista nueva
const ALIAS = { inicio: ['dashboard'], finanzas: ['finanzas'], inventario: ['inventario', 'relojes'], catalogo: ['inventario', 'catalogo'],
  contenido: ['ajustes', 'contenido'], clientes: ['clientes'], config: ['ajustes', 'sync'], ventas: ['ventas'], ajustes: ['ajustes', 'general'] };
const EN_BARRA_INFERIOR = ['dashboard', 'ventas', 'inventario', 'clientes'];
const CLAVE_VISTA = 'aphillips_vista', CLAVE_MINI = 'aphillips_barra_mini';

var _actual = { sec: 'dashboard', sub: 'resumen' };
var _ultimaSub = {};   // ultima sub-vista abierta de cada seccion

function seccion(id){ return SECCIONES.find(function(s){ return s.id === id; }) || SECCIONES[0]; }
function sub(sec, id){ return sec.subs.find(function(x){ return x.id === id; }) || sec.subs[0]; }
function leer(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function guardar(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }

// ---------- dibujar barras ----------
function htmlItem(s, clase){
  return '<button type="button" class="' + clase + '" data-sec="' + s.id + '" onclick="irSeccion(\'' + s.id + '\')" title="' + s.t + '">' +
    svg(s.id) + '<span class="nav-txt">' + s.t + '</span><span class="nav-cont" hidden></span><span class="nav-borrador" hidden title="Formulario a medias"></span></button>';
}
function dibujarBarras(){
  var lat = document.getElementById('nav-secciones');
  if(lat) lat.innerHTML = SECCIONES.map(function(s){ return htmlItem(s, 'bl-item'); }).join('');
  var inf = document.getElementById('barra-inferior');
  if(inf){
    var items = EN_BARRA_INFERIOR.map(function(id){ return htmlItem(seccion(id), 'bi-item'); });
    items.splice(2, 0, '<button type="button" class="bi-nuevo" onclick="abrirHoja(\'hoja-nuevo\')" aria-label="Registrar algo nuevo">' + svg('mas_nuevo') + '</button>');
    inf.innerHTML = items.join('');
  }
  var mas = document.getElementById('hoja-mas-secciones');
  if(mas) mas.innerHTML = SECCIONES.filter(function(s){ return EN_BARRA_INFERIOR.indexOf(s.id) < 0; }).map(function(s){
    return '<button type="button" class="hoja-item" data-sec="' + s.id + '" onclick="cerrarHojas();irSeccion(\'' + s.id + '\')">' + svg(s.id) + '<span>' + s.t + '</span><span class="nav-cont" hidden></span></button>';
  }).join('');
  var bc = document.getElementById('bl-contraer'); if(bc) bc.innerHTML = svg('contraer');
  var bm = document.getElementById('bs-mas'); if(bm) bm.innerHTML = svg('mas');
  var bb = document.getElementById('bs-lupa'); if(bb) bb.innerHTML = svg('buscar');
  if(leer(CLAVE_MINI) === '1') document.body.classList.add('barra-mini');
}
function dibujarSubnav(){
  var sec = seccion(_actual.sec), cont = document.getElementById('subnav');
  var t = document.getElementById('bs-titulo'); if(t) t.textContent = sec.t;
  document.title = sec.t + ' · Aphillips';
  if(!cont) return;
  if(sec.subs.length < 2){ cont.innerHTML = ''; cont.hidden = true; return; }
  cont.hidden = false;
  cont.innerHTML = sec.subs.map(function(x){
    return '<button type="button" class="subnav-tab' + (x.id === _actual.sub ? ' active' : '') + '" data-sub="' + x.id + '" onclick="irSeccion(\'' + sec.id + '\',\'' + x.id + '\')">' +
      x.t + (x.contador ? '<span class="nav-cont" data-de="' + x.contador + '" hidden></span>' : '') + '</button>';
  }).join('');
  actualizarContadores();
  // la pestana activa siempre queda a la vista (en celular las ultimas quedaban fuera de la pantalla)
  var act = cont.querySelector('.subnav-tab.active');
  if(act){ var izq = act.offsetLeft - 16, der = act.offsetLeft + act.offsetWidth - cont.clientWidth + 16;
    if(cont.scrollLeft > izq) cont.scrollLeft = Math.max(0, izq); else if(cont.scrollLeft < der) cont.scrollLeft = der; }
}
function marcarActivos(){
  document.querySelectorAll('[data-sec]').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-sec') === _actual.sec); });
  dibujarSubnav();
}

// ---------- mostrar una vista ----------
function mostrarInner(prefix, name){
  document.querySelectorAll('#page-finanzas .inner-page').forEach(function(el){ el.classList.toggle('active', el.id === prefix + '-' + name); });
  document.querySelectorAll('#page-finanzas .inner-tab').forEach(function(t){ t.classList.toggle('active', (t.getAttribute('onclick') || '').indexOf("'" + name + "'") !== -1); });
  if(name === 'resumen') renderResumen();
  if(name === 'historial') renderHistorial();
  if(name === 'analisis') renderAnalisis();
  if(name === 'cobrar') renderCobrar();
  if(name === 'cierres') renderCierres();
}
function renderPagina(page, x){
  if(page === 'inicio') renderInicio();
  if(page === 'finanzas') renderFinanzas();
  if(page === 'inventario') renderInventario();
  if(page === 'catalogo') renderCatalogoAdmin();
  if(page === 'contenido') renderContenido();
  if(page === 'clientes') renderClientes();
  if(page === 'tienda') renderTienda(x && x.id);
}
// Cambia la pantalla sin pedir el codigo (lo usa tambien auth-overlay al validar el TOTP)
function mostrarVista(secId, subId){
  var sec = seccion(secId), x = sub(sec, subId || _ultimaSub[sec.id]);
  _actual = { sec: sec.id, sub: x.id };
  _ultimaSub[sec.id] = x.id;
  document.querySelectorAll('.page').forEach(function(p){ p.classList.toggle('active', p.id === 'page-' + x.page); });
  try{ renderPagina(x.page, x); }catch(e){ console.error(e); }
  if(x.inner){ try{ mostrarInner('fin', x.inner); }catch(e){ console.error(e); } }
  // sub-vistas dentro de una misma pagina (secciones con data-vista)
  if(x.vista){
    document.querySelectorAll('#page-' + x.page + ' [data-vista]').forEach(function(el){ el.hidden = el.getAttribute('data-vista') !== x.vista; });
    if(x.page === 'ventas'){ try{ mostrarVistaVentas(x.vista); }catch(e){ console.error(e); } }
  }
  if(x.tipo){ try{ elegirTipo(x.tipo); }catch(e){ console.error(e); } }
  marcarActivos();
  if(!x.auth) guardar(CLAVE_VISTA, sec.id + '/' + x.id);
  revisarBorradores();
}
function irSeccion(secId, subId){
  var sec = seccion(secId), x = sub(sec, subId || _ultimaSub[sec.id]);
  if(x.auth){ showAuth(); return; }   // Sync y respaldo: el codigo de 6 digitos decide (auth-overlay llama a mostrarVista)
  mostrarVista(sec.id, x.id);
  window.scrollTo({ top: 0 });
}
function elegirTipo(tipo){
  var chip = null;
  document.querySelectorAll('.fin-tipo-chip').forEach(function(b){ if((b.getAttribute('onclick') || '').indexOf("selTipo('" + tipo + "'") !== -1) chip = b; });
  selTipo(tipo, chip);
}

// ---------- alias de lo viejo ----------
function showPage(ev, name){
  var a = ALIAS[name] || ['dashboard'];
  irSeccion(a[0], a[1]);
}
function showInner(prefix, name){
  if(prefix === 'fin'){
    var mapa = { resumen: 'resumen', analisis: 'analisis', historial: 'movimientos', registrar: 'registrar', cobrar: 'cobrar', cierres: 'cierres' };
    irSeccion(_actual.sec === 'ventas' && name === 'registrar' ? 'ventas' : 'finanzas', mapa[name]);
    return;
  }
  mostrarInner(prefix, name);
}
function irARegistrar(tipo){
  if(tipo === 'venta') mostrarVista('ventas', 'registrar');
  else { mostrarVista('finanzas', 'registrar'); elegirTipo(tipo); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- contadores (leen los badges que ya existen) ----------
function numeroDe(id){
  var b = document.getElementById(id);
  if(!b || b.style.display === 'none') return 0;
  return parseInt(b.textContent, 10) || 0;
}
function pintarCont(el, n){ if(!el) return; el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n); }
function actualizarContadores(){
  SECCIONES.forEach(function(s){
    var total = s.subs.reduce(function(a, x){ return a + (x.contador ? numeroDe(x.contador) : 0); }, 0);
    document.querySelectorAll('[data-sec="' + s.id + '"] .nav-cont').forEach(function(el){ pintarCont(el, total); });
  });
  document.querySelectorAll('#subnav .nav-cont[data-de]').forEach(function(el){ pintarCont(el, numeroDe(el.getAttribute('data-de'))); });
  // "Mas" en celular: suma lo de las secciones que viven ahi
  var enMas = SECCIONES.filter(function(s){ return EN_BARRA_INFERIOR.indexOf(s.id) < 0; })
    .reduce(function(a, s){ return a + s.subs.reduce(function(b, x){ return b + (x.contador ? numeroDe(x.contador) : 0); }, 0); }, 0);
  pintarCont(document.getElementById('bs-mas-cont'), enMas);
}
function vigilarContadores(){
  var obs = new MutationObserver(actualizarContadores);
  SECCIONES.forEach(function(s){ s.subs.forEach(function(x){
    var b = x.contador && document.getElementById(x.contador);
    if(b) obs.observe(b, { attributes: true, childList: true, characterData: true, subtree: true });
  }); });
  actualizarContadores();
}

// ---------- formularios a medias (poka-yoke: un punto en la seccion y aviso al cerrar la pagina) ----------
const NO_CUENTA = /buscar|busca|filtro|search|meta-input|login|auth/i;
function paginaConBorrador(page){
  var p = document.getElementById('page-' + page);
  if(!p) return false;
  return Array.prototype.some.call(p.querySelectorAll('input,textarea'), function(el){
    if(/^(hidden|checkbox|radio|search|file|button|submit)$/.test(el.type)) return false;
    if(NO_CUENTA.test(el.id || '') || NO_CUENTA.test(el.placeholder || '')) return false;
    // solo campos que la persona escribio; lo que el codigo llena solo (fecha de hoy...) no cuenta
    return el.dataset.tocado === '1' && el.value !== (el.dataset.base || '') && String(el.value).trim() !== '';
  });
}
document.addEventListener('focusin', function(e){ var el = e.target; if(el && /INPUT|TEXTAREA/.test(el.tagName) && el.dataset.tocado !== '1') el.dataset.base = el.value; });
document.addEventListener('input', function(e){ var el = e.target; if(e.isTrusted && el && /INPUT|TEXTAREA/.test(el.tagName)) el.dataset.tocado = '1'; }, true);
var _hayBorrador = false;
function revisarBorradores(){
  _hayBorrador = false;
  SECCIONES.forEach(function(s){
    var pages = s.subs.map(function(x){ return x.page; }).filter(function(v, i, a){ return a.indexOf(v) === i; });
    var hay = pages.some(paginaConBorrador);
    if(hay) _hayBorrador = true;
    document.querySelectorAll('[data-sec="' + s.id + '"] .nav-borrador').forEach(function(el){ el.hidden = !hay || s.id === _actual.sec; });
  });
}
var _tBorr = null;
document.addEventListener('input', function(){ clearTimeout(_tBorr); _tBorr = setTimeout(revisarBorradores, 400); });
window.addEventListener('beforeunload', function(e){ revisarBorradores(); if(_hayBorrador){ e.preventDefault(); e.returnValue = ''; } });

// ---------- barra lateral contraible y hojas del celular ----------
function contraerBarra(){
  var mini = document.body.classList.toggle('barra-mini');
  guardar(CLAVE_MINI, mini ? '1' : '0');
}
function abrirHoja(id){
  cerrarHojas();
  var h = document.getElementById(id); if(!h) return;
  h.hidden = false; document.body.classList.add('hoja-abierta');
  var f = h.querySelector('button,input'); if(f) setTimeout(function(){ f.focus(); }, 50);
}
function cerrarHojas(){
  document.querySelectorAll('.hoja').forEach(function(h){ h.hidden = true; });
  document.body.classList.remove('hoja-abierta');
}
// "+" : venta, compra, gasto o reloj nuevo
function nuevo(que){
  cerrarHojas();
  if(que === 'reloj'){
    mostrarVista('inventario', 'relojes');
    var w = document.getElementById('inv-form-wrapper');
    if(!(w && w.style.display === 'block') && window.abrirFormularioNuevo) window.abrirFormularioNuevo();
    setTimeout(function(){ var f = document.getElementById('inv-form-wrapper'); if(f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    return;
  }
  irARegistrar(que);
}

// ---------- buscador global: relojes, clientes y pedidos web ----------
function sinAcentos(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
function coincide(campos, palabras){ var txt = sinAcentos(campos.join(' ')); return palabras.every(function(p){ return txt.indexOf(p) !== -1; }); }
function buscarGlobal(v){
  var res = document.getElementById('buscador-res'); if(!res) return;
  var palabras = sinAcentos(v).trim().split(/\s+/).filter(Boolean);
  if(!palabras.length){ res.hidden = true; res.innerHTML = ''; return; }
  var relojes = (state.inventario || []).filter(function(p){ return coincide([p.nombre, p.sku, p.coleccion, p.serie, p.estado, p.colorEsfera], palabras); }).slice(0, 6);
  var clientes = (state.clientes || []).filter(function(c){ return coincide([c.nombre, c.tel, c.telefono, c.producto, c.notas], palabras); }).slice(0, 5);
  var pedidos = (window.__pedidosWeb || []).filter(function(p){ var c = p.cuenta || {}; return coincide([p.numero, p.reloj, p.sku, c.codigo, c.nombre, c.apellido, c.telefono], palabras); }).slice(0, 5);
  var grupo = function(t, items){ return items.length ? '<div class="br-grupo">' + t + '</div>' + items.join('') : ''; };
  var h = grupo('Relojes', relojes.map(function(p){ return '<button type="button" class="br-item" onclick="abrirResultado(\'reloj\',\'' + esc(p.id) + '\')"><b>' + esc(p.nombre || 'Sin nombre') + '</b><span>' + esc([p.sku, p.estado].filter(Boolean).join(' · ')) + '</span></button>'; })) +
    grupo('Clientes', clientes.map(function(c){ return '<button type="button" class="br-item" onclick="abrirResultado(\'cliente\',\'' + esc(c.id) + '\')"><b>' + esc(c.nombre || 'Sin nombre') + '</b><span>' + esc(c.tel || c.telefono || '') + '</span></button>'; })) +
    grupo('Pedidos web', pedidos.map(function(p){ return '<button type="button" class="br-item" onclick="abrirResultado(\'pedido\',\'' + esc(p.numero) + '\')"><b>' + esc(p.numero) + ' · ' + esc(p.reloj) + '</b><span>' + esc(p.estado) + '</span></button>'; }));
  res.innerHTML = h || '<div class="br-vacio">Nada coincide con "' + esc(v) + '"</div>';
  res.hidden = false;
}
function abrirResultado(tipo, id){
  var inp = document.getElementById('buscador-global'); if(inp){ inp.value = ''; inp.blur(); }
  buscarGlobal(''); document.body.classList.remove('buscando');
  if(tipo === 'reloj'){ mostrarVista('inventario', 'relojes'); if(window.verDetalle) window.verDetalle(id); }
  if(tipo === 'cliente'){ mostrarVista('clientes'); if(window.verDetalleCliente) window.verDetalleCliente(id); }
  if(tipo === 'pedido'){ mostrarVista('ventas', 'pedidos'); if(window.filtrarPedidosWeb) window.filtrarPedidosWeb(id); }
}
function teclaBuscador(ev){
  if(ev.key === 'Escape'){ ev.target.value = ''; buscarGlobal(''); ev.target.blur(); document.body.classList.remove('buscando'); }
  if(ev.key === 'Enter'){ var b = document.querySelector('#buscador-res .br-item'); if(b) b.click(); }
}
function abrirBuscador(){ document.body.classList.add('buscando'); var i = document.getElementById('buscador-global'); if(i) i.focus(); }
document.addEventListener('click', function(e){
  if(!e.target.closest || e.target.closest('.bs-buscar') || e.target.closest('#bs-lupa')) return;
  var res = document.getElementById('buscador-res'); if(res) res.hidden = true;
  document.body.classList.remove('buscando');
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') cerrarHojas();
  // "/" abre el buscador (como en las apps de escritorio), salvo escribiendo en un campo
  if(e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')){ e.preventDefault(); abrirBuscador(); }
});

// ---------- arranque ----------
dibujarBarras();
vigilarContadores();
// se espera a que terminen de cargar todos los modulos del panel antes de dibujar la ultima seccion
setTimeout(function(){
  var g = (leer(CLAVE_VISTA) || '').split('/');
  var sec = SECCIONES.find(function(s){ return s.id === g[0]; });
  var x = sec && sec.subs.find(function(s){ return s.id === g[1]; });
  if(sec && x && !x.auth && !(sec.id === 'dashboard')) mostrarVista(sec.id, x.id);
  else marcarActivos();
}, 0);

export { irARegistrar, irSeccion, mostrarVista, showInner, showPage };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirBuscador, abrirHoja, abrirResultado, buscarGlobal, cerrarHojas, contraerBarra, irARegistrar, irSeccion, nuevo, showInner, showPage, teclaBuscador });
