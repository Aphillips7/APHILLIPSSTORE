// =================== RUEDA DE RELOJES ===================
// Seccion "Encuentra tu reloj ideal": los relojes a la venta, en su version sin fondo (sinfondo/<clave>, la
// misma del carrusel negro), acomodados en circulo como los rayos de una rueda que gira despacio; el texto y el
// boton quedan fijos en el centro. Tocar un reloj abre su ficha.
// A prueba de errores: solo entran relojes cuya foto sin fondo de verdad carga (una foto con fondo blanco se
// veria como un cuadro); si no hay suficientes para que la rueda se vea llena, la seccion no aparece.
import { relojes } from './datos.js';
import { abrir } from './modal.js';

var BASE = 'https://fotos.aphillipsstore.com/';
var MAX = 16, MIN = 8;   // cuantos relojes caben bien en la rueda / con menos se ve vacia

function urlSinFondo(u){
  return typeof u === 'string' && u.indexOf(BASE + 'relojes/') === 0 ? BASE + 'sinfondo/' + u.slice(BASE.length).split('?')[0] : null;
}
// candidatos: a la venta, con foto en la nube; se toman repartidos por todo el catalogo (no solo los ultimos).
// Unos pocos de mas por si alguno todavia no tiene version sin fondo.
function candidatos(){
  var lista = relojes.filter(function(r){ return r.estado !== 'vendido' && urlSinFondo(r.foto); });
  var cuantos = MAX + 4;
  if(lista.length <= cuantos) return lista;
  var paso = lista.length / cuantos, sel = [];
  for(var i = 0; i < cuantos; i++) sel.push(lista[Math.floor(i * paso)]);
  return sel;
}
// descarga y prepara cada foto sin fondo; devuelve solo las que existen (en el mismo orden), con la imagen ya
// lista para pintarse: asi todos los relojes aparecen juntos y no de a uno mientras la rueda gira
function probar(lista){
  return Promise.all(lista.map(function(r){
    return new Promise(function(ok){
      var img = new Image(), url = urlSinFondo(r.foto), t = setTimeout(function(){ ok(null); }, 10000);
      var listo = function(){ clearTimeout(t); ok({ id: r.id, nombre: r.nombre || 'Reloj', img: img }); };
      img.alt = ''; img.draggable = false; img.decoding = 'async';
      img.onload = function(){ (img.decode ? img.decode() : Promise.resolve()).then(listo, listo); };
      img.onerror = function(){ clearTimeout(t); ok(null); };
      img.src = url;
    });
  })).then(function(r){ return r.filter(Boolean).slice(0, MAX); });
}
// NITIDEZ: la foto pesa 1000 px pero en la rueda mide ~130 px. Si se deja que el navegador la achique mientras
// gira, la tarjeta de video lo hace rapido y se ve blanda. Por eso cada reloj se dibuja UNA vez en un lienzo
// del tamano exacto en pixeles de la pantalla (con su densidad), achicado en alta calidad y por pasos, con la
// sombra incluida: al girar no hay que achicar nada. Si cambia el tamano de la ventana, se vuelve a dibujar.
// TAMANO: las fotos sin fondo del panel son de 1000x1000 con el reloj siempre dentro de la franja central
// (x 180-820, y 60-940, medido en todo el catalogo). Se dibuja solo esa franja y llenando el alto del espacio
// del reloj (antes se dibujaba la foto entera con su aire y el reloj quedaba de la mitad del tamano).
var _items = [];
var RECORTE = [.18, .06, .64, .88];   // x, y, ancho, alto (fraccion de la foto) donde siempre esta el reloj
function achicar(img, anchoFinal){
  var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  var sx = W * RECORTE[0], sy = H * RECORTE[1], sw = W * RECORTE[2], sh = H * RECORTE[3];
  // a la mitad cada vez hasta quedar cerca del tamano final: mucho mas fino que achicar de un solo golpe
  var fuente = img, fx = sx, fy = sy, fw = sw, fh = sh;
  while(fw / 2 >= anchoFinal * 1.5){
    var c = document.createElement('canvas'); c.width = Math.round(fw / 2); c.height = Math.round(fh / 2);
    var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(fuente, fx, fy, fw, fh, 0, 0, c.width, c.height);
    fuente = c; fx = 0; fy = 0; fw = c.width; fh = c.height;
  }
  return { f: fuente, x: fx, y: fy, w: fw, h: fh };
}
function pintar(lienzo, img){
  var b = lienzo.parentNode; if(!b) return;
  var W = b.offsetWidth, H = b.offsetHeight;   // espacio del reloj, sin contar el giro
  if(!W || !H) return;
  var dpr = Math.min(3, window.devicePixelRatio || 1);
  var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
  if(lienzo.width === pw && lienzo.height === ph) return;
  lienzo.width = pw; lienzo.height = ph;
  var x = lienzo.getContext('2d');
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  // margen para que la sombra no se corte en el borde del lienzo
  var m = Math.round(Math.min(pw, ph) * .05);
  var k = Math.min((pw - 2 * m) / RECORTE[2], (ph - 2 * m) / RECORTE[3]);
  var dw = RECORTE[2] * k, dh = RECORTE[3] * k;
  var r = achicar(img, dw);
  x.shadowColor = 'rgba(0,0,0,.16)'; x.shadowBlur = Math.round(m * .9); x.shadowOffsetY = Math.round(m * .45);
  x.drawImage(r.f, r.x, r.y, r.w, r.h, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
}
function pintarTodos(){ _items.forEach(function(it){ pintar(it.lienzo, it.img); }); }
function dibujar(items){
  var sec = document.getElementById('rueda'), aro = document.getElementById('rueda-aro');
  if(!sec || !aro) return;
  if(items.length < MIN){ sec.hidden = true; return; }
  // numero par: los rayos quedan enfrentados y la rueda se ve pareja
  if(items.length % 2) items = items.slice(0, -1);
  var n = items.length;
  aro.textContent = '';
  items.forEach(function(it, k){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'rueda-reloj';
    b.style.setProperty('--a', (360 * k / n).toFixed(2) + 'deg');
    b.setAttribute('data-id', it.id);
    b.setAttribute('aria-label', 'Ver ' + it.nombre);
    it.lienzo = document.createElement('canvas');
    it.lienzo.setAttribute('aria-hidden', 'true');
    b.appendChild(it.lienzo);
    aro.appendChild(b);
  });
  _items = items;
  sec.hidden = false;
  pintarTodos();   // ya visible: se mide cada boton y se dibuja antes de que se pinte la pantalla
}
var _tRes = 0;
window.addEventListener('resize', function(){ clearTimeout(_tRes); _tRes = setTimeout(pintarTodos, 200); });
var _armada = false, _cerca = false;
// arma la rueda cuando ya llego el catalogo Y el cliente se acerca a la seccion (no descarga fotos de mas)
function armar(){
  if(_armada) return true;
  if(!relojes.length || !_cerca) return false;
  _armada = true;
  probar(candidatos()).then(dibujar);
  return true;
}
(function(){
  var sec = document.getElementById('rueda'); if(!sec) return;
  document.getElementById('rueda-aro').addEventListener('click', function(e){
    var b = e.target.closest('.rueda-reloj'); if(b) abrir(b.getAttribute('data-id'));
  });
  if('IntersectionObserver' in window){
    // fuera de la pantalla la rueda se detiene (no gasta bateria en el celular)
    new IntersectionObserver(function(es){ es.forEach(function(e){ sec.classList.toggle('quieta', !e.isIntersecting); }); }).observe(sec);
    // la seccion empieza oculta: se vigila Marcas (justo arriba) para saber cuando el cliente se acerca
    var guia = document.getElementById('marcas') || sec;
    var io = new IntersectionObserver(function(es){
      if(!es.some(function(e){ return e.isIntersecting; })) return;
      io.disconnect(); _cerca = true; armar();
    }, { rootMargin: '0px 0px 1500px 0px' });
    io.observe(guia);
  } else _cerca = true;
  // el catalogo llega por la red: se espera a que haya relojes
  var intentos = 0;
  (function esperar(){ if(relojes.length || ++intentos > 100){ armar(); return; } setTimeout(esperar, 300); })();
})();

export { armar as armarRueda };
