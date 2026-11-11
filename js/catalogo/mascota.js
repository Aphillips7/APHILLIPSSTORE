// =================== MASCOTA (asistente flotante) ===================
// Reemplaza al boton flotante de WhatsApp: un reloj 3D con caja glaciar, esfera blanca, correa negra,
// guantes y moño (poses en img/mascota/) que flota en la esquina. Al tocarlo abre una mini ventana con opciones:
//   - Asesoria personalizada  -> WhatsApp con un mensaje listo
//   - ¿Buscas otro reloj?     -> abre el buscador
//   - ¿Que tamaño me queda?   -> guia de tamaños (con la medida del reloj abierto, si hay uno)
// Para agregar mas opciones basta con sumar un objeto a OPCIONES.
import { WHATSAPP_NUM } from './whatsapp.js';
import { buscadorAbierto, toggleBuscador } from './buscador.js';
import { vibrar } from './ui.js';
import { sesion } from './sesion.js';
import { ofertaDe } from '../sitio/promos.js';

const ICONOS = {
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>',
  lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>',
  regla: '<rect x="2.5" y="8" width="19" height="8" rx="1"/><path d="M6.5 8v3M10.5 8v4M14.5 8v3M18.5 8v4"/>'
};

const OPCIONES = [
  { icono: 'chat', titulo: 'Asesoría personalizada', texto: 'Te ayudamos a elegir por WhatsApp', accion: asesoria },
  { icono: 'lupa', titulo: '¿Buscas otro reloj?', texto: 'Por marca, modelo o estilo', accion: buscar },
  { icono: 'regla', titulo: '¿Qué tamaño me queda?', texto: 'Ver la guía de tamaños', accion: guia }
];

// Poses 3D de la mascota (img/mascota/*.webp, 360x360 con fondo transparente, todas con el mismo encuadre).
// Se apilan y solo se ve la pose activa (clase .activa). La normal es 'recepcion' (manos juntas, agujas en
// 8:20 como bigote) o la de temporada; 'saludo' es la de entrada.
// POSES = imagenes que YA existen en img/mascota/. Poka-yoke: una pose pedida que aun no tiene imagen usa
// su RESPALDO (nunca se ve una imagen rota). Al subir una imagen nueva basta con sumarla a POSES.
const POSES = ['recepcion', 'saludo', 'pulgar', 'pensativo', 'sorpresa', 'enamorado', 'dormido', 'tapa',
  'lupa', 'senala', 'regla', 'paquete', 'celebra', 'triste', 'muneca', 'lee', 'noche',
  'navidad', 'madre', 'sanvalentin', 'padre'];
const RESPALDO = { lupa: 'pensativo', senala: 'pulgar', regla: 'pensativo', paquete: 'pulgar', celebra: 'saludo',
  triste: 'pensativo', muneca: 'saludo', lee: 'pensativo', noche: 'dormido',
  navidad: 'recepcion', madre: 'recepcion', sanvalentin: 'recepcion', padre: 'recepcion' };
function resolverPose(p){
  for(var i = 0; i < 3 && POSES.indexOf(p) < 0; i++) p = RESPALDO[p] || 'recepcion';
  return POSES.indexOf(p) >= 0 ? p : 'recepcion';
}
// temporada (Panama): la pose normal y el saludo cambian solos en estas fechas
function temporada(f){
  f = f || new Date();
  var m = f.getMonth() + 1, d = f.getDate();
  if(m === 12 && d <= 8) return 'madre';                 // Dia de la Madre: 8 de diciembre
  if(m === 12) return 'navidad';
  if(m === 2 && d >= 7 && d <= 14) return 'sanvalentin';
  if(m === 6){                                           // Dia del Padre: tercer domingo de junio (10 dias antes)
    var dom = 1 + (7 - new Date(f.getFullYear(), 5, 1).getDay()) % 7 + 14;
    if(d >= dom - 10 && d <= dom) return 'padre';
  }
  return '';
}
const FRASE_TEMPORADA = { madre: '¿Ya tienes el regalo de mamá?', navidad: '¿Buscas el regalo de Navidad perfecto?',
  sanvalentin: '¿Un regalo para San Valentín?', padre: '¿Ya tienes el regalo de papá?' };
const POSES_YA = ['recepcion', 'saludo', resolverPose(temporada())];   // se ven al abrir la pagina: se cargan de una vez
const DIBUJO = '<span class="masc-poses" aria-hidden="true">' + POSES.map(function(p){
  // las poses iniciales se cargan ya; las demas cuando la pagina termina de cargar (ver precargarPoses)
  return '<img class="masc-pose" data-p="' + p + '" alt="" width="360" height="360" decoding="async" draggable="false" ' +
    (POSES_YA.indexOf(p) >= 0 ? 'src' : 'data-src') + '="img/mascota/' + p + '.webp">';
}).join('') + '</span>';

// Que pose mostrar segun la cara y el gesto que pide el resto del codigo.
// Prioridad: contrasena (tapa; espia tambien usa tapa) > cara > gesto > pose normal (temporada o recepcion).
// Una cara que no esta en POSE_DE_CARA se usa como nombre de pose (lupa, paquete, celebra, triste...).
const POSE_DE_CARA = { feliz: 'saludo', guino: 'pulgar', emocionado: 'pulgar', timido: 'pulgar', arriba: 'pensativo' };
const POSE_DE_GESTO = { pulgar: 'pulgar', senala: 'senala', menton: 'pensativo', regla: 'regla' };
function poseActual(){
  var g = _raiz.dataset.gesto, c = _raiz.dataset.cara;
  if(g === 'tapa' || g === 'espia') return 'tapa';
  return resolverPose((c && (POSE_DE_CARA[c] || c)) || POSE_DE_GESTO[g] || temporada() || 'recepcion');
}
function actualizarPose(){
  var p = poseActual();
  if(_raiz.dataset.pose === p) return;
  _raiz.querySelectorAll('.masc-pose').forEach(function(img){
    var es = img.dataset.p === p;
    if(es && !img.getAttribute('src')) img.src = img.dataset.src;   // por si se pide antes de precargar
    img.classList.toggle('activa', es);
  });
  _raiz.dataset.pose = p;
}
function precargarPoses(){
  var cargar = function(){ _raiz.querySelectorAll('.masc-pose[data-src]').forEach(function(i){ if(!i.getAttribute('src')) i.src = i.dataset.src; }); };
  if(document.readyState === 'complete') setTimeout(cargar, 1200);
  else window.addEventListener('load', function(){ setTimeout(cargar, 1200); }, { once: true });
}

let _abierta = false;
let _raiz, _panel, _boton, _burbuja;

function asesoria(){
  var msg = '¡Hola! Quisiera una asesoría personalizada para elegir un reloj.';
  var nombre = document.querySelector('body.prod-abierto #modal-nombre');
  if(nombre && nombre.textContent.trim()) msg = '¡Hola! Quisiera asesoría sobre el ' + nombre.textContent.trim() + '.';
  window.open('https://wa.me/' + WHATSAPP_NUM + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
}
function buscar(){
  if(document.body.classList.contains('prod-abierto') && typeof window.cerrar === 'function') window.cerrar();
  if(!buscadorAbierto) toggleBuscador();
}
function guia(){
  var g = document.getElementById('modal-guia');
  var enReloj = document.body.classList.contains('prod-abierto') && g && !g.hidden;
  location.href = enReloj ? g.getAttribute('href') : 'guia-de-tamanos';
}

function abrir(porTeclado){
  if(_abierta) return;
  _abierta = true;
  ocultarBurbuja();
  _raiz.classList.add('abierta');
  // al hacer clic (y solo entonces) cambia de pose: pulgar arriba mientras la ventana esta abierta
  // (pasar el cursor por encima no la cambia); con la contrasena enfocada sigue tapandose los ojos
  clearTimeout(_tCara); clearTimeout(_tGesto);
  _raiz.classList.remove('durmiendo');
  if(_raiz.dataset.gesto !== 'tapa' && _raiz.dataset.gesto !== 'espia') delete _raiz.dataset.gesto;
  _raiz.dataset.cara = 'guino';
  _boton.setAttribute('aria-expanded', 'true');
  _panel.hidden = false;
  requestAnimationFrame(function(){ _panel.classList.add('on'); });
  // solo con teclado se lleva el foco a la primera opcion (con el dedo se veia un recuadro en "Asesoria")
  var primera = _panel.querySelector('.masc-op');
  if(porTeclado && primera) setTimeout(function(){ primera.focus({ preventScroll: true }); }, 60);
}
function cerrarPanel(){
  if(!_abierta) return;
  _abierta = false;
  _raiz.classList.remove('abierta');
  if(_raiz.dataset.cara === 'guino') delete _raiz.dataset.cara;   // vuelve a la pose normal
  _boton.setAttribute('aria-expanded', 'false');
  _panel.classList.remove('on');
  setTimeout(function(){ if(!_abierta) _panel.hidden = true; }, 220);
}
let _accionBurbuja = null;   // lo que hace tocar el globito (volver arriba, WhatsApp...), si tiene
function ocultarBurbuja(){ if(_burbuja){ _burbuja.classList.remove('on', 'con-accion'); _accionBurbuja = null; } }

function crear(){
  _raiz = document.createElement('div');
  _raiz.className = 'mascota';
  _raiz.innerHTML =
    '<div class="masc-panel" id="masc-panel" role="dialog" aria-label="¿En qué te ayudo?" hidden>' +
      '<div class="masc-cab"><div><b>¿En qué te ayudo?</b><span>Asesoría de APHILLIPS STORE</span></div>' +
      '<button type="button" class="masc-x" aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="masc-ops">' + OPCIONES.map(function(o, i){
        return '<button type="button" class="masc-op" data-i="' + i + '"><span class="masc-op-ico"><svg viewBox="0 0 24 24">' + ICONOS[o.icono] + '</svg></span>' +
          '<span class="masc-op-txt"><b>' + o.titulo + '</b><small>' + o.texto + '</small></span>' +
          '<svg class="masc-op-flecha" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>';
      }).join('') + '</div>' +
    '</div>' +
    '<div class="masc-burbuja" aria-hidden="true">¿Te ayudo a elegir?</div>' +
    '<button type="button" class="masc-boton" aria-label="Asistente: ¿en qué te ayudo?" aria-expanded="false" aria-controls="masc-panel">' +
      '<span class="masc-flota"><span class="masc-entra">' + DIBUJO + '</span></span><span class="masc-sombra"></span></button>';
  // entrada al abrir la pagina: empieza oculta y aparece con un saltito, saludando y sonriendo
  _raiz.classList.add('entra-inicial', 'saluda');
  _raiz.dataset.cara = 'feliz';
  setTimeout(function(){ _raiz.classList.remove('entra-inicial', 'saluda'); }, 2000);
  setTimeout(function(){ if(_raiz.dataset.cara === 'feliz') delete _raiz.dataset.cara; }, 3400);
  document.body.appendChild(_raiz);
  // cada vez que cambia la cara o el gesto se muestra la pose 3D que corresponde
  actualizarPose();
  new MutationObserver(actualizarPose).observe(_raiz, { attributes: true, attributeFilter: ['data-cara', 'data-gesto'] });
  precargarPoses();
  _panel = _raiz.querySelector('.masc-panel');
  _boton = _raiz.querySelector('.masc-boton');
  _burbuja = _raiz.querySelector('.masc-burbuja');

  _boton.addEventListener('click', function(e){ vibrar(10); _abierta ? cerrarPanel() : abrir(e.detail === 0); });
  _raiz.querySelector('.masc-x').addEventListener('click', cerrarPanel);
  _panel.addEventListener('click', function(e){
    var b = e.target.closest('.masc-op'); if(!b) return;
    var op = OPCIONES[+b.dataset.i];
    cerrarPanel();
    op.accion();
  });
  document.addEventListener('click', function(e){ if(_abierta && !_raiz.contains(e.target)) cerrarPanel(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && _abierta){ cerrarPanel(); _boton.focus(); } });

  // tocar el globito hace su accion (si tiene): volver arriba, escribir por WhatsApp...
  _burbuja.addEventListener('click', function(){ var a = _accionBurbuja; ocultarBurbuja(); if(a) a(); });

  saludoInicial();
}

// Saludo la primera vez en la sesion (unos segundos despues de entrar), segun el caso:
//   volvio tras 3 dias o mas -> mira su "muneca": "¡Cuanto tiempo! Mira lo nuevo"
//   temporada (Navidad, Dia de la Madre, San Valentin, Dia del Padre) -> la frase de la fecha
//   primera visita del dia -> buenos dias / buenas tardes / buenas noches (de noche: "¿Desvelado?")
//   si no -> "¿Te ayudo a elegir?"
function saludoInicial(){
  var visto = false, ultima = 0, ahora = Date.now();
  try{ visto = sessionStorage.getItem('ap_masc_hola') === '1'; sessionStorage.setItem('ap_masc_hola', '1'); }catch(e){}
  try{ ultima = +localStorage.getItem('ap_masc_ultima') || 0; localStorage.setItem('ap_masc_ultima', String(ahora)); }catch(e){}
  if(visto) return;
  var h = new Date().getHours(), temp = temporada();
  var otroDia = !ultima || new Date(ultima).toDateString() !== new Date(ahora).toDateString();
  var texto = '¿Te ayudo a elegir?', cara = '';
  if(ultima && ahora - ultima >= 3 * 864e5){ texto = '¡Cuánto tiempo! Mira lo nuevo'; cara = 'muneca'; }
  else if(temp){ texto = FRASE_TEMPORADA[temp]; }
  else if(otroDia){
    if(h >= 22 || h < 6){ texto = '¡Buenas noches! ¿Desvelado? Yo también'; cara = POSES.indexOf('noche') >= 0 ? 'noche' : ''; }   // sin su imagen de pijama se veria dormido
    else texto = (h < 12 ? '¡Buenos días!' : h < 19 ? '¡Buenas tardes!' : '¡Buenas noches!') + ' ¿Te ayudo a elegir?';
  }
  setTimeout(function(){
    if(_abierta) return;
    if(cara) gesto(cara, '', 3600);
    decir(texto, 6400, true);
  }, 2600);
}

// ---------- gestos al cambiar de seccion ----------
// Cada vez que el cliente pasa a otra seccion (portada, un listado, una marca) o abre un reloj, la
// mascota vuelve a entrar con un saltito (o un giro al abrir un reloj) y pone una cara por unos segundos.
let _clave = '', _tCara = 0, _tRev = 0;
function claveVista(){
  var b = document.body;
  if(b.classList.contains('prod-abierto')){ var n = document.getElementById('modal-nombre'); return 'reloj:' + (n ? n.textContent : ''); }
  if(b.classList.contains('vista-catalogo')){ var t = document.getElementById('cat-titulo'); return 'cat:' + (t ? t.textContent : ''); }
  return 'inicio';
}
function reaccionar(entrada, cara, saluda){
  if(_abierta) return;
  var e = _raiz.querySelector('.masc-entra');
  _raiz.classList.remove('entra-salto', 'entra-giro', 'saluda');
  void e.offsetWidth;   // reinicia la animacion aunque sea la misma
  _raiz.classList.add('entra-' + entrada);
  if(saluda) _raiz.classList.add('saluda');
  _raiz.classList.remove('durmiendo');
  _raiz.dataset.cara = cara;
  delete _raiz.dataset.gesto;
  clearTimeout(_tCara); clearTimeout(_tRev);
  _tCara = setTimeout(function(){ delete _raiz.dataset.cara; }, 2600);
  _tRev = setTimeout(function(){ _raiz.classList.remove('entra-salto', 'entra-giro', 'saluda'); }, 1400);
}
function revisarVista(){
  var c = claveVista();
  if(c === _clave) return;
  var antes = _clave; _clave = c;
  if(!antes) return;                                        // primera lectura al cargar
  if(c.indexOf('reloj:') === 0) reaccionar('giro', 'sorpresa', false);
  else if(antes.indexOf('reloj:') === 0) reaccionar('salto', 'guino', false);   // vuelve de un reloj
  else if(c === 'inicio') reaccionar('salto', 'feliz', true);
  else reaccionar('salto', 'guino', false);   // listados y marcas: pulgar arriba (feliz = saludo no se notaba)
}
function vigilarVistas(){
  var t = 0;
  var programar = function(){ clearTimeout(t); t = setTimeout(revisarVista, 150); };
  new MutationObserver(programar).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  var tit = document.getElementById('cat-titulo');
  if(tit) new MutationObserver(programar).observe(tit, { childList: true, characterData: true, subtree: true });
  document.addEventListener('reloj-abierto', programar);
  _clave = claveVista();

}

// ---------- personalidad: frases, gestos y siesta ----------
// Caras y gestos se traducen a una pose 3D en POSE_DE_CARA / POSE_DE_GESTO. La pose solo cambia por
// lo que hace el cliente (clic, seccion, favorito, buscador, contrasena...), nunca al pasar el cursor. Frases cortas en el globito, sin repetirse seguido (una cada ~8 s como mucho).
let _tGesto = 0, _ultimaFrase = 0, _tFrase = 0;
function gesto(cara, g, ms){
  if(_abierta || _raiz.classList.contains('durmiendo') && cara !== 'sorpresa') return;
  if(_raiz.dataset.gesto === 'tapa' || _raiz.dataset.gesto === 'espia') return;
  _raiz.dataset.cara = cara;
  if(g) _raiz.dataset.gesto = g; else delete _raiz.dataset.gesto;
  clearTimeout(_tCara); clearTimeout(_tGesto);
  _tCara = setTimeout(function(){ delete _raiz.dataset.cara; }, ms || 2600);
  _tGesto = setTimeout(function(){ delete _raiz.dataset.gesto; }, ms || 2600);
}
function decir(texto, ms, forzar, accion){
  if(_abierta || !_burbuja) return;
  var ahora = Date.now();
  if(!forzar && ahora - _ultimaFrase < 8000) return;
  _ultimaFrase = ahora;
  _burbuja.textContent = texto;
  _accionBurbuja = accion || null;
  _burbuja.classList.toggle('con-accion', !!accion);
  _burbuja.classList.remove('on'); void _burbuja.offsetWidth;   // reinicia el rebote si ya estaba visible
  _burbuja.classList.add('on');
  clearTimeout(_tFrase);
  _tFrase = setTimeout(ocultarBurbuja, ms || 3200);
}
function alAzar(lista){ return lista[Math.floor(Math.random() * lista.length)]; }
function personalidad(){
  // reloj abierto: si tiene oferta lo dice siempre (sorprendido); si no, a veces comenta:
  // "¿Es para regalo?" (pensativo), "¿Te ayudo con la talla?" (con la regla) u otra frase (senalando)
  document.addEventListener('reloj-abierto', function(e){
    var r = e.detail || {};
    var oferta = false; try{ oferta = !!ofertaDe(r); }catch(err){}
    setTimeout(function(){
      if(oferta){ gesto('sorpresa', '', 3000); decir('¡Este tiene precio especial!', 3600, true); return; }
      var azar = Math.random();
      if(azar < .2 && (r.genero === 'hombre' || r.genero === 'mujer')){ gesto('pensativo', 'menton', 3000); decir('¿Es para regalo?', 3200); }
      else if(azar < .4){ gesto('regla', 'regla', 3200); decir('¿Te ayudo con la talla?', 3400); }
      else if(azar < .7){ gesto('emocionado', 'senala', 2800); decir(alAzar(['¡Qué buena elección!', 'Este es de mis favoritos', '¡Mira qué detalles!'])); }
    }, 1100);
  });
  // favorito agregado: emocionado con el pulgar arriba
  var nFav = -1;
  import('./favoritos.js').then(function(F){
    nFav = F._favoritos.size;
    F.alCambiarFavoritos(function(){
      var n = F._favoritos.size;
      if(n > nFav){ gesto('enamorado', 'pulgar', 2800); decir(alAzar(['¡Me encanta! Guardado en favoritos', '¡Excelente gusto!', '¡Ese es un flechazo!']), 2800, true); }
      else if(n < nFav && nFav > 0){ gesto('triste', '', 2600); decir('Ay… ¿no era el indicado?', 2800, true); }
      nFav = n;
    });
  });
  // buscador abierto: pensativo con la mano en la barbilla
  var hd = document.getElementById('site-header');
  if(hd){
    var abierto = false;
    new MutationObserver(function(){
      var ahora = hd.classList.contains('search-open');
      _raiz.classList.toggle('sobre-buscador', ahora);   // el buscador esta en la capa del encabezado (150): la mascota sube encima
      if(ahora && !abierto){ gesto('pensativo', 'menton', 3200); decir('¿Qué estilo buscas?', 3000); }
      abierto = ahora;
    }).observe(hd, { attributes: true, attributeFilter: ['class'] });
  }
  // "Comprar por WhatsApp": con su paquete, recuerda que se envia a todo Panama
  var wa = document.getElementById('modal-wa');
  if(wa) wa.addEventListener('click', function(){ gesto('paquete', 'pulgar', 3000); decir('¡Te lo enviamos a todo Panamá!', 3200, true); });
  // tic, tac: si el cliente lleva rato mirando un reloj, se pone pensativo, se balancea y lo comenta
  var tTic = 0, idTic = '', vecesTic = 0;
  var FRASES_TIC = ['Tic, tac… este reloj te está esperando', 'Tic-tac, tic-tac… ¿te lo llevas?', 'El tiempo vuela… y este reloj también', 'Tic, tac… ¿te ayudo a decidir?'];
  var tictac = function(){
    if(_abierta || _raiz.classList.contains('durmiendo') || _raiz.dataset.gesto === 'tapa') return;
    clearTimeout(_tCara); clearTimeout(_tGesto); delete _raiz.dataset.gesto;
    _raiz.dataset.cara = 'arriba';
    var e = _raiz.querySelector('.masc-entra'); _raiz.classList.remove('tictac'); void e.offsetWidth;
    _raiz.classList.add('tictac');
    decir(alAzar(FRASES_TIC), 4600, true);
    setTimeout(function(){ _raiz.classList.remove('tictac'); if(_raiz.dataset.cara === 'arriba') delete _raiz.dataset.cara; }, 5000);
  };
  var programarTic = function(espera){
    clearTimeout(tTic);
    tTic = setTimeout(function(){
      var n = document.getElementById('modal-nombre');
      if(!document.body.classList.contains('prod-abierto') || !n || n.textContent !== idTic) return;
      tictac();
      if(++vecesTic < 2) programarTic(40000);
    }, espera);
  };
  document.addEventListener('reloj-abierto', function(){
    setTimeout(function(){ var n = document.getElementById('modal-nombre'); idTic = n ? n.textContent : ''; vecesTic = 0; programarTic(18000); }, 200);
  });
  // al iniciar sesion la saluda por su nombre (una vez por visita)
  var saludado = false;
  document.addEventListener('sesion-cambiada', function(){
    if(!sesion.activa || saludado || !sesion.perfil) return;
    saludado = true;
    reaccionar('salto', 'feliz', true);
    var nombre = String(sesion.perfil.nombre || '').split(' ')[0];
    decir(nombre ? '¡Hola, ' + nombre + '! Qué bueno verte' : '¡Hola! Qué bueno verte', 3200, true);
  });
  // siesta: sin actividad un rato se duerme (de noche, antes); al volver despierta sorprendido
  var tSiesta = 0;
  var despertar = function(){
    clearTimeout(tSiesta);
    if(_raiz.classList.contains('durmiendo')){ _raiz.classList.remove('durmiendo'); delete _raiz.dataset.cara; gesto('sorpresa', '', 1200); }
    tSiesta = setTimeout(function(){
      if(_abierta || document.hidden) return;
      if(document.body.classList.contains('prod-abierto')){ despertar(); return; }   // mirando un reloj no se duerme (hace tic-tac)
      clearTimeout(_tCara); clearTimeout(_tGesto); delete _raiz.dataset.gesto;
      var deNoche = new Date().getHours() >= 22 || new Date().getHours() < 6;   // de noche duerme con pijama y gorro
      _raiz.classList.add('durmiendo'); _raiz.dataset.cara = deNoche ? 'noche' : 'dormido'; ocultarBurbuja();
    }, (new Date().getHours() >= 22 || new Date().getHours() < 6) ? 25000 : 45000);
  };
  ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function(ev){ window.addEventListener(ev, despertar, { passive: true }); });
  despertar();

  // filtrar u ordenar: pensativo
  ['modal-filtros', 'modal-orden'].forEach(function(id){
    var m = document.getElementById(id); if(!m) return;
    var abierto = false;
    new MutationObserver(function(){
      var ahora = m.classList.contains('open');
      if(ahora && !abierto){ gesto('pensativo', 'menton', 3000); decir('¿Buscas algo en particular?', 3000); }
      abierto = ahora;
    }).observe(m, { attributes: true, attributeFilter: ['class'] });
  });
  // busqueda sin resultados (avisa buscador.js): con la lupa, y tocar el globito abre WhatsApp con lo que busco
  var tVacia = 0;
  document.addEventListener('busqueda-vacia', function(e){
    clearTimeout(tVacia);
    var q = String(e.detail || '').trim();
    tVacia = setTimeout(function(){   // espera a que termine de escribir
      if(!q) return;
      gesto('lupa', '', 4600);
      decir('No lo encontré… ¿lo buscamos juntos por WhatsApp?', 5600, true, function(){
        window.open('https://wa.me/' + WHATSAPP_NUM + '?text=' + encodeURIComponent('¡Hola! Estoy buscando un reloj: ' + q), '_blank', 'noopener');
      });
    }, 1100);
  });
  document.addEventListener('busqueda-con-resultados', function(){ clearTimeout(tVacia); if(_raiz.dataset.cara === 'lupa'){ delete _raiz.dataset.cara; ocultarBurbuja(); } });
  // cuenta nueva (avisa cuenta.js): celebra
  document.addEventListener('cuenta-creada', function(){ reaccionar('salto', 'celebra', true); decir('¡Bienvenido a APHILLIPS STORE!', 4000, true); });
  // enlace de un reloj copiado (avisa modal.js): pulgar
  document.addEventListener('enlace-compartido', function(){ gesto('guino', 'pulgar', 2600); decir('¡Compártelo con quien quieras!', 3000, true); });
  // listado largo: tras bajar unas pantallas senala hacia arriba; tocar el globito vuelve arriba (una vez por listado)
  var listadoAvisado = '', cargada = Date.now();
  window.addEventListener('scroll', function(){
    var b = document.body;
    if(Date.now() - cargada < 3000) return;   // al cargar el navegador puede devolver la pagina abajo: eso no es bajar
    if(!b.classList.contains('vista-catalogo') || b.classList.contains('prod-abierto') || _abierta) return;
    if(window.scrollY < window.innerHeight * 3 || listadoAvisado === _clave) return;
    listadoAvisado = _clave;
    gesto('senala', 'senala', 3600);
    decir('¿Volvemos arriba?', 4400, true, function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }, { passive: true });
  // consejos de relojes: pocos (2 por visita como mucho), solo si lleva rato tranquilo, leyendo su papelito
  var CONSEJOS = ['¿Sabías que el automático se carga con el movimiento de tu muñeca?', 'Tip: un reloj de 40 a 42 mm le queda bien a casi todas las muñecas',
    'El cristal de zafiro es casi imposible de rayar', '¿Sabías que 100 m de resistencia sirven para nadar, no para bucear?',
    'Tip: la correa de cuero se cuida lejos del agua y del perfume', 'Un cronógrafo es un reloj con cronómetro incorporado'];
  var inicio = Date.now(), consejosDichos = 0;
  try{ consejosDichos = +sessionStorage.getItem('ap_masc_consejos') || 0; }catch(e){}
  setInterval(function(){
    if(consejosDichos >= 2 || document.hidden || _abierta || _raiz.classList.contains('durmiendo')) return;
    if(_raiz.dataset.cara || _raiz.dataset.gesto || Date.now() - inicio < 75000 || Date.now() - _ultimaFrase < 90000) return;
    consejosDichos++;
    try{ sessionStorage.setItem('ap_masc_consejos', String(consejosDichos)); }catch(e){}
    gesto('lee', '', 6000);
    decir(alAzar(CONSEJOS), 6400, true);
  }, 20000);
}

// ---------- contrasenas: se tapa los ojos (y espia si el cliente la muestra) ----------
function vigilarClaves(){
  // con "Mi cuenta" abierta la mascota queda visible encima del panel
  var pc = document.getElementById('panel-cuenta');
  // y al abrirlo saluda con la mano (pose de saludo con saltito)
  var cuentaAbierta = false;
  if(pc) new MutationObserver(function(){
    var ahora = pc.classList.contains('open');
    _raiz.classList.toggle('sobre-cuenta', ahora);
    if(ahora && !cuentaAbierta && _raiz.dataset.gesto !== 'tapa') reaccionar('salto', 'feliz', true);
    cuentaAbierta = ahora;
  }).observe(pc, { attributes: true, attributeFilter: ['class'] });
  // campo de contrasena o su boton de ojo (al tocar el ojo sigue tapada)
  var esClave = function(el){ return !!el && ((el.dataset && el.dataset.clave === '1') || (el.classList && el.classList.contains('cta-ver-clave'))); };
  var aplicar = function(el){
    if(esClave(el)){
      clearTimeout(_tGesto); clearTimeout(_tCara); delete _raiz.dataset.cara; ocultarBurbuja();
      _raiz.dataset.gesto = 'tapa';
    }else if(_raiz.dataset.gesto === 'tapa' || _raiz.dataset.gesto === 'espia'){
      delete _raiz.dataset.gesto;
    }
  };
  document.addEventListener('focusin', function(e){ aplicar(e.target); });
  // en el celular tocar el ojo quita el foco un instante: ese toque no cuenta como "tocar otra cosa"
  var tocoOjo = 0;
  document.addEventListener('pointerdown', function(e){ if(e.target.closest && e.target.closest('.cta-ver-clave')) tocoOjo = Date.now(); }, true);
  document.addEventListener('focusout', function(){ setTimeout(function(){ if(Date.now() - tocoOjo < 600) return; aplicar(document.activeElement); }, 60); });
  document.addEventListener('clave-visible', function(e){ aplicar(e.detail.campo); });
}

crear();
vigilarVistas();
personalidad();
vigilarClaves();

export { abrir as abrirMascota, cerrarPanel as cerrarMascota };

// Rendimiento: pausa las animaciones de la mascota mientras se desliza la pagina
(function(){
  var t = null;
  window.addEventListener('scroll', function(){
    var m = document.querySelector('.mascota'); if(!m) return;
    if(!m.classList.contains('deslizando')) m.classList.add('deslizando');
    clearTimeout(t); t = setTimeout(function(){ m.classList.remove('deslizando'); }, 180);
  }, { passive: true });
})();
