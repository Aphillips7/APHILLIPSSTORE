// =================== CAJA DE RELOJES (debajo del carrusel) ===================
// Una caja de madera cerrada: al hacer scroll la seccion queda fija, la tapa gira en 3D sobre las bisagras
// y aparecen 3 relojes en reposo sobre sus cojines. Al pasar el cursor (o tocar) un reloj, su foto de frente
// sube y gira hacia quien mira; con el reloj levantado, un segundo toque abre su enlace (si tiene).
// El avance va en variables CSS de #estuche (ver css/catalogo/estuche.css): --l, --w1..--w3, --y.

// Relojes de la caja, de izquierda a derecha. Edita aqui nombre, precio y enlace.
// "enlace": direccion a la que lleva un segundo toque (vacio = solo se levanta/baja).
var RELOJES_CAJA = [
  { nombre: 'TechnoMarine', detalle: 'Cronógrafo bicolor, esfera azul', precio: '', enlace: '',
    reposo: 'assets/watchbox/reposo-izq.webp', frontal: 'assets/watchbox/frontal-izq.webp' },
  { nombre: 'Invicta', detalle: 'Cronógrafo dorado', precio: '', enlace: '',
    reposo: 'assets/watchbox/reposo-cen.webp', frontal: 'assets/watchbox/frontal-cen.webp' },
  { nombre: 'Invicta Speedway', detalle: 'Bicolor oro rosa, esfera negra', precio: '', enlace: '',
    reposo: 'assets/watchbox/reposo-der.webp', frontal: 'assets/watchbox/frontal-der.webp' }
];

var sec = document.getElementById('estuche');
var caja = document.getElementById('cj-caja');
var etiqueta = document.getElementById('cj-etiqueta');
var activo = 0;     // reloj levantado (1-3) o 0

function lim(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }
function salida(t){ return 1 - Math.pow(1 - t, 3); }   // ease-out
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }

// ---------- relojes ----------
function render(){
  var h = '';
  RELOJES_CAJA.forEach(function(r, k){
    var i = k + 1;
    h += '<img class="cj-reposo" data-i="' + i + '" src="' + esc(r.reposo) + '" alt="" loading="lazy" decoding="async" draggable="false">';
    h += '<img class="cj-alzado" data-i="' + i + '" src="' + esc(r.frontal) + '" alt="" loading="lazy" decoding="async" draggable="false">';
    h += '<button type="button" class="cj-zona" data-i="' + i + '" aria-pressed="false" aria-label="' + esc(r.nombre + ' ' + r.detalle) + '"></button>';
  });
  caja.insertAdjacentHTML('beforeend', h);
}
function levantar(i){
  activo = i || 0;
  caja.classList.toggle('activa', !!activo);
  caja.querySelectorAll('[data-i]').forEach(function(el){
    var on = +el.dataset.i === activo;
    if(el.classList.contains('cj-reposo')) el.classList.toggle('fuera', on);
    if(el.classList.contains('cj-alzado')) el.classList.toggle('on', on);
    if(el.classList.contains('cj-zona')) el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  var r = RELOJES_CAJA[activo - 1];
  if(!r){ etiqueta.classList.remove('on'); return; }
  etiqueta.innerHTML = '<span class="n">' + esc(r.nombre) + '</span><span class="d">' + esc(r.detalle) + (r.precio ? ' · ' + esc(r.precio) : '') + '</span>';
  etiqueta.style.setProperty('--ex', getComputedStyle(sec).getPropertyValue('--w' + activo + '-x').trim() || '50%');
  etiqueta.classList.add('on');
}
function abrirEnlace(r){
  if(!r || !r.enlace) return false;
  if(/^https?:\/\//.test(r.enlace) && r.enlace.indexOf(location.origin) !== 0) window.open(r.enlace, '_blank', 'noopener');
  else location.href = r.enlace;
  return true;
}
function eventos(){
  var conMouse = false;
  caja.addEventListener('pointerdown', function(e){ conMouse = e.pointerType === 'mouse'; });
  // tocar (o Enter/Espacio): levanta; tocar el levantado abre su enlace o lo baja
  caja.addEventListener('click', function(e){
    var z = e.target.closest('.cj-zona'); if(!z) return;
    var i = +z.dataset.i;
    if(activo === i){ if(!abrirEnlace(RELOJES_CAJA[i - 1]) && !conMouse) levantar(0); }
    else levantar(i);
  });
  // con mouse: levantar al pasar por encima y bajar al salir
  caja.addEventListener('pointerover', function(e){
    var z = e.target.closest('.cj-zona'); if(z && e.pointerType === 'mouse') levantar(+z.dataset.i);
  });
  caja.addEventListener('pointerout', function(e){
    if(e.pointerType !== 'mouse') return;
    var a = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.cj-zona') : null;
    if(!a) levantar(0);
  });
  caja.addEventListener('focusin', function(e){ var z = e.target.closest('.cj-zona'); if(z && z.matches(':focus-visible')) levantar(+z.dataset.i); });
  caja.addEventListener('focusout', function(){ if(!caja.contains(document.activeElement)) levantar(0); });
  // tocar fuera de los relojes los baja
  document.addEventListener('click', function(e){ if(activo && !e.target.closest('.cj-zona')) levantar(0); });
}

// ---------- animacion segun el scroll ----------
// 0-.15 entra la caja cerrada · .15-.60 se abre la tapa · .60-.85 aparecen los relojes · .85-1 quieta
function aplicar(p){
  sec.style.setProperty('--y', ((1 - salida(lim(p / .15))) * 28).toFixed(1) + 'px');
  sec.style.setProperty('--l', salida(lim((p - .15) / .45)).toFixed(4));
  for(var k = 0; k < 3; k++) sec.style.setProperty('--w' + (k + 1), salida(lim((p - .60 - k * .06) / .13)).toFixed(3));
  sec.classList.toggle('abierta', p >= .85);
  if(p < .85 && activo) levantar(0);
}
function estatica(sin3d){
  sec.classList.add('estatica');
  if(sin3d) sec.classList.add('sin3d');
  aplicar(1);
}
function scrollVivo(){
  var meta = 0, actual = 0, corriendo = false;
  function medir(){
    var vh = window.innerHeight || 800, r = sec.getBoundingClientRect();
    var recorrido = r.height - vh - vh * .30;          // los ultimos 30vh la caja queda abierta y quieta
    meta = recorrido > 0 ? lim(-r.top / recorrido) : (r.top < 0 ? 1 : 0);
  }
  function paso(){
    if(sec.classList.contains('estatica')){ corriendo = false; sec.classList.remove('animando'); return; }
    medir();
    actual += (meta - actual) * .14;                   // suavizado (lerp)
    if(Math.abs(meta - actual) < .0008) actual = meta;
    aplicar(actual);
    if(actual !== meta) requestAnimationFrame(paso);
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
  if(!sec || !caja) return;
  render(); eventos();
  var sin3d = !(window.CSS && CSS.supports && CSS.supports('transform-style', 'preserve-3d'));
  var reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // si una pieza no carga, la caja se muestra abierta y quieta
  sec.querySelectorAll('img').forEach(function(img){ img.addEventListener('error', function(){ estatica(true); }); });
  if(sin3d || reducido) estatica(sin3d);
  else scrollVivo();
})();

export { RELOJES_CAJA };
