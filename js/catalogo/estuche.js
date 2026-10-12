// =================== ESTUCHE (debajo del carrusel) ===================
// Un estuche cerrado que se abre con el scroll y muestra los mismos relojes del carrusel (DEST_LOCAL).
// Al pasar el cursor (o tocar) un reloj, este sale un poco del estuche y abajo se ve su nombre.
// El avance de la apertura va en la variable CSS --p de #estuche (0 cerrado, 1 abierto).
import { _destEsc } from './ui.js';
import { DEST_LOCAL } from './destacados.js';

var PISTA = '<span class="pista">Toca un reloj para verlo</span>';

function renderEstuche(){
  var sec = document.getElementById('estuche'), box = document.getElementById('est-interior'); if(!sec || !box) return;
  var relojes = DEST_LOCAL.filter(function(r){ return r.fotos && r.fotos[0]; }).slice(0, 3);
  if(!relojes.length){ sec.style.display = 'none'; return; }
  box.innerHTML = relojes.map(function(r, i){
    var nombre = r.nombre + (r.detalle ? ' ' + r.detalle : '');
    return '<div class="est-ranura"><button type="button" class="est-reloj" style="--i:' + i + '" data-i="' + i + '" aria-pressed="false" aria-label="' + _destEsc(nombre) + '">' +
      '<img src="' + _destEsc(r.fotos[0]) + '" alt="" loading="lazy" decoding="async" draggable="false"></button></div>';
  }).join('');
  document.getElementById('est-info').innerHTML = PISTA;

  function mostrar(i){
    var r = relojes[i], info = document.getElementById('est-info');
    info.innerHTML = r ? '<span class="n">' + _destEsc(r.nombre) + '</span>' + (r.detalle ? '<span class="d">' + _destEsc(r.detalle) + '</span>' : '') : PISTA;
  }
  function alzar(btn){
    box.querySelectorAll('.est-reloj').forEach(function(b){ var on = b === btn; b.classList.toggle('alzado', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    mostrar(btn ? +btn.dataset.i : -1);
  }
  // tocar: levanta ese reloj (tocar el mismo otra vez lo baja)
  box.addEventListener('click', function(e){
    var b = e.target.closest('.est-reloj'); if(!b) return;
    alzar(b.classList.contains('alzado') ? null : b);
  });
  // con mouse: el nombre sigue al cursor; al salir vuelve el que esta levantado (si hay)
  box.addEventListener('pointerover', function(e){
    var b = e.target.closest('.est-reloj'); if(b && e.pointerType === 'mouse') mostrar(+b.dataset.i);
  });
  box.addEventListener('pointerleave', function(e){
    if(e.pointerType !== 'mouse') return;
    var a = box.querySelector('.est-reloj.alzado'); mostrar(a ? +a.dataset.i : -1);
  });
}

// Apertura segun el scroll: empieza cuando el estuche entra por abajo y termina en medio viaje de pantalla
(function(){
  var sec = document.getElementById('estuche'), caja = document.getElementById('est-caja'); if(!sec || !caja) return;
  renderEstuche();
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches){ sec.style.setProperty('--p', 1); return; }
  var pendiente = false, ultimo = -1;
  function medir(){
    pendiente = false;
    var vh = window.innerHeight || 800, r = caja.getBoundingClientRect();
    var p = Math.min(1, Math.max(0, (vh * 0.95 - r.top) / (vh * 0.45)));
    p = 1 - Math.pow(1 - p, 3);   // frena al final, como una tapa que se asienta
    p = Math.round(p * 1000) / 1000;
    if(p !== ultimo){ ultimo = p; sec.style.setProperty('--p', p); }
  }
  function pedir(){ if(!pendiente){ pendiente = true; requestAnimationFrame(medir); } }
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);
  medir();
})();

export { renderEstuche };
