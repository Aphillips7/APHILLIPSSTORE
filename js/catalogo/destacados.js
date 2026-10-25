// =================== CARRUSEL DESTACADOS ===================
// "Mas vendidos": los relojes a la venta con mas clics a WhatsApp (GET /destacados de la API, que solo da
// sus ids en orden). Si todavia no hay clics, se muestran los ultimos relojes disponibles. "Comprar ahora"
// (o tocar la foto) abre la ficha completa del reloj.
import { relojes } from './datos.js';
import { abrir } from './modal.js';
import { _destEsc, miniatura, srcsetFoto } from './ui.js';

const API_DEST = 'https://api.aphillipsstore.com/destacados';
var DEST_LOCAL = [];
var _destIds = null, _destMovido = 0;

function _destItem(r){
  var partes = String(r.nombre || 'Reloj').split(' ');
  var fotos = [r.foto].concat(r.fotos || []).filter(function(u, k, a){ return u && a.indexOf(u) === k; }).slice(0, 4);
  return { id: r.id, nombre: partes[0], detalle: partes.slice(1).join(' '), precio: r.precio ? '$' + Number(r.precio).toLocaleString() : '', etiqueta: '', fotos: fotos };
}
function _destArmar(){
  if(!relojes.length) return false;
  var porId = {}; relojes.forEach(function(r){ porId[r.id] = r; });
  var lista = (_destIds || []).map(function(id){ return porId[id]; }).filter(Boolean);
  if(lista.length < 3){   // sin suficientes clics todavia: se completa con los ultimos disponibles
    relojes.forEach(function(r){ if(lista.length < 6 && r.estado === 'disponible' && lista.indexOf(r) === -1) lista.push(r); });
  }
  DEST_LOCAL = lista.map(_destItem);
  _destHtml = [];
  renderDestacados();
  return true;
}
function cargarDestacados(){
  fetch(API_DEST).then(function(r){ return r.ok ? r.json() : { ids: [] }; }).catch(function(){ return { ids: [] }; }).then(function(d){
    _destIds = Array.isArray(d.ids) ? d.ids : [];
    var intentos = 0;
    (function esperar(){ if(_destArmar() || ++intentos > 60) return; setTimeout(esperar, 300); })();
  });
}
// abre la ficha del reloj (si no se estaba arrastrando el carrusel)
function destAbrir(id){
  if(Date.now() - _destMovido < 400) return;
  abrir(id);
}

function _destVis(){ var t=document.getElementById('dest-track'); return Math.max(1, parseInt(getComputedStyle(t).getPropertyValue('--vis'))||3); }
var _bolsa = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 8h13l-1 12h-11z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>';
var _chevI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
var _chevD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';

// FOTOS SIN FONDO: en el carrusel el fondo blanco de cada foto se vuelve transparente para que se vea el
// degradado celeste detras, sin tocar el reloj. Se borra SOLO el blanco que toca los bordes de la foto (relleno
// desde las orillas), asi los brillos blancos del acero quedan intactos (antes un filtro de color tambien
// borraba esos brillos y en iPhone se veian manchas celestes dentro del reloj). Se hace una vez por foto, en
// un lienzo, y se guarda en memoria. Si no se puede (sin permiso de la imagen o error), la foto se muestra con
// el filtro de respaldo.
var _sinFondo = {};   // url -> Promise<blob url>
(function(){
  if(document.getElementById('filtro-sin-blanco')) return;
  var d = document.createElement('div');
  d.setAttribute('aria-hidden', 'true');
  d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  // respaldo: alfa = 6 x (2,94 - (R+G+B)); feComposite "in" deja transparente el margen vacio de la foto
  d.innerHTML = '<svg width="0" height="0"><filter id="filtro-sin-blanco" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -6 -6 -6 0 17.64" result="sinblanco"/><feComposite in="sinblanco" in2="SourceAlpha" operator="in"/></filter></svg>';
  document.body.appendChild(d);
})();
function quitarFondoBlanco(url){
  if(_sinFondo[url]) return _sinFondo[url];
  // "?sf=1": direccion propia, asi el navegador no reutiliza una copia guardada sin permiso de lectura
  _sinFondo[url] = fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'sf=1', { mode: 'cors', credentials: 'omit' })
    .then(function(r){ if(!r.ok) throw new Error('foto ' + r.status); return r.blob(); })
    .then(function(b){ return createImageBitmap(b); })
    .then(function(img){
      var k = Math.min(1, 760 / Math.max(img.width, img.height));   // 760 px bastan para la tarjeta del carrusel
      var W = Math.max(1, Math.round(img.width * k)), H = Math.max(1, Math.round(img.height * k));
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d'); x.drawImage(img, 0, 0, W, H);
      var d = x.getImageData(0, 0, W, H), p = d.data, n = W * H;
      // blanco del fondo: los tres canales altos y casi sin color (el ruido del JPG se tolera)
      function blanco(i){ var r = p[i], g = p[i+1], b = p[i+2], mn = Math.min(r, g, b); return mn >= 232 && Math.max(r, g, b) - mn <= 22; }
      // relleno desde las orillas con una pila de enteros: cada pixel entra una sola vez (rapido en celular)
      var fondo = new Uint8Array(n), pila = new Int32Array(n), tope = 0, xx, yy, q;
      function meter(v){ if(!fondo[v] && blanco(v * 4)){ fondo[v] = 1; pila[tope++] = v; } }
      for(xx = 0; xx < W; xx++){ meter(xx); meter((H - 1) * W + xx); }
      for(yy = 0; yy < H; yy++){ meter(yy * W); meter(yy * W + W - 1); }
      while(tope){
        q = pila[--tope]; xx = q % W; yy = (q / W) | 0;
        if(xx > 0) meter(q - 1); if(xx < W - 1) meter(q + 1);
        if(yy > 0) meter(q - W); if(yy < H - 1) meter(q + W);
      }
      // borde suave: cada pixel toma la transparencia promedio de su vecindario 3x3; en el borde del reloj los
      // pixeles casi blancos (el halo del recorte) se vuelven parcialmente transparentes
      for(yy = 0; yy < H; yy++) for(xx = 0; xx < W; xx++){
        q = yy * W + xx;
        if(fondo[q]){ p[q * 4 + 3] = 0; continue; }
        var t = 0, m = 0;
        for(var dy = -1; dy <= 1; dy++) for(var dx = -1; dx <= 1; dx++){
          var X = xx + dx, Y = yy + dy; if(X < 0 || Y < 0 || X >= W || Y >= H) continue;
          m++; if(fondo[Y * W + X]) t++;
        }
        if(t){
          var mn = Math.min(p[q*4], p[q*4+1], p[q*4+2]);
          var blancura = Math.max(0, Math.min(1, (mn - 200) / 55));   // 0 = oscuro, 1 = casi blanco
          p[q * 4 + 3] = Math.round(255 * (1 - (t / m) * blancura));
        }
      }
      x.putImageData(d, 0, 0);
      return new Promise(function(ok, mal){ c.toBlob(function(b){ b ? ok(URL.createObjectURL(b)) : mal(new Error('sin blob')); }, 'image/png'); });
    });
  return _sinFondo[url];
}
// aplica la foto sin fondo a todas las tarjetas del carrusel (las copias del carrusel infinito comparten foto)
function _destSinFondo(){
  // tarjeta chica (celular, pantalla normal): basta la miniatura de 480 px, mucho mas liviana; si no, la foto completa
  var tarjeta = document.querySelector('#dest-track .dest-foto');
  var px = tarjeta ? tarjeta.getBoundingClientRect().width * (window.devicePixelRatio || 1) : 9999;
  document.querySelectorAll('#dest-track img.g.esperando').forEach(function(img){
    var completa = img.getAttribute('data-completa'); if(!completa) return;
    var url = px <= 560 ? miniatura(completa) : completa;
    var listo = false;
    var mostrar = function(){ img.classList.remove('esperando'); };
    // si tarda mucho, se muestra con el filtro de respaldo y se cambia cuando este lista
    var t = setTimeout(function(){ if(!listo){ img.classList.add('con-filtro'); mostrar(); } }, 2500);
    quitarFondoBlanco(url).then(function(blob){
      listo = true; clearTimeout(t);
      img.removeAttribute('srcset'); img.removeAttribute('sizes');
      img.onload = function(){ img.classList.remove('con-filtro'); mostrar(); };
      img.src = blob;
    }).catch(function(){ listo = true; clearTimeout(t); img.classList.add('con-filtro'); mostrar(); });
  });
}

// Carrusel infinito: la ventana (con las lineas entre tarjetas) queda fija y solo se desliza el contenido.
// Se dibujan copias a ambos lados y, al terminar de deslizar, se salta sin animacion a la posicion equivalente.
var _destN = 0, _destIdx = 0, _destC = 0, _destAnim = false, _destT = 0, _destHtml = [];
function _destMod(i){ return _destN ? ((i % _destN) + _destN) % _destN : 0; }
function _destPaso(){ var c=document.querySelector('#dest-track .dest-card'); return c ? c.getBoundingClientRect().width : 0; }
function _destCard(r){
  // solo la foto de portada (sin galeria ni flechas en el carrusel)
  var fotos = (r.fotos||[]).slice(0, 1).map(function(src){ return '<img class="g on frente esperando" src="'+_destEsc(miniatura(src))+'"'+srcsetFoto(src, '(max-width:600px) 85vw, (max-width:1100px) 45vw, 30vw')+' data-completa="'+_destEsc(src)+'" onerror="if(!fotoRespaldo(this))this.remove()" alt="" draggable="false">'; }).join('');
  if(!fotos) fotos = '<span class="sinfoto">Sin foto</span>';
  var gal = '';
  return '<div class="dest-card">'+
    '<div class="dest-foto" onclick="destAbrir(\''+_destEsc(r.id)+'\')">'+(r.etiqueta?'<span class="dest-badge">'+_destEsc(r.etiqueta)+'</span>':'')+fotos+gal+'</div>'+
    '<div class="dest-nombre">'+_destEsc(r.nombre)+'</div>'+
    '<div class="dest-sub">'+_destEsc(r.detalle||'')+'</div>'+   // siempre: todas las tarjetas del carrusel miden lo mismo
    '<div class="dest-precio">'+_destEsc(r.precio||'')+'</div>'+
    '<div class="dest-comprar"><button type="button" onclick="destAbrir(\''+_destEsc(r.id)+'\')"><span>'+_bolsa+'Comprar ahora</span></button></div>'+
  '</div>';
}
function _destPos(anim){
  var t = document.getElementById('dest-track');
  if(anim) t.classList.add('anim'); else t.classList.remove('anim');
  t.style.setProperty('--pos', _destIdx + _destC);
  t.style.setProperty('--drag', '0px');
  if(!anim) void t.offsetWidth;
}
function renderDestacados(){
  var sec = document.getElementById('destacados'), track = document.getElementById('dest-track'); if(!track) return;
  _destN = DEST_LOCAL.length;
  if(!_destN){ sec.style.display='none'; return; }
  sec.style.display='';
  var vis = _destVis();
  _destC = _destN>1 ? vis+2 : 0;
  if(_destHtml.length !== _destN) _destHtml = DEST_LOCAL.map(_destCard);
  var h = '';
  for(var k=-_destC; k<_destN+_destC; k++) h += _destHtml[_destMod(k)];
  track.innerHTML = h;
  _destSinFondo();   // fotos sin fondo blanco (ver arriba)
  var dv = ''; for(var j=0; j<=vis; j++) dv += '<i style="--k:'+j+'"></i>';
  document.getElementById('dest-div').innerHTML = dv;
  _destAnim = false; _destIdx = _destMod(_destIdx);
  _destPos(false);
  destPuntos();
}
function destGal(btn, dir){ // cambia la imagen dentro de la tarjeta con fundido
  var foto = btn.closest('.dest-foto'), imgs = foto.querySelectorAll('.g'); if(imgs.length<2) return;
  var i = 0; imgs.forEach(function(im,k){ if(im.classList.contains('on')) i=k; });
  var n = (i+dir+imgs.length)%imgs.length;
  imgs[i].classList.remove('on'); imgs[n].classList.add('on');
}
function destPuntos(){
  var box = document.getElementById('dest-puntos');
  box.innerHTML = _destN>1 ? Array.apply(null,Array(_destN)).map(function(_,i){ return '<button type="button" class="dest-punto" aria-label="Ir al reloj '+(i+1)+'" onclick="destIr('+i+')"></button>'; }).join('') : '';
  document.getElementById('dest-nav').style.display = _destN>1 ? '' : 'none';
  destActualizar();
}
function _destFin(){
  if(!_destAnim) return;
  _destAnim = false;
  var m = _destMod(_destIdx);
  if(m !== _destIdx){ _destIdx = m; _destPos(false); }
}
function destMover(dir){
  if(_destN<2 || _destAnim) return;
  _destAnim = true; _destIdx += dir;
  _destPos(true); destActualizar();
  clearTimeout(_destT); _destT = setTimeout(_destFin, 800);
}
function destIr(pag){
  if(_destN<2 || _destAnim) return;
  var d = pag - _destMod(_destIdx); if(!d) return;
  if(Math.abs(d)===_destN-1) d = d>0 ? -1 : 1;
  if(Math.abs(d)===1){ destMover(d); }
  else { _destIdx = pag; _destPos(false); destActualizar(); }
}
function destActualizar(){
  var pg = _destMod(_destIdx);
  document.querySelectorAll('#dest-puntos .dest-punto').forEach(function(d,i){ d.classList.toggle('on', i===pg); });
}
(function(){
  var t = document.getElementById('dest-track'), st = document.getElementById('dest-stage'); if(!t || !st) return;
  t.addEventListener('transitionend', function(e){ if(e.target===t && e.propertyName==='transform'){ clearTimeout(_destT); _destFin(); } });
  // arrastrar con el dedo o el mouse
  var x0=0, y0=0, dx=0, activo=false, movido=false;
  st.addEventListener('pointerdown', function(e){
    if(e.pointerType==='mouse' && e.button!==0) return;
    if(e.target.closest && e.target.closest('.dest-gal')) return;
    if(_destAnim || _destN<2) return;
    activo = true; movido = false; x0 = e.clientX; y0 = e.clientY; dx = 0;
  });
  st.addEventListener('pointermove', function(e){
    if(!activo) return;
    dx = e.clientX - x0;
    if(!movido){
      if(Math.abs(dx)<6) return;
      if(Math.abs(e.clientY-y0) > Math.abs(dx)){ activo = false; return; }
      movido = true; try{ st.setPointerCapture(e.pointerId); }catch(_){}
      st.classList.add('arrastrando'); t.classList.remove('anim');
    }
    t.style.setProperty('--drag', dx+'px');
  });
  function fin(){
    if(!activo) return; activo = false;
    if(!movido) return;
    st.classList.remove('arrastrando');
    var paso = _destPaso(), dir = 0;
    if(Math.abs(dx) > Math.min(60, paso*0.2)) dir = dx<0 ? 1 : -1;
    _destMovido = Date.now();
    if(dir){ _destAnim = true; _destIdx += dir; clearTimeout(_destT); _destT = setTimeout(_destFin, 800); }
    _destPos(true); destActualizar();
  }
  st.addEventListener('pointerup', fin);
  st.addEventListener('pointercancel', fin);
  var ult = 0;
  window.addEventListener('resize', function(){ var v=_destVis(); if(v!==ult){ ult=v; renderDestacados(); } });
  renderDestacados(); ult = _destVis();
  cargarDestacados();
})();

export { _bolsa, _chevD, _chevI, _destAnim, _destC, _destCard, _destFin, _destHtml, _destIdx, _destMod, _destN, _destPaso, _destPos, _destT, _destVis, DEST_LOCAL, destActualizar, destGal, destIr, destMover, destPuntos, renderDestacados };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { destAbrir, destGal, destIr, destMover });
