// =================== CAJA DE RELOJES (debajo del carrusel) ===================
// Una caja de madera cerrada: al hacer scroll la seccion queda fija, la tapa gira en 3D sobre las bisagras
// y aparecen los mismos relojes del carrusel (DEST_LOCAL) acostados en sus cojines.
// Pasar el cursor (o tocar) un reloj lo levanta un poco y lo inclina hacia quien mira.
// El avance va en variables CSS de #estuche (ver css/catalogo/estuche.css): --i, --l, --w0..--w2.
import { _destEsc } from './ui.js';
import { DEST_LOCAL } from './destacados.js';

var sec = document.getElementById('estuche');
var caja = document.getElementById('cj-caja');
var box = document.getElementById('cj-relojes');
var etiqueta = document.getElementById('cj-etiqueta');
var relojes = DEST_LOCAL.filter(function(r){ return r.fotos && r.fotos[0]; }).slice(0, 3);

function lim(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }
function salida(t){ return 1 - Math.pow(1 - t, 3); }   // ease-out

// ---------- relojes ----------
function renderRelojes(){
  box.innerHTML = relojes.map(function(r, i){
    var nombre = r.nombre + (r.detalle ? ' ' + r.detalle : '');
    return '<button type="button" class="cj-reloj" data-i="' + i + '" aria-pressed="false" aria-label="' + _destEsc(nombre) + '">' +
      '<img src="' + _destEsc(r.fotos[0]) + '" alt="" loading="lazy" decoding="async" draggable="false"></button>';
  }).join('');
}
function mostrarEtiqueta(i){
  var r = relojes[i];
  if(!r){ etiqueta.classList.remove('on'); return; }
  etiqueta.innerHTML = '<span class="n">' + _destEsc(r.nombre) + '</span>' +
    (r.detalle ? '<span class="d">' + _destEsc(r.detalle) + (r.precio ? ' · ' + _destEsc(r.precio) : '') + '</span>' : '');
  etiqueta.style.setProperty('--ex', getComputedStyle(sec).getPropertyValue('--r' + i + '-x').trim() || '50%');
  etiqueta.classList.add('on');
}
function alzar(btn){
  box.querySelectorAll('.cj-reloj').forEach(function(b){
    var on = b === btn; b.classList.toggle('alzado', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  mostrarEtiqueta(btn ? +btn.dataset.i : -1);
}
function alzado(){ return box.querySelector('.cj-reloj.alzado'); }
function eventos(){
  // tocar / Enter / Espacio: levanta ese reloj; otra vez lo baja (solo uno a la vez)
  box.addEventListener('click', function(e){
    var b = e.target.closest('.cj-reloj'); if(!b) return;
    alzar(b.classList.contains('alzado') ? null : b);
  });
  // tocar fuera de los relojes los baja
  document.addEventListener('click', function(e){
    if(alzado() && !e.target.closest('.cj-reloj')) alzar(null);
  });
  // con mouse, la etiqueta sigue al reloj bajo el cursor
  box.addEventListener('pointerover', function(e){
    var b = e.target.closest('.cj-reloj'); if(b && e.pointerType === 'mouse') mostrarEtiqueta(+b.dataset.i);
  });
  box.addEventListener('pointerout', function(e){
    if(e.pointerType !== 'mouse' || (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.cj-reloj'))) return;
    var a = alzado(); mostrarEtiqueta(a ? +a.dataset.i : -1);
  });
  box.addEventListener('focusin', function(e){ var b = e.target.closest('.cj-reloj'); if(b) mostrarEtiqueta(+b.dataset.i); });
  box.addEventListener('focusout', function(){ var a = alzado(); mostrarEtiqueta(a ? +a.dataset.i : -1); });
}

// ---------- animacion segun el scroll ----------
// 0-.15 aparece la caja cerrada · .15-.60 se abre la tapa · .60-.85 salen los relojes · .85-1 quieta
function aplicar(p){
  var l = salida(lim((p - .15) / .45));
  sec.style.setProperty('--i', (.35 + .65 * lim(p / .15)).toFixed(3));
  sec.style.setProperty('--l', l.toFixed(4));
  for(var k = 0; k < 3; k++) sec.style.setProperty('--w' + k, salida(lim((p - .60 - k * .05) / .15)).toFixed(3));
  caja.classList.toggle('tapa-atras', l > .5);
  sec.classList.toggle('abierta', p >= .85);
  if(p < .6 && alzado()) alzar(null);
}
function estatica(sin3d){
  sec.classList.add('estatica');
  if(sin3d) sec.classList.add('sin3d');
  aplicar(1);
}
function scrollVivo(){
  var meta = 0, actual = 0, corriendo = false;
  function medir(){
    var r = sec.getBoundingClientRect(), recorrido = r.height - (window.innerHeight || 800);
    meta = recorrido > 0 ? lim(-r.top / recorrido) : (r.top < 0 ? 1 : 0);
  }
  function paso(){
    medir();
    actual += (meta - actual) * .16;          // suavizado (lerp)
    if(Math.abs(meta - actual) < .001) actual = meta;
    aplicar(actual);
    if(actual !== meta){ requestAnimationFrame(paso); }
    else { corriendo = false; sec.classList.remove('animando'); }
  }
  function despertar(){
    if(corriendo) return;
    corriendo = true; sec.classList.add('animando');
    requestAnimationFrame(paso);
  }
  window.addEventListener('scroll', despertar, { passive: true });
  window.addEventListener('resize', despertar);
  medir(); actual = meta; aplicar(actual);
}

(function(){
  if(!sec || !caja || !box) return;
  if(!relojes.length){ sec.style.display = 'none'; return; }
  renderRelojes(); eventos();
  var sin3d = !(window.CSS && CSS.supports && CSS.supports('transform-style', 'preserve-3d'));
  var reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // si no carga una pieza de la caja, se muestra abierta y quieta
  sec.querySelectorAll('.cj-cuerpo, .cj-frente, .cj-cara').forEach(function(img){
    img.addEventListener('error', function(){ estatica(true); });
  });
  if(sin3d || reducido) estatica(sin3d);
  else scrollVivo();
})();

export { alzar };
