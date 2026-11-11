/* ============================================================
   VERSION SIN FONDO PARA EL CARRUSEL (recorte con IA)
   ============================================================
   El carrusel "Mas vendidos" de la portada es negro/glaciar: ahi se nota cualquier
   resto de fondo blanco, pulsera cortada u orilla aspera. Por eso, de la foto
   principal de cada reloj se guarda aparte una version sin fondo de calidad en
   sinfondo/<clave de la foto> (como las miniaturas). La tienda la usa si existe y si
   no, recorta en el navegador como antes (destacados.js).

   Como se recorta (en el navegador del panel, sin costo):
   - Foto con fondo: IA (@imgly/background-removal 1.7, modelo isnet_fp16) UNIDA con un
     relleno por color desde las orillas. La IA sola a veces deja la pulsera medio
     transparente sobre fondos oscuros; el color solo se come pulseras plateadas que
     tocan el borde. Juntas: alfa = el mayor de los dos, pero el color solo cuenta
     donde la IA ya ve algo del reloj (asi no vuelve el halo blanco).
   - Foto que ya venia recortada (subida con "Quitar fondo"): no hay fondo que
     quitar; se suavizan sus orillas (el recorte por color las deja escalonadas).
   - Despues se centra el reloj en un cuadrado, siempre del mismo tamano (como
     fondo.js), y se guarda en WebP con transparencia.
   La IA corre en una pagina aislada (herramientas/recorte-ia.html) dentro de un iframe
   sandbox: necesita 'unsafe-eval' y asi el panel conserva su CSP estricta; esa pagina
   no ve la sesion ni los datos del panel, solo recibe la foto y devuelve el recorte.
   La primera vez descarga el modelo de IA (unos 40 MB, una sola vez por navegador).
   ============================================================ */
import { firebase } from '../../firebase.js';
import { state } from '../state.js';

const RECORTE_URL = '/herramientas/recorte-ia.html';
const API_FOTOS = 'https://api.aphillipsstore.com/fotos';
const FOTOS_BASE = 'https://fotos.aphillipsstore.com/';
const LADO = 1000;        // cuadrado final
const OCUPA = 0.88;       // el reloj ocupa el 88 % del lado mas largo
const MAX_ENTRADA = 1200; // la foto se reduce a esto antes de recortar (la IA trabaja a 1024: rapido y suficiente)
let _marco = null, _pend = {}, _n = 0, _alAvanzar = null;

// iframe aislado con la IA; responde por postMessage (se valida que el mensaje venga de ese iframe)
function marco(){
  if(_marco) return _marco;
  _marco = new Promise(function(ok, mal){
    var f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');
    f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden';
    var t = setTimeout(function(){ _marco = null; f.remove(); mal(new Error('La herramienta de recorte no respondio. Revisa tu internet.')); }, 30000);
    window.addEventListener('message', function(e){
      if(e.source !== f.contentWindow) return;
      var m = e.data || {};
      if(m.tipo === 'listo'){ clearTimeout(t); ok(f); return; }
      if(m.tipo === 'avance'){ if(_alAvanzar) _alAvanzar(m.texto); return; }
      var p = _pend[m.id]; if(!p) return;
      delete _pend[m.id]; clearTimeout(p.t);
      if(m.ok && m.png instanceof ArrayBuffer) p.ok(new Blob([m.png], { type: 'image/png' })); else p.mal(new Error(m.error || 'No se pudo recortar'));
    });
    f.src = RECORTE_URL;
    document.body.appendChild(f);
  });
  return _marco;
}
async function recortarConIA(png, alAvanzar){
  var f = await marco(), buf = await png.arrayBuffer(), id = ++_n;
  _alAvanzar = alAvanzar || null;
  return new Promise(function(ok, mal){
    // la primera foto incluye la descarga del modelo: hasta 4 minutos con internet lento
    var t = setTimeout(function(){ delete _pend[id]; mal(new Error('El recorte tardo demasiado')); }, 240000);
    _pend[id] = { ok: ok, mal: mal, t: t };
    f.contentWindow.postMessage({ id: id, png: buf }, '*', [buf]);
  });
}

function lienzo(w, h){ var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function aBlob(c, tipo, q){ return new Promise(function(ok){ c.toBlob(ok, tipo, q); }); }
function leerImagen(url){
  return new Promise(function(ok, mal){
    var img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = function(){ ok(img); };
    img.onerror = function(){ mal(new Error('No se pudo leer la foto')); };
    img.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'cors=1';
  });
}
function blobAImagen(b){
  return new Promise(function(ok, mal){
    var u = URL.createObjectURL(b), img = new Image();
    img.onload = function(){ URL.revokeObjectURL(u); ok(img); };
    img.onerror = function(){ URL.revokeObjectURL(u); mal(new Error('Imagen invalida')); };
    img.src = u;
  });
}

// fraccion de la orilla que ya es transparente (foto recortada antes)
function orillaTransparente(d, w, h){
  var t = 0, n = 0, p = Math.max(1, Math.round((w + h) / 400));
  function ver(x, y){ n++; if(d[(y * w + x) * 4 + 3] < 20) t++; }
  for(var x = 0; x < w; x += p){ ver(x, 0); ver(x, h - 1); }
  for(var y = 0; y < h; y += p){ ver(0, y); ver(w - 1, y); }
  return n ? t / n : 0;
}

// relleno por color desde las orillas: avanza solo entre pixeles parecidos al color de la orilla y sin saltos
// bruscos (el borde del reloj lo frena). Devuelve alfa 0..255 (0 = fondo) con un borde suave de 1 px.
function alfaPorColor(d, w, h){
  var sr = 0, sg = 0, sb = 0, cn = 0, i;
  for(var x = 0; x < w; x += 2){ i = x * 4; sr += d[i]; sg += d[i+1]; sb += d[i+2]; i = ((h - 1) * w + x) * 4; sr += d[i]; sg += d[i+1]; sb += d[i+2]; cn += 2; }
  for(var y = 0; y < h; y += 2){ i = y * w * 4; sr += d[i]; sg += d[i+1]; sb += d[i+2]; i = (y * w + w - 1) * 4; sr += d[i]; sg += d[i+1]; sb += d[i+2]; cn += 2; }
  sr /= cn; sg /= cn; sb /= cn;
  var n = w * h, fondo = new Uint8Array(n), pila = new Int32Array(n), tope = 0;
  function parecido(v){ var k = v * 4; return Math.abs(d[k] - sr) + Math.abs(d[k+1] - sg) + Math.abs(d[k+2] - sb) < 60; }
  function suave(v, u){ var a = v * 4, b = u * 4; return Math.abs(d[a] - d[b]) + Math.abs(d[a+1] - d[b+1]) + Math.abs(d[a+2] - d[b+2]) <= 14; }
  function meter(v, desde){ if(!fondo[v] && parecido(v) && (desde < 0 || suave(v, desde))){ fondo[v] = 1; pila[tope++] = v; } }
  for(x = 0; x < w; x++){ meter(x, -1); meter((h - 1) * w + x, -1); }
  for(y = 0; y < h; y++){ meter(y * w, -1); meter(y * w + w - 1, -1); }
  while(tope){
    var q = pila[--tope], qx = q % w, qy = (q / w) | 0;
    if(qx > 0) meter(q - 1, q); if(qx < w - 1) meter(q + 1, q);
    if(qy > 0) meter(q - w, q); if(qy < h - 1) meter(q + w, q);
  }
  var a = new Uint8ClampedArray(n);
  for(y = 0; y < h; y++) for(x = 0; x < w; x++){
    var v = y * w + x;
    if(fondo[v]){ a[v] = 0; continue; }
    var t = 0, m = 0;
    for(var dy = -1; dy <= 1; dy++) for(var dx = -1; dx <= 1; dx++){
      var X = x + dx, Y = y + dy; if(X < 0 || Y < 0 || X >= w || Y >= h) continue;
      m++; if(fondo[Y * w + X]) t++;
    }
    a[v] = Math.round(255 * (1 - t / m));
  }
  return a;
}

// suaviza un alfa escalonado: desenfoque de caja (2 pasadas) y vuelve a definir el borde
function suavizarAlfa(alfa, w, h, r){
  var tmp = new Float32Array(w * h), out = new Float32Array(w * h), x, y, s, k;
  for(var i = 0; i < alfa.length; i++) out[i] = alfa[i];
  for(var pas = 0; pas < 2; pas++){
    for(y = 0; y < h; y++){ s = 0; for(x = -r; x <= r; x++) s += out[y * w + Math.min(w - 1, Math.max(0, x))];
      for(x = 0; x < w; x++){ tmp[y * w + x] = s / (2 * r + 1); s += out[y * w + Math.min(w - 1, x + r + 1)] - out[y * w + Math.max(0, x - r)]; } }
    for(x = 0; x < w; x++){ s = 0; for(y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for(y = 0; y < h; y++){ out[y * w + x] = s / (2 * r + 1); s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  }
  var a = new Uint8ClampedArray(w * h);
  for(k = 0; k < a.length; k++){ var v = (out[k] / 255 - 0.2) / 0.6; a[k] = Math.round(255 * Math.max(0, Math.min(1, v))); }
  return a;
}

// caja del reloj (ignora motas sueltas)
function caja(alfa, w, h){
  var filas = new Uint32Array(h), cols = new Uint32Array(w), x, y;
  for(y = 0; y < h; y++) for(x = 0; x < w; x++) if(alfa[y * w + x] > 96){ filas[y]++; cols[x]++; }
  var mf = Math.max(2, Math.round(w * 0.004)), mc = Math.max(2, Math.round(h * 0.004));
  var y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
  while(y0 < h && filas[y0] < mf) y0++;
  while(y1 > y0 && filas[y1] < mf) y1--;
  while(x0 < w && cols[x0] < mc) x0++;
  while(x1 > x0 && cols[x1] < mc) x1--;
  if(y0 >= y1 || x0 >= x1) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// foto (url del catalogo, o la imagen original al subirla) -> Blob WebP sin fondo, centrado (o null si no se pudo)
async function crearVersionSinFondo(fuente, alAvanzar){
  var img = typeof fuente === 'string' ? await leerImagen(fuente) : fuente;
  var w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height, k = Math.min(1, MAX_ENTRADA / Math.max(w0, h0));
  var w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  var c = lienzo(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
  var datos = x.getImageData(0, 0, w, h), d = datos.data, n = w * h, i, alfa;

  if(orillaTransparente(d, w, h) > 0.6){
    // ya venia recortada: solo se suavizan sus orillas
    var a0 = new Uint8ClampedArray(n); for(i = 0; i < n; i++) a0[i] = d[i * 4 + 3];
    alfa = suavizarAlfa(a0, w, h, Math.max(1, Math.round(w / 700)));
    for(i = 0; i < n; i++) alfa[i] = Math.min(alfa[i], a0[i] < 8 ? 0 : 255);   // nunca agrega lo que no estaba
  } else {
    // con fondo: IA + color
    var blanco = lienzo(w, h), bx = blanco.getContext('2d');
    bx.fillStyle = '#fff'; bx.fillRect(0, 0, w, h); bx.drawImage(c, 0, 0);
    var res = await recortarConIA(await aBlob(blanco, 'image/png'), alAvanzar);
    var iaImg = await blobAImagen(res), iaC = lienzo(w, h), iaX = iaC.getContext('2d', { willReadFrequently: true });
    iaX.drawImage(iaImg, 0, 0, w, h);
    var dIa = iaX.getImageData(0, 0, w, h).data;
    var porColor = alfaPorColor(d, w, h);
    alfa = new Uint8ClampedArray(n);
    for(i = 0; i < n; i++){ var ai = dIa[i * 4 + 3]; alfa[i] = ai < 26 ? ai : Math.max(ai, porColor[i]); }
  }
  for(i = 0; i < n; i++) d[i * 4 + 3] = alfa[i];
  x.putImageData(datos, 0, 0);

  var b = caja(alfa, w, h);
  if(!b) return null;
  var out = lienzo(LADO, LADO), o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  var e = LADO * OCUPA / Math.max(b.w, b.h), dw = b.w * e, dh = b.h * e;
  o.drawImage(c, b.x, b.y, b.w, b.h, (LADO - dw) / 2, (LADO - dh) / 2, dw, dh);
  var blob = await aBlob(out, 'image/webp', 0.9);
  if(blob && blob.type === 'image/webp') return blob;
  // Safari no sabe crear WebP: PNG mas chico (640 px) para que no pese de mas en el carrusel del celular
  var chico = lienzo(640, 640), cx = chico.getContext('2d');
  cx.imageSmoothingQuality = 'high'; cx.drawImage(out, 0, 0, 640, 640);
  return await aBlob(chico, 'image/png');
}

// ---------- guardar y revisar versiones sin fondo ----------
// clave de una foto del catalogo (relojes/<carpeta>/<archivo>) o null si no es una foto subida a la nube
function claveDe(url){ return typeof url === 'string' && url.indexOf(FOTOS_BASE + 'relojes/') === 0 ? url.slice(FOTOS_BASE.length).split('?')[0] : null; }
function urlSinFondo(url){ var c = claveDe(url); return c ? FOTOS_BASE + 'sinfondo/' + c : null; }
// existe ya su version sin fondo? (se prueba cargandola como imagen: no necesita permisos extra)
function tieneSinFondo(url){
  var u = urlSinFondo(url);
  if(!u) return Promise.resolve(false);
  return new Promise(function(ok){ var i = new Image(); i.onload = function(){ ok(true); }; i.onerror = function(){ ok(false); }; i.src = u + '?v=' + Date.now(); });
}
async function subirSinFondo(blob, url){
  var clave = claveDe(url), carpeta = clave.split('/')[1];
  var usuario = firebase.auth().currentUser;
  if(!usuario) throw new Error('Inicia sesion de nuevo');
  var r = await fetch(API_FOTOS + '?reloj=' + encodeURIComponent(carpeta) + '&sf=' + encodeURIComponent(clave), {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + await usuario.getIdToken(), 'Content-Type': blob.type }, body: blob
  });
  var d = {}; try{ d = await r.json(); }catch(e){}
  if(!r.ok) throw new Error(d.error || ('Error ' + r.status));
  return d.url;
}
// crea y sube la version sin fondo de una foto (si ya existe y no se pide rehacer, no hace nada)
// devuelve 'creada', 'ya' o 'omitida' (foto sin clave de la nube)
// "original": la imagen tal como se subio (antes del recorte por color de fondo.js), si se tiene: la IA parte de
// ella y no de la foto ya recortada
async function asegurarSinFondo(url, alAvanzar, rehacer, original){
  if(!claveDe(url)) return 'omitida';
  if(!rehacer && await tieneSinFondo(url)) return 'ya';
  var blob = await crearVersionSinFondo(original || url, alAvanzar);
  if(!blob) throw new Error('No se encontro el reloj en la foto');
  await subirSinFondo(blob, url);
  return 'creada';
}
// foto principal de un reloj (la que usa el carrusel)
function fotoPrincipal(r){ return r && (r.foto || (Array.isArray(r.fotos) ? r.fotos[0] : '')) || ''; }

// ---------- Ajustes > Fotos del carrusel: procesar todo el catalogo ----------
var _procesando = false;
function _estadoSf(txt, color){ var e = document.getElementById('sf-estado'); if(e){ e.textContent = txt; e.style.color = color || ''; } }
async function crearSinFondoCatalogo(rehacer){
  if(_procesando) return;
  if(!navigator.onLine){ _estadoSf('Necesitas internet.', 'var(--red)'); return; }
  if(rehacer && !confirm('Se volveran a recortar TODAS las fotos principales, aunque ya tengan su version sin fondo. Puede tardar bastante. ¿Seguir?')) return;
  var relojes = (state.inventario || []).filter(function(r){ return !r.borrado && claveDe(fotoPrincipal(r)); });
  var vistos = {}, lista = [];
  relojes.forEach(function(r){ var u = fotoPrincipal(r); if(!vistos[u]){ vistos[u] = 1; lista.push({ url: u, nombre: r.nombre || r.modelo || 'Reloj' }); } });
  if(!lista.length){ _estadoSf('No hay relojes con foto en la nube.', 'var(--muted)'); return; }
  _procesando = true;
  var bA = document.getElementById('sf-btn'), bR = document.getElementById('sf-btn-rehacer');
  if(bA) bA.disabled = true; if(bR) bR.disabled = true;
  // la pantalla no se apaga mientras trabaja (si el navegador lo permite)
  var cerrojo = null; try{ cerrojo = await navigator.wakeLock.request('screen'); }catch(e){}
  var creadas = 0, ya = 0, fallos = 0, t0 = Date.now(), primerError = '';
  for(var k = 0; k < lista.length; k++){
    var pref = 'Foto ' + (k + 1) + ' de ' + lista.length + ' (' + lista[k].nombre + ')';
    _estadoSf(pref + '…');
    try{
      var r = await asegurarSinFondo(lista[k].url, function(m){ _estadoSf(pref + ': ' + m); }, rehacer);
      if(r === 'creada') creadas++; else ya++;
    }catch(e){ fallos++; if(!primerError) primerError = String(e && e.message || e).slice(0, 160); console.warn('Sin fondo no creada:', lista[k].url, e); }
  }
  try{ if(cerrojo) await cerrojo.release(); }catch(e){}
  _procesando = false;
  if(bA) bA.disabled = false; if(bR) bR.disabled = false;
  var min = Math.max(1, Math.round((Date.now() - t0) / 60000));
  _estadoSf('Listo en ' + min + ' min: ' + creadas + ' creadas, ' + ya + ' ya estaban' + (fallos ? ', ' + fallos + ' con error. Error: "' + primerError + '". Prueba desde una computadora (Chrome o Edge) y vuelve a tocar el botón' : '') + '.', fallos ? 'var(--amber)' : 'var(--green)');
}
// el panel no se cierra a medias sin avisar
window.addEventListener('beforeunload', function(e){ if(_procesando){ e.preventDefault(); e.returnValue = ''; } });

export { asegurarSinFondo, crearSinFondoCatalogo, crearVersionSinFondo, fotoPrincipal, tieneSinFondo, urlSinFondo };
Object.assign(window, { crearSinFondoCatalogo });
