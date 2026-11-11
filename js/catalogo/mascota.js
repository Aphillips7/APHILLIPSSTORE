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
// Se apilan y solo se ve la pose activa (data-pose en .mascota). La normal es 'recepcion' (manos juntas,
// agujas en 8:20 como bigote); 'saludo' es la de entrada.
const POSES = ['recepcion', 'saludo', 'pulgar', 'pensativo', 'sorpresa', 'enamorado', 'dormido', 'tapa'];
const POSES_YA = ['recepcion', 'saludo'];   // se ven al abrir la pagina: se cargan de una vez
const DIBUJO = '<span class="masc-poses" aria-hidden="true">' + POSES.map(function(p){
  // la pose inicial se carga ya; las demas cuando la pagina termina de cargar (ver precargarPoses)
  return '<img class="masc-pose" data-p="' + p + '" alt="" width="360" height="360" decoding="async" draggable="false" ' +
    (POSES_YA.indexOf(p) >= 0 ? 'src' : 'data-src') + '="img/mascota/' + p + '.webp">';
}).join('') + '</span>';

// Que pose mostrar segun la cara y el gesto que pide el resto del codigo.
// Prioridad: contrasena (tapa; espia tambien usa tapa) > cara > gesto > recepcion.
const POSE_DE_CARA = { feliz: 'saludo', guino: 'pulgar', emocionado: 'pulgar', timido: 'pulgar', sorpresa: 'sorpresa',
  pensativo: 'pensativo', arriba: 'pensativo', enamorado: 'enamorado', dormido: 'dormido' };
const POSE_DE_GESTO = { pulgar: 'pulgar', senala: 'pulgar', menton: 'pensativo' };
function poseActual(){
  var g = _raiz.dataset.gesto, c = _raiz.dataset.cara;
  if(g === 'tapa' || g === 'espia') return 'tapa';
  return POSE_DE_CARA[c] || POSE_DE_GESTO[g] || 'recepcion';
}
function actualizarPose(){
  var p = poseActual();
  if(_raiz.dataset.pose === p) return;
  var img = _raiz.querySelector('.masc-pose[data-p="' + p + '"]');
  if(img && !img.getAttribute('src')) img.src = img.dataset.src;   // por si se pide antes de precargar
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
function ocultarBurbuja(){ if(_burbuja) _burbuja.classList.remove('on'); }

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

  // saludo la primera vez en la sesion: "¿Te ayudo a elegir?" unos segundos
  var visto = false;
  try{ visto = sessionStorage.getItem('ap_masc_hola') === '1'; sessionStorage.setItem('ap_masc_hola', '1'); }catch(e){}
  if(!visto){
    setTimeout(function(){ if(!_abierta) _burbuja.classList.add('on'); }, 2600);
    setTimeout(ocultarBurbuja, 9000);
  }
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
  if(_abierta || _raiz.dataset.cara === 'dormido' && cara !== 'sorpresa') return;
  if(_raiz.dataset.gesto === 'tapa' || _raiz.dataset.gesto === 'espia') return;
  _raiz.dataset.cara = cara;
  if(g) _raiz.dataset.gesto = g; else delete _raiz.dataset.gesto;
  clearTimeout(_tCara); clearTimeout(_tGesto);
  _tCara = setTimeout(function(){ delete _raiz.dataset.cara; }, ms || 2600);
  _tGesto = setTimeout(function(){ delete _raiz.dataset.gesto; }, ms || 2600);
}
function decir(texto, ms, forzar){
  if(_abierta || !_burbuja) return;
  var ahora = Date.now();
  if(!forzar && ahora - _ultimaFrase < 8000) return;
  _ultimaFrase = ahora;
  _burbuja.textContent = texto;
  _burbuja.classList.add('on');
  clearTimeout(_tFrase);
  _tFrase = setTimeout(ocultarBurbuja, ms || 3200);
}
function alAzar(lista){ return lista[Math.floor(Math.random() * lista.length)]; }
function personalidad(){
  // reloj abierto: a veces comenta, senalando
  document.addEventListener('reloj-abierto', function(){
    if(Math.random() < .6) setTimeout(function(){
      gesto('emocionado', 'senala', 2800);
      decir(alAzar(['¡Qué buena elección!', 'Este es de mis favoritos', '¿Te ayudo con la talla?', '¡Mira qué detalles!']));
    }, 1100);
  });
  // favorito agregado: emocionado con el pulgar arriba
  var nFav = -1;
  import('./favoritos.js').then(function(F){
    nFav = F._favoritos.size;
    F.alCambiarFavoritos(function(){
      var n = F._favoritos.size;
      if(n > nFav){ gesto('enamorado', 'pulgar', 2800); decir(alAzar(['¡Me encanta! Guardado en favoritos', '¡Excelente gusto!', '¡Ese es un flechazo!']), 2800, true); }
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
  // "Comprar por WhatsApp": guino y pulgar arriba
  var wa = document.getElementById('modal-wa');
  if(wa) wa.addEventListener('click', function(){ gesto('guino', 'pulgar', 2600); decir('¡Te esperamos en WhatsApp!', 2600, true); });
  // tic, tac: si el cliente lleva rato mirando un reloj, se pone pensativo, se balancea y lo comenta
  var tTic = 0, idTic = '', vecesTic = 0;
  var FRASES_TIC = ['Tic, tac… este reloj te está esperando', 'Tic-tac, tic-tac… ¿te lo llevas?', 'El tiempo vuela… y este reloj también', 'Tic, tac… ¿te ayudo a decidir?'];
  var tictac = function(){
    if(_abierta || _raiz.dataset.cara === 'dormido' || _raiz.dataset.gesto === 'tapa') return;
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
    if(_raiz.dataset.cara === 'dormido'){ _raiz.classList.remove('durmiendo'); delete _raiz.dataset.cara; gesto('sorpresa', '', 1200); }
    tSiesta = setTimeout(function(){
      if(_abierta || document.hidden) return;
      if(document.body.classList.contains('prod-abierto')){ despertar(); return; }   // mirando un reloj no se duerme (hace tic-tac)
      clearTimeout(_tCara); clearTimeout(_tGesto); delete _raiz.dataset.gesto;
      _raiz.dataset.cara = 'dormido'; _raiz.classList.add('durmiendo'); ocultarBurbuja();
    }, (new Date().getHours() >= 22 || new Date().getHours() < 6) ? 25000 : 45000);
  };
  ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function(ev){ window.addEventListener(ev, despertar, { passive: true }); });
  despertar();
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
