/* ============================================================
   QUITAR FONDO Y CENTRAR EL RELOJ (al subir fotos en el panel)
   ============================================================
   - El fondo se detecta por el color de los bordes de la foto (blanco,
     gris o cualquier color liso de estudio) y se borra rellenando
     desde los bordes hacia adentro: lo que esta encerrado por el reloj
     (una esfera blanca, por ejemplo) no se toca.
   - Despues se recorta al reloj y se centra en un cuadrado, siempre
     ocupando la misma proporcion, para que todos se vean del mismo tamano.
   - Si el fondo no es liso (foto en la mano, en una mesa...), no se
     borra nada: solo se centra la foto en el cuadrado como estaba.
   ============================================================ */

const LADO = 1400;        // cuadrado final
const OCUPA = 0.86;       // el reloj ocupa el 86 % del lado mas largo
const TOL = 34;           // diferencia de color que aun cuenta como fondo
const SUAVE = 22;         // borde suave (anti-dientes) despues de TOL

function dist(d, i, c){ var r = d[i]-c[0], g = d[i+1]-c[1], b = d[i+2]-c[2]; return Math.sqrt(r*r + g*g + b*b); }

// Color del fondo: mediana de los pixeles del borde. Devuelve null si el borde no es liso.
function colorDeFondo(d, w, h){
  var m = [];
  function tomar(x, y){ var i = (y*w + x)*4; if(d[i+3] > 200) m.push([d[i], d[i+1], d[i+2]]); }
  var paso = Math.max(1, Math.round((w + h) / 400));
  for(var x = 0; x < w; x += paso){ tomar(x, 0); tomar(x, h-1); }
  for(var y = 0; y < h; y += paso){ tomar(0, y); tomar(w-1, y); }
  if(m.length < 20) return null;
  var med = [0,1,2].map(function(k){ var v = m.map(function(p){ return p[k]; }).sort(function(a,b){ return a-b; }); return v[v.length >> 1]; });
  var cerca = m.filter(function(p){ var r = p[0]-med[0], g = p[1]-med[1], b = p[2]-med[2]; return Math.sqrt(r*r+g*g+b*b) < TOL; }).length;
  return cerca / m.length >= 0.8 ? med : null;    // al menos el 80 % del borde es del mismo color
}

// Borra el fondo en d (RGBA) rellenando desde los bordes. Devuelve true si habia fondo liso.
function borrarFondo(d, w, h){
  var fondo = colorDeFondo(d, w, h);
  if(!fondo) return false;
  var n = w*h, visto = new Uint8Array(n), cola = new Int32Array(n), ini = 0, fin = 0;
  function meter(p){ if(!visto[p] && dist(d, p*4, fondo) < TOL + SUAVE){ visto[p] = 1; cola[fin++] = p; } }
  for(var x = 0; x < w; x++){ meter(x); meter((h-1)*w + x); }
  for(var y = 0; y < h; y++){ meter(y*w); meter(y*w + w - 1); }
  while(ini < fin){
    var p = cola[ini++], i = p*4, dd = dist(d, i, fondo);
    // transparencia: 0 en el fondo, gradual en el borde del reloj
    d[i+3] = dd <= TOL ? 0 : Math.round(d[i+3] * (dd - TOL) / SUAVE);
    if(dd > TOL) continue;                         // el borde suave no sigue expandiendose
    var px = p % w;
    if(px > 0) meter(p-1);
    if(px < w-1) meter(p+1);
    if(p >= w) meter(p-w);
    if(p < n-w) meter(p+w);
  }
  return true;
}

// Caja del reloj: filas/columnas con suficientes pixeles visibles (ignora motas sueltas)
function cajaVisible(d, w, h){
  var filas = new Uint32Array(h), cols = new Uint32Array(w);
  for(var y = 0; y < h; y++) for(var x = 0; x < w; x++) if(d[(y*w + x)*4 + 3] > 96){ filas[y]++; cols[x]++; }
  var minF = Math.max(2, Math.round(w * 0.004)), minC = Math.max(2, Math.round(h * 0.004));
  var y0 = 0, y1 = h-1, x0 = 0, x1 = w-1;
  while(y0 < h && filas[y0] < minF) y0++;
  while(y1 > y0 && filas[y1] < minF) y1--;
  while(x0 < w && cols[x0] < minC) x0++;
  while(x1 > x0 && cols[x1] < minC) x1--;
  if(y0 >= y1 || x0 >= x1) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// img (Image o canvas) -> canvas cuadrado con el reloj sin fondo y centrado.
// Devuelve { canvas, sinFondo } (sinFondo=false si la foto no tenia fondo liso).
function prepararFoto(img){
  var w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  var esc = Math.min(1, 1600 / Math.max(w0, h0));
  var w = Math.max(1, Math.round(w0*esc)), h = Math.max(1, Math.round(h0*esc));
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, w, h);
  var datos = ctx.getImageData(0, 0, w, h);
  var sinFondo = borrarFondo(datos.data, w, h);
  var caja = sinFondo ? cajaVisible(datos.data, w, h) : null;
  if(sinFondo) ctx.putImageData(datos, 0, 0);
  if(!caja) caja = { x: 0, y: 0, w: w, h: h };

  var out = document.createElement('canvas'); out.width = LADO; out.height = LADO;
  var o = out.getContext('2d'); o.imageSmoothingQuality = 'high';
  var k = (sinFondo ? LADO*OCUPA : LADO) / Math.max(caja.w, caja.h);
  var dw = caja.w*k, dh = caja.h*k;
  if(!sinFondo){ o.fillStyle = '#fff'; o.fillRect(0, 0, LADO, LADO); }   // foto con fondo real: se rellena en blanco
  o.drawImage(c, caja.x, caja.y, caja.w, caja.h, (LADO - dw)/2, (LADO - dh)/2, dw, dh);
  return { canvas: out, sinFondo: sinFondo };
}

export { borrarFondo, cajaVisible, colorDeFondo, prepararFoto };
