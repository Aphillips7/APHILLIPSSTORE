// =================== MENU DEL CELULAR (boton hamburguesa) ===================
// Panel a pantalla completa debajo del encabezado, estilo TAG Heuer.
let menuAbierto = false;

function abrirMenu(){
  // cierra lo que este abierto para que no se encimen
  ['cerrarFavoritos','cerrarCuenta'].forEach(function(f){ if(typeof window[f]==='function') window[f](); });
  var hd = document.getElementById('site-header');
  if(hd.classList.contains('search-open') && typeof window.toggleBuscador==='function'){
    var bb = Array.prototype.find.call(document.querySelectorAll('.icon-btn[aria-label="Buscar"]'), function(x){ return x.offsetParent !== null; });
    if(bb) window.toggleBuscador(bb);
  }
  document.documentElement.style.setProperty('--header-h', hd.offsetHeight + 'px');
  menuAbierto = true;
  var m = document.getElementById('menu-movil');
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  hd.classList.add('menu-open');
  document.getElementById('menu-btn').setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function cerrarMenu(){
  if(!menuAbierto) return;
  menuAbierto = false;
  var m = document.getElementById('menu-movil');
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  document.getElementById('site-header').classList.remove('menu-open');
  document.getElementById('menu-btn').setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  m.querySelectorAll('.mm-grupo.abierto').forEach(function(g){ g.classList.remove('abierto'); });
}
function toggleMenu(){ if(menuAbierto) cerrarMenu(); else abrirMenu(); }
// cierra el menu y luego hace la accion (ir a hombre, a una marca, abrir favoritos...)
function menuIr(accion){
  cerrarMenu();
  if(typeof accion === 'function') accion();
}
// "Marcas" despliega la lista de marcas
function menuGrupo(btn){
  var g = btn.closest('.mm-grupo');
  var ab = g.classList.toggle('abierto');
  btn.setAttribute('aria-expanded', ab ? 'true' : 'false');
}

// tocar otro icono del encabezado (lupa, corazon, cuenta) cierra el menu
document.getElementById('site-header').addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('.icon-btn');
  if(b && menuAbierto) cerrarMenu();
}, true);
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') cerrarMenu(); });
// si se agranda la ventana a tamano PC, el menu del celular se cierra
window.addEventListener('resize', function(){ if(menuAbierto && window.innerWidth > 820) cerrarMenu(); });

export { abrirMenu, cerrarMenu, menuGrupo, menuIr, toggleMenu };
// Usadas desde atributos onclick del HTML
Object.assign(window, { cerrarMenu, menuGrupo, menuIr, toggleMenu });
