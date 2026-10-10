// =================== PANEL DE CUENTA (solo diseno, login pendiente) ===================
import { buscadorAbierto, toggleBuscador } from './buscador.js';
import { cerrarFavoritos } from './favoritos.js';
import { cerrar } from './modal.js';
import { toast } from './ui.js';

function abrirCuenta(){
  cerrarFavoritos();
  if(typeof buscadorAbierto !== 'undefined' && buscadorAbierto){
    var bb = Array.prototype.find.call(document.querySelectorAll('.icon-btn[aria-label="Buscar"]'), function(x){ return x.offsetParent !== null; });
    if(bb) toggleBuscador(bb);
  }
  var hd = document.getElementById('site-header');
  document.documentElement.style.setProperty('--header-h', hd.offsetHeight + 'px');
  var m = document.getElementById('panel-cuenta');
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  hd.classList.add('panel-open');
  document.body.style.overflow = 'hidden';
  setTimeout(function(){ var c = document.getElementById('cuenta-cerrar'); if(c) c.focus({preventScroll:true}); }, 380);
}
function cerrarCuenta(){
  var m = document.getElementById('panel-cuenta');
  if(!m) return;
  var estabaAbierto = m.classList.contains('open');
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  if(estabaAbierto){
    var hd = document.getElementById('site-header');
    if(hd) hd.classList.remove('panel-open');
    document.body.style.overflow = '';
  }
}
function cuentaProximamente(e){
  if(e && e.preventDefault) e.preventDefault();
  toast('El inicio de sesión estará disponible próximamente');
  return false;
}
document.getElementById('panel-cuenta').addEventListener('click', function(e){ if(e.target===this) cerrarCuenta(); });
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') cerrarCuenta(); });

export { abrirCuenta, cerrarCuenta, cuentaProximamente };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirCuenta, cerrarCuenta, cuentaProximamente });
