// =================== FAVORITOS ===================
import { buscadorAbierto, toggleBuscador } from './buscador.js';
import { cerrarCuenta } from './cuenta.js';
import { relojes } from './datos.js';
import { abrir, cerrar } from './modal.js';
import { vibrar } from './ui.js';

let _favoritos = new Set();
try{ _favoritos = new Set(JSON.parse(localStorage.getItem('aphillips_favoritos')||'[]')); }catch(e){}
actualizarContadorFavoritos();
function guardarFavoritos(){ try{ localStorage.setItem('aphillips_favoritos', JSON.stringify(Array.from(_favoritos))); }catch(e){} }
function actualizarContadorFavoritos(){
  var n = _favoritos.size;
  var btn = document.getElementById('btn-fav-header');
  var count = document.getElementById('fav-header-count');
  if(count) count.textContent = n;
  if(btn) btn.classList.toggle('mostrar', n>0);
}
function toggleFavorito(e, id){
  e.stopPropagation();
  var esFav = _favoritos.has(id);
  if(esFav){ _favoritos.delete(id); } else { _favoritos.add(id); vibrar(10); }
  guardarFavoritos();
  document.querySelectorAll('.btn-favorito[data-fav-id="'+id+'"]').forEach(function(b){ b.classList.toggle('activo', !esFav); });
  actualizarContadorFavoritos();
}
function renderListaFavoritos(){
  var cont = document.getElementById('lista-favoritos');
  var items = relojes.filter(function(r){ return _favoritos.has(r.id); });
  var btnWa = document.getElementById('btn-wa-favoritos');
  var foot = document.getElementById('fav-foot');
  var cuenta = document.getElementById('fav-cuenta');
  if(cuenta) cuenta.textContent = items.length ? '('+items.length+' producto'+(items.length===1?'':'s')+')' : '';
  if(!items.length){
    cont.innerHTML = '<div class="fav-vacio">Aun no has guardado relojes. Toca el corazon en cualquier reloj para guardarlo aqui, y luego consulta por varios de una sola vez.</div>';
    if(btnWa) btnWa.style.display = 'none';
    if(foot) foot.style.display = 'none';
    return;
  }
  cont.innerHTML = items.map(function(r){
    var precio = r.estado==='bajopedido' ? 'Bajo pedido' : '$'+(r.precio||0).toLocaleString();
    var badge = r.estado==='transito' ? 'EN CAMINO' : (r.estado==='bajopedido' ? 'BAJO PEDIDO' : (r.estado==='vendido' ? 'VENDIDO' : 'NUEVO'));
    var sub = (r.coleccion||'') + (r.sku ? (r.coleccion?' · ':'')+'Ref. '+r.sku : '');
    var foto = r.foto ? '<img class="fav-fila-foto" src="'+r.foto+'" alt="" onclick="verDesdeFavoritos(\''+r.id+'\')" onerror="this.style.display=\'none\'" />' : '<div class="fav-fila-foto" onclick="verDesdeFavoritos(\''+r.id+'\')"></div>';
    return '<div class="fav-fila">'+foto+
      '<div class="fav-fila-info" onclick="verDesdeFavoritos(\''+r.id+'\')">'+
        '<span class="fav-badge">'+badge+'</span>'+
        '<div class="fav-fila-nombre">'+(r.nombre||'Reloj')+'</div>'+
        (sub?'<div class="fav-fila-sub">'+sub+'</div>':'')+
        '<div class="fav-fila-precio">'+precio+'</div>'+
      '</div>'+
      '<button class="fav-fila-quitar" onclick="quitarFavorito(\''+r.id+'\')" aria-label="Quitar" title="Quitar de favoritos"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="18" height="18"><path d="M6 6L18 18M18 6L6 18"/></svg></button>'+
    '</div>';
  }).join('');
  if(btnWa){
    btnWa.style.display = 'flex';
    document.getElementById('btn-wa-favoritos-texto').textContent = 'Consultar por WhatsApp ('+items.length+')';
  }
  if(foot) foot.style.display = '';
}
function abrirFavoritos(){
  cerrarCuenta();
  // si el buscador esta abierto, se cierra para que no se encimen
  if(typeof buscadorAbierto !== 'undefined' && buscadorAbierto){
    var bb = Array.prototype.find.call(document.querySelectorAll('.icon-btn[aria-label="Buscar"]'), function(x){ return x.offsetParent !== null; });
    if(bb) toggleBuscador(bb);
  }
  var hd = document.getElementById('site-header');
  document.documentElement.style.setProperty('--header-h', hd.offsetHeight + 'px');
  renderListaFavoritos();
  var m = document.getElementById('modal-favoritos');
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  hd.classList.add('panel-open');
  document.body.style.overflow = 'hidden';
  setTimeout(function(){ var c = document.getElementById('fav-cerrar'); if(c) c.focus({preventScroll:true}); }, 380);
}
function cerrarFavoritos(){
  var m = document.getElementById('modal-favoritos');
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  var hd = document.getElementById('site-header');
  if(hd) hd.classList.remove('panel-open');
  document.body.style.overflow = '';
}

function verDesdeFavoritos(id){
  cerrarFavoritos();
  abrir(id);
}
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && document.getElementById('modal-favoritos').classList.contains('open')) cerrarFavoritos();
});

function quitarFavorito(id){
  _favoritos.delete(id);
  guardarFavoritos();
  document.querySelectorAll('.btn-favorito[data-fav-id="'+id+'"]').forEach(function(b){ b.classList.remove('activo'); });
  actualizarContadorFavoritos();
  renderListaFavoritos();
}
document.getElementById('modal-favoritos').addEventListener('click', function(e){ if(e.target===this) cerrarFavoritos(); });

export { _favoritos, abrirFavoritos, actualizarContadorFavoritos, cerrarFavoritos, guardarFavoritos, quitarFavorito, renderListaFavoritos, toggleFavorito, verDesdeFavoritos };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirFavoritos, cerrarFavoritos, quitarFavorito, toggleFavorito, verDesdeFavoritos });
