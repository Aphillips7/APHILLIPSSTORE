// Graficas del panel en SVG propio (sin librerias, funcionan sin internet). Se dibujan al ancho real
// del contenedor para que los textos midan siempre 11 px, y se redibujan solas al cambiar el tamano.
// Colores: --g-actual (glaciar, serie principal), --g-comp (comparacion), --g-meta (meta punteada).
import { esc } from './componentes.js';

// $1.2k / $15k / $950
export function compacto(n){
  n = Math.round(Number(n) || 0);
  var a = Math.abs(n), s = n < 0 ? '-$' : '$';
  if(a >= 1000000) return s + (a / 1000000).toFixed(a >= 10000000 ? 0 : 1).replace('.0', '') + 'M';
  if(a >= 1000) return s + (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace('.0', '') + 'k';
  return s + a;
}

// techo "redondo" para el eje (1, 2, 2.5, 5, 10 x 10^n)
function techo(max){
  if(max <= 0) return 100;
  var p = Math.pow(10, Math.floor(Math.log10(max))), n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

var _registro = [];   // { el, fn, ancho }
function dibujar(el, fn){
  if(!el) return;
  var w = Math.max(260, Math.round(el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || 640));
  el.innerHTML = fn(w);
  _registro = _registro.filter(function(r){ return r.el !== el && r.el.isConnected; });
  _registro.push({ el: el, fn: fn, ancho: w });
}
var _tRes = null;
window.addEventListener('resize', function(){
  clearTimeout(_tRes);
  _tRes = setTimeout(function(){
    _registro.forEach(function(r){
      if(!r.el.isConnected || !r.el.clientWidth) return;
      var w = Math.max(260, Math.round(r.el.clientWidth));
      if(Math.abs(w - r.ancho) > 8){ r.ancho = w; r.el.innerHTML = r.fn(w); }
    });
  }, 150);
});

// Barras (serie principal) + linea (comparacion) + meta punteada.
// o = { etiquetas:[], barras:[], linea?:[], meta?:n, nombreBarras, nombreLinea, resaltar?: indice, alto? }
export function barrasLinea(el, o){
  dibujar(el, function(W){
    var H = o.alto || (W < 480 ? 200 : 240), izq = 44, der = 8, arr = 12, abj = 26;
    var n = o.etiquetas.length, ancho = W - izq - der, alto = H - arr - abj;
    var valores = o.barras.concat(o.linea || [], o.meta ? [o.meta] : []);
    var minimo = Math.min.apply(null, [0].concat(valores));
    var max = techo(Math.max.apply(null, [1].concat(valores)));
    var min = minimo < 0 ? -techo(-minimo) : 0, rango = max - min;
    var y = function(v){ return arr + alto - (v - min) / rango * alto; };
    var paso = ancho / n, bw = Math.max(6, Math.min(38, paso * 0.58));
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.nombreBarras || 'Grafica') + '">';
    for(var g = 0; g <= 4; g++){
      var v = min + rango * g / 4, yy = y(v).toFixed(1);
      s += '<line x1="' + izq + '" x2="' + (W - der) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--g-rejilla)"/>' +
        '<text x="' + (izq - 8) + '" y="' + yy + '" dy="3.5" text-anchor="end">' + compacto(v) + '</text>';
    }
    var cada = n > 8 && W < 520 ? 2 : 1;
    o.barras.forEach(function(v, i){
      var cx = izq + paso * i + paso / 2, y0 = y(0), y1 = y(v), top = Math.min(y0, y1), h = Math.max(Math.abs(y0 - y1), v ? 2 : 0);
      var op = o.resaltar == null || o.resaltar === i ? 1 : 0.55;
      s += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(4, bw / 4) + '" fill="var(--g-actual)" opacity="' + op + '">' +
        '<title>' + esc(o.etiquetas[i]) + ': ' + esc(o.nombreBarras || '') + ' ' + compacto(v) + (o.linea ? ' · ' + esc(o.nombreLinea || '') + ' ' + compacto(o.linea[i]) : '') + '</title></rect>';
      if(i % cada === 0 || i === n - 1) s += '<text x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle"' + (o.resaltar === i ? ' style="fill:var(--black);font-weight:600"' : '') + '>' + esc(o.etiquetas[i]) + '</text>';
    });
    if(o.meta) s += '<line x1="' + izq + '" x2="' + (W - der) + '" y1="' + y(o.meta).toFixed(1) + '" y2="' + y(o.meta).toFixed(1) + '" stroke="var(--g-meta)" stroke-width="1.5" stroke-dasharray="5 5"><title>Meta ' + compacto(o.meta) + '</title></line>';
    if(o.linea){
      var pts = o.linea.map(function(v, i){ return (izq + paso * i + paso / 2).toFixed(1) + ',' + y(v).toFixed(1); });
      s += '<polyline fill="none" stroke="var(--g-comp)" stroke-width="2" stroke-linejoin="round" points="' + pts.join(' ') + '"/>';
      pts.forEach(function(p, i){ var c = p.split(','); s += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="3" fill="var(--card)" stroke="var(--g-comp)" stroke-width="1.6"><title>' + esc(o.etiquetas[i]) + ': ' + esc(o.nombreLinea || '') + ' ' + compacto(o.linea[i]) + '</title></circle>'; });
    }
    return s + '</svg>';
  });
}

// Dona con leyenda. segs = [{ label, valor, color }]; centro = { valor, texto }
export function dona(el, segs, centro){
  if(!el) return;
  var total = segs.reduce(function(a, x){ return a + Math.max(0, x.valor); }, 0);
  var R = 54, C = 2 * Math.PI * R, acum = 0;
  var arcos = total ? segs.filter(function(x){ return x.valor > 0; }).map(function(x){
    var largo = x.valor / total * C, a = '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + x.color + '" stroke-width="18" stroke-dasharray="' + largo.toFixed(2) + ' ' + (C - largo).toFixed(2) + '" stroke-dashoffset="' + (-acum).toFixed(2) + '" transform="rotate(-90 70 70)"><title>' + esc(x.label) + ': ' + compacto(x.valor) + '</title></circle>';
    acum += largo; return a;
  }).join('') : '';
  el.innerHTML = '<div class="dona"><svg viewBox="0 0 140 140" width="140" height="140" role="img"><circle cx="70" cy="70" r="' + R + '" fill="none" stroke="var(--g-rejilla)" stroke-width="18"/>' + arcos +
    (centro ? '<text x="70" y="68" text-anchor="middle" class="dona-valor">' + esc(centro.valor) + '</text><text x="70" y="86" text-anchor="middle" class="dona-texto">' + esc(centro.texto) + '</text>' : '') + '</svg>' +
    '<div class="dona-ley">' + segs.map(function(x){ return '<div><i style="background:' + x.color + '"></i><span>' + esc(x.label) + '</span><b>' + compacto(x.valor) + (total ? ' <em>' + Math.round(Math.max(0, x.valor) / total * 100) + '%</em>' : '') + '</b></div>'; }).join('') + '</div></div>';
}

// Barras horizontales (ranking). filas = [{ label, valor, extra? }]
export function barrasH(filas, formato){
  var max = Math.max.apply(null, [1].concat(filas.map(function(f){ return f.valor; })));
  formato = formato || compacto;
  return filas.map(function(f){
    return '<div class="bh-fila"><span class="bh-label" title="' + esc(f.label) + '">' + esc(f.label) + '</span>' +
      '<span class="bh-pista"><span class="bh-barra" style="width:' + Math.round(Math.max(0, f.valor) / max * 100) + '%"></span></span>' +
      '<span class="bh-valor">' + formato(f.valor) + (f.extra ? ' <em>' + esc(f.extra) + '</em>' : '') + '</span></div>';
  }).join('');
}
