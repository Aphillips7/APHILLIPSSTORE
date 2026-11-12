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
    b.appendChild(it.img);
    aro.appendChild(b);
  });
  sec.hidden = false;
}
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
