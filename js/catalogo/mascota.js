// =================== MASCOTA (asistente flotante) ===================
// Reemplaza al boton flotante de WhatsApp: un reloj con caja glaciar, esfera blanca y correa negra
// que flota en la esquina. Al tocarlo abre una mini ventana con opciones:
//   - Asesoria personalizada  -> WhatsApp con un mensaje listo
//   - ¿Buscas otro reloj?     -> abre el buscador
//   - ¿Que tamaño me queda?   -> guia de tamaños (con la medida del reloj abierto, si hay uno)
// Para agregar mas opciones basta con sumar un objeto a OPCIONES.
import { WHATSAPP_NUM } from './whatsapp.js';
import { buscadorAbierto, toggleBuscador } from './buscador.js';
import { vibrar } from './ui.js';

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

// Dibujo del reloj: correa negra con costuras, caja y asas glaciar, esfera blanca con indices y
// agujas en 10:10 (que hacen de cejas), guantes blancos y un moño negro para el toque formal.
const SVG = `
<svg class="masc-svg" viewBox="5 0 108 150" aria-hidden="true">
  <defs>
    <linearGradient id="masc-caja" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#C9DCE8"/><stop offset=".45" stop-color="#A7C4D6"/><stop offset="1" stop-color="#86A6BA"/>
    </linearGradient>
    <radialGradient id="masc-esfera" cx=".42" cy=".36" r=".75">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".8" stop-color="#F6F8FA"/><stop offset="1" stop-color="#E4EBF0"/>
    </radialGradient>
    <linearGradient id="masc-correa" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1c1c1f"/><stop offset=".5" stop-color="#2c2c30"/><stop offset="1" stop-color="#121214"/>
    </linearGradient>
  </defs>
  <!-- correa de arriba -->
  <path d="M44 34 L46 6 Q46 2 50 2 H70 Q74 2 74 6 L76 34 Z" fill="url(#masc-correa)" stroke="#09090b" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M49.5 31 L51 7 M70.5 31 L69 7" stroke="#6b6b70" stroke-width=".9" stroke-dasharray="2.2 2" fill="none"/>
  <!-- correa de abajo con pasador y agujeros -->
  <path d="M44 106 L46 136 Q46 140 50 140 H70 Q74 140 74 136 L76 106 Z" fill="url(#masc-correa)" stroke="#09090b" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M49.5 110 L51 135 M70.5 110 L69 135" stroke="#6b6b70" stroke-width=".9" stroke-dasharray="2.2 2" fill="none"/>
  <rect x="45.5" y="123" width="29" height="5" rx="1.5" fill="#1a1a1d" stroke="#09090b" stroke-width="1.2"/>
  <circle cx="60" cy="134" r="1.4" fill="#000"/>
  <!-- asas -->
  <path d="M40 40 L45 26 H52 L50 40 Z M80 40 L75 26 H68 L70 40 Z M40 100 L45 114 H52 L50 100 Z M80 100 L75 114 H68 L70 100 Z" fill="url(#masc-caja)" stroke="#18181b" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- corona -->
  <rect x="94" y="64" width="8" height="12" rx="2" fill="url(#masc-caja)" stroke="#18181b" stroke-width="1.5"/>
  <path d="M96.5 66v8M99.5 66v8" stroke="#5f8099" stroke-width=".8"/>
  <!-- brazo derecho (apoyado en la cintura) -->
  <path class="masc-brazo-der" d="M92 84 Q104 89 101 98" fill="none" stroke="#18181b" stroke-width="3.2" stroke-linecap="round"/>
  <g class="masc-guante-der">
    <path d="M95.6 101.5 Q94.4 107.6 98.4 110.2 Q102.4 112 104.8 108.4 Q106.6 104.6 105 100.6 Z" fill="#fff" stroke="#18181b" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M95.8 103.4 Q92.6 104 93.2 106.8 Q94.6 108.2 96.4 106.6" fill="#fff" stroke="#18181b" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M100 106.5v3M102.8 105.8v3" stroke="#18181b" stroke-width=".9" stroke-linecap="round"/>
    <rect x="95.6" y="97.8" width="9.6" height="3.8" rx="1.6" fill="#fff" stroke="#18181b" stroke-width="1.4"/>
  </g>
  <!-- caja -->
  <circle cx="60" cy="70" r="36" fill="url(#masc-caja)" stroke="#18181b" stroke-width="1.8"/>
  <circle cx="60" cy="70" r="31.5" fill="none" stroke="#7E9EB3" stroke-width="1"/>
  <path d="M33 56 A30 30 0 0 1 52 41" stroke="#E3EEF5" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9"/>
  <!-- esfera -->
  <circle cx="60" cy="70" r="29" fill="url(#masc-esfera)" stroke="#18181b" stroke-width="1.2"/>
  <g stroke="#18181b" stroke-linecap="round">
    <path d="M58.6 43.5v5M61.4 43.5v5" stroke-width="1.5"/>
    <path d="M86.5 70h-5M33.5 70h5M60 96.5v-2.6" stroke-width="1.5"/>
    <path d="M73.3 47l-1.6 2.8M83 56.8l-2.8 1.6M83 83.2l-2.8-1.6M73.3 93l-1.6-2.8M46.7 93l1.6-2.8M37 83.2l2.8-1.6M37 56.8l2.8 1.6M46.7 47l1.6 2.8" stroke-width="1.1"/>
  </g>
  <text x="60" y="91.2" text-anchor="middle" font-family="Jost,Arial,sans-serif" font-size="3.3" font-weight="600" letter-spacing=".6" fill="#18181b">APHILLIPS</text>
  <!-- agujas en 10:10, como en las fotos de catalogo -->
  <path d="M60 60.3 L45.6 53.4 L46.2 51.9 L60.8 58.6 Z" fill="#18181b"/>
  <path d="M59.4 60.1 L79.6 50.4 L80.2 51.7 L60.6 61.9 Z" fill="#18181b"/>
  <path d="M45.9 52.7 L49 54.2" stroke="#A7C4D6" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M79.9 51 L76.4 52.7" stroke="#A7C4D6" stroke-width="1.1" stroke-linecap="round"/>
  <circle cx="60" cy="60" r="2.1" fill="#18181b"/><circle cx="60" cy="60" r=".8" fill="#A7C4D6"/>
  <!-- ojos (parpadean) -->
  <g class="masc-ojos">
    <ellipse cx="51" cy="71" rx="3.3" ry="4.2" fill="#18181b"/><ellipse cx="69" cy="71" rx="3.3" ry="4.2" fill="#18181b"/>
    <circle cx="52.2" cy="69.4" r="1.2" fill="#fff"/><circle cx="70.2" cy="69.4" r="1.2" fill="#fff"/>
  </g>
  <!-- mejillas y sonrisa -->
  <ellipse cx="45" cy="77.5" rx="3.6" ry="2" fill="#A7C4D6" opacity=".55"/>
  <ellipse cx="75" cy="77.5" rx="3.6" ry="2" fill="#A7C4D6" opacity=".55"/>
  <path d="M54 80 Q60 85.6 66 80" fill="none" stroke="#18181b" stroke-width="1.7" stroke-linecap="round"/>
  <!-- moño -->
  <g class="masc-mono">
    <path d="M60 101 L50.5 96.5 Q48.5 101 50.5 105.5 Z M60 101 L69.5 96.5 Q71.5 101 69.5 105.5 Z" fill="#09090b" stroke="#09090b" stroke-width="1" stroke-linejoin="round"/>
    <rect x="57.6" y="98.6" width="4.8" height="4.8" rx="1.2" fill="#2a2a2e" stroke="#09090b" stroke-width=".8"/>
  </g>
  <!-- brazo izquierdo (saluda) -->
  <g class="masc-saludo">
    <path d="M28 82 Q16 80 16.4 66" fill="none" stroke="#18181b" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M11.2 62.4 Q9 55.2 12 50.8 Q15.6 47.6 19.2 50.6 Q21.8 54 20.4 60.4 Z" fill="#fff" stroke="#18181b" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M20.2 59.6 Q22.8 56.8 24.2 59 Q24.4 62.4 20.6 63.6" fill="#fff" stroke="#18181b" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M13.8 52.4v4.4M16.8 51.4v4.8" stroke="#18181b" stroke-width=".9" stroke-linecap="round"/>
    <rect x="11.4" y="62.2" width="9.8" height="3.8" rx="1.6" fill="#fff" stroke="#18181b" stroke-width="1.4"/>
  </g>
</svg>`;

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

function abrir(){
  if(_abierta) return;
  _abierta = true;
  ocultarBurbuja();
  _raiz.classList.add('abierta');
  _boton.setAttribute('aria-expanded', 'true');
  _panel.hidden = false;
  requestAnimationFrame(function(){ _panel.classList.add('on'); });
  var primera = _panel.querySelector('.masc-op');
  if(primera) setTimeout(function(){ primera.focus({ preventScroll: true }); }, 60);
}
function cerrarPanel(){
  if(!_abierta) return;
  _abierta = false;
  _raiz.classList.remove('abierta');
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
      '<div class="masc-cab"><div><b>¿En qué te ayudo?</b><span>Asesoría de Aphillips Store</span></div>' +
      '<button type="button" class="masc-x" aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="masc-ops">' + OPCIONES.map(function(o, i){
        return '<button type="button" class="masc-op" data-i="' + i + '"><span class="masc-op-ico"><svg viewBox="0 0 24 24">' + ICONOS[o.icono] + '</svg></span>' +
          '<span class="masc-op-txt"><b>' + o.titulo + '</b><small>' + o.texto + '</small></span>' +
          '<svg class="masc-op-flecha" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>';
      }).join('') + '</div>' +
    '</div>' +
    '<div class="masc-burbuja" aria-hidden="true">¿Te ayudo a elegir?</div>' +
    '<button type="button" class="masc-boton" aria-label="Asistente: ¿en qué te ayudo?" aria-expanded="false" aria-controls="masc-panel">' +
      '<span class="masc-flota">' + SVG + '</span><span class="masc-sombra"></span></button>';
  document.body.appendChild(_raiz);
  _panel = _raiz.querySelector('.masc-panel');
  _boton = _raiz.querySelector('.masc-boton');
  _burbuja = _raiz.querySelector('.masc-burbuja');

  _boton.addEventListener('click', function(){ vibrar(10); _abierta ? cerrarPanel() : abrir(); });
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

crear();

export { abrir as abrirMascota, cerrarPanel as cerrarMascota };
