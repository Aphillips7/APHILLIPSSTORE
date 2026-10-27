// =================== TIENDA (editor de la tienda) ===================
// Fase 1 Diseno: colores, botones, esquinas de las fotos y tamano de los titulos.
// Fase 2 Portada: orden y visibilidad de las secciones, textos, relojes de "Mas vendidos" y a que reloj lleva
//   cada boton de "El futuro en tu muneca".
// Todo es un solo "sitio" { tema, portada } con vista previa en vivo (la tienda real dentro de un marco, en
// celular o computadora), un solo boton Publicar, historial y deshacer.
// POKA-YOKE:
// - Nada cambia en la tienda hasta tocar "Publicar" (y se confirma). El borrador se guarda en este dispositivo.
// - Si un texto no se leeria sobre su fondo, se marca en rojo y "Publicar" queda desactivado (el servidor
//   tambien lo rechaza). Los textos tienen largo maximo y no aceptan HTML.
// - Deshacer paso a paso, descartar, volver a cualquier version anterior (historial) y restaurar el original.
import { firebase } from '../../firebase.js';
import { COLORES, TEMA_BASE, TEMAS_LISTOS, problemasTema, validarTema } from '../../sitio/tema.js';
import { ENLACES, MAX_DESTACADOS, SECCIONES, TEXTOS, validarPortada } from '../../sitio/portada.js';
import { esPublicable } from '../../products.js';
import { esc } from '../componentes.js';
import { state } from '../state.js';

const API = 'https://api.aphillipsstore.com';
const CLAVE_BORRADOR = 'aph_editor_sitio';
// la tienda vive en / (en el servidor local de pruebas, en /catalogo.html)
const TIENDA = /^(localhost|127\.)/.test(location.hostname) ? '/catalogo.html' : '/';
const CAMPOS = {
  acento: ['Color de acento (glaciar)', 'Etiquetas, flechas, detalles y botones claros. El texto encima va en negro.'],
  barraFondo: ['Barra de arriba: fondo', 'La franja "Envíos a todo Panamá".'],
  barraTexto: ['Barra de arriba: letras', ''],
  botonFondo: ['Botones principales: fondo', 'Comprar por WhatsApp, Cotizar y Comprar ahora.'],
  botonTexto: ['Botones principales: letras', ''],
  oscuro: ['Secciones oscuras', '"Encuentra tu próximo reloj" y el reloj de Panamá. El texto encima va en blanco.'],
  carrusel: ['Fondo del carrusel "Más vendidos"', 'Color de arriba del degradado (abajo termina en blanco).']
};
const FORMAS_TXT = [['original', 'Como están'], ['recta', 'Rectos'], ['suave', 'Suaves'], ['pildora', 'Píldora']];

var _publicado = null, _meta = { version: 0, fecha: 0 }, _historial = [], _temas = [], _borrador = null, _pila = [];
var _error = '', _cargado = false, _dispositivo = 'celular', _publicando = false, _nota = '', _vista = 'diseno';
var _originales = null;   // textos de la tienda tal como estan (para mostrarlos de ejemplo)

function el(id){ return document.getElementById(id); }
function validarSitio(s){ s = s || {}; return { tema: validarTema(s.tema), portada: validarPortada(s.portada) }; }
function iguales(a, b){ return JSON.stringify(validarSitio(a)) === JSON.stringify(validarSitio(b)); }
function leerBorrador(){ try{ var t = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) || 'null'); return t ? validarSitio(t) : null; }catch(e){ return null; } }
function guardarBorrador(){ try{ localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(_borrador)); }catch(e){} }
async function pedir(ruta, cuerpo){
  var u = firebase.auth().currentUser;
  if(!u) throw new Error('sin sesion');
  var op = { headers: { 'Authorization': 'Bearer ' + await u.getIdToken() } };
  if(cuerpo){ op.method = 'POST'; op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(cuerpo); }
  var r = await fetch(API + ruta, op);
  var d = {}; try{ d = await r.json(); }catch(e){}
  if(!r.ok) throw new Error(d.error || ('Error ' + r.status));
  return d;
}

async function cargar(){
  try{
    var a = await pedir('/admin/sitio'), b = await pedir('/admin/sitio/temas');
    _publicado = validarSitio(a.publicado); _meta = { version: a.publicado.version || 0, fecha: a.publicado.fecha || 0 };
    _historial = a.historial || []; _temas = b.temas || []; _error = '';
  }catch(e){ _error = e.message; if(!_publicado) _publicado = validarSitio({}); }
  if(!_borrador){
    // borrador de la fase 1 (solo diseno): se conserva
    var viejo = null; try{ viejo = JSON.parse(localStorage.getItem('aph_editor_borrador') || 'null'); localStorage.removeItem('aph_editor_borrador'); }catch(e){}
    _borrador = leerBorrador() || (viejo ? validarSitio({ tema: viejo, portada: _publicado.portada }) : validarSitio(_publicado));
  }
  _cargado = true;
  pintar(); enviarVista();
  cargarOriginales();
}
// textos originales de la tienda (para mostrar de ejemplo en cada campo)
function cargarOriginales(){
  if(_originales) return;
  fetch(TIENDA, { cache: 'no-cache' }).then(function(r){ return r.text(); }).then(function(html){
    var d = new DOMParser().parseFromString(html, 'text/html'), o = {};
    Object.keys(TEXTOS).forEach(function(k){
      var e = d.querySelector(TEXTOS[k][0]); if(!e) return;
      var t = e.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**').replace(/<[^>]+>/g, '');
      var x = document.createElement('textarea'); x.innerHTML = t; o[k] = x.value.replace(/[ \t]+/g, ' ').trim();
    });
    _originales = o; if(_vista === 'portada') pintar();
  }).catch(function(){ _originales = {}; });
}

// ---------- cambios ----------
// vivo = true mientras se arrastra o se escribe: solo se actualizan la vista previa y la barra de abajo
// (redibujar todo cerraria el selector de color o quitaria el cursor). Al soltar se guarda un paso para Deshacer.
var _antesDeVivo = null;
function aplicarCambio(nuevo, vivo){
  nuevo = validarSitio(nuevo);
  if(vivo){
    if(!_antesDeVivo) _antesDeVivo = _borrador;
    _borrador = nuevo; guardarBorrador(); enviarVista(); pintarBarra();
    return;
  }
  var antes = _antesDeVivo || _borrador; _antesDeVivo = null;
  if(iguales(nuevo, antes)){ _borrador = nuevo; pintar(); return; }
  _pila.push(antes); if(_pila.length > 60) _pila.shift();
  _borrador = nuevo; guardarBorrador(); pintar(); enviarVista();
}
function copia(){ return JSON.parse(JSON.stringify(_borrador)); }
function cambiarTema(campo, valor, vivo){
  var s = copia(); s.tema[campo] = valor;
  if(vivo){ var et = document.querySelector('[data-valor="' + campo + '"]'); if(et) et.textContent = campo === 'escalaTitulos' ? valor + ' %' : valor + ' px'; }
  aplicarCambio(s, vivo);
}
function usarTema(t){ var s = copia(); s.tema = validarTema(t); aplicarCambio(s); }
function deshacerTema(){ if(!_pila.length) return; _borrador = _pila.pop(); guardarBorrador(); pintar(); enviarVista(); }
function descartarTema(){
  if(iguales(_borrador, _publicado)) return;
  if(!confirm('¿Descartar los cambios sin publicar y volver a lo que se ve hoy en la tienda?')) return;
  aplicarCambio(validarSitio(_publicado));
}
function restaurarOriginal(){
  var parte = _vista === 'portada' ? 'portada' : 'tema';
  var original = parte === 'tema' ? validarTema(TEMA_BASE) : validarPortada({});
  if(JSON.stringify(_borrador[parte]) === JSON.stringify(original)) return;
  if(!confirm(parte === 'tema' ? '¿Volver al diseño original de la tienda (glaciar)? Puedes deshacerlo antes de publicar.' :
    '¿Volver la portada a como venía (orden, textos y relojes originales)? Puedes deshacerlo antes de publicar.')) return;
  var s = copia(); s[parte] = original; aplicarCambio(s);
}
// portada
function cambiarTexto(k, valor, vivo){ var s = copia(); if(valor) s.portada.textos[k] = valor; else delete s.portada.textos[k]; aplicarCambio(s, vivo); }
function moverSeccion(i, d){ var s = copia(), a = s.portada.secciones, j = i + d; if(j < 0 || j >= a.length) return; var x = a[i]; a[i] = a[j]; a[j] = x; aplicarCambio(s); }
function verSeccion(i, v){
  var s = copia(), a = s.portada.secciones;
  if(!v && a.filter(function(x){ return x.visible; }).length <= 1){ alert('Deja al menos una sección visible en la portada.'); pintar(); return; }
  a[i].visible = !!v; aplicarCambio(s);
}
function modoDestacados(manual){
  var s = copia();
  if(!manual){ if(s.portada.destacados.length && !confirm('¿Volver al carrusel automático (los relojes más pedidos)? Se quita tu lista.')){ pintar(); return; } s.portada.destacados = []; }
  else if(!s.portada.destacados.length){ s.portada.destacados = relojesElegibles().slice(0, 6).map(function(p){ return p.id; }); }
  aplicarCambio(s);
}
function agregarDestacado(id){
  if(!id) return; var s = copia();
  if(s.portada.destacados.indexOf(id) !== -1) return;
  if(s.portada.destacados.length >= MAX_DESTACADOS){ alert('Puedes elegir hasta ' + MAX_DESTACADOS + ' relojes.'); pintar(); return; }
  s.portada.destacados.push(id); aplicarCambio(s);
}
function quitarDestacado(i){
  var s = copia();
  if(s.portada.destacados.length <= 1){ alert('Deja al menos un reloj o vuelve al modo automático.'); return; }
  s.portada.destacados.splice(i, 1); aplicarCambio(s);
}
function moverDestacado(i, d){ var s = copia(), a = s.portada.destacados, j = i + d; if(j < 0 || j >= a.length) return; var x = a[i]; a[i] = a[j]; a[j] = x; aplicarCambio(s); }
function cambiarEnlace(k, id){ var s = copia(); if(id) s.portada.enlaces[k] = id; else delete s.portada.enlaces[k]; aplicarCambio(s); }
function relojesElegibles(){
  return state.inventario.filter(function(p){ return esPublicable(p) && p.estado !== 'vendido'; })
    .sort(function(a, b){ return String(a.nombre).localeCompare(String(b.nombre)); });
}
// nombre con la referencia (si no la trae ya el nombre)
function etiquetaReloj(p){ var n = String(p.nombre || 'Reloj'); return p.sku && n.indexOf(p.sku) === -1 ? n + ' · ' + p.sku : n; }
function nombreReloj(id){ var p = state.inventario.find(function(x){ return x.id === id; }); return p ? etiquetaReloj(p) : 'Reloj que ya no está'; }

// ---------- publicar ----------
async function publicarTema(){
  if(_publicando) return;
  if(problemasTema(_borrador.tema).length){ alert('Corrige primero los colores marcados en rojo: hay textos que no se leerían.'); return; }
  if(iguales(_borrador, _publicado)) return;
  if(!confirm('¿Publicar estos cambios en la tienda?\n\nLos clientes los verán en segundos. Si no te gustan, puedes volver a la versión anterior desde el historial.')) return;
  _publicando = true; pintarBarra();
  try{
    var r = await pedir('/admin/sitio', { sitio: _borrador, nota: _nota.trim() });
    if(_meta.version) _historial.unshift({ version: _meta.version, fecha: _meta.fecha, tema: _publicado.tema, portada: _publicado.portada });
    _publicado = validarSitio(r.publicado); _meta = { version: r.publicado.version, fecha: r.publicado.fecha };
    _pila = []; _nota = '';
    try{ localStorage.removeItem(CLAVE_BORRADOR); }catch(e){}
    if(window.toastPanel) window.toastPanel('Publicado (versión ' + r.publicado.version + '). Ya se ve en la tienda.');
  }catch(e){ alert('No se pudo publicar: ' + e.message); }
  _publicando = false; pintar();
}

// ---------- temas guardados ----------
async function guardarComoTema(){
  var n = ((el('ed-tema-nombre') || {}).value || '').replace(/\s+/g, ' ').trim();
  if(n.length < 2){ alert('Escribe un nombre para el tema (por ejemplo "Navidad 2026").'); return; }
  if(_temas.length >= 20){ alert('Ya tienes 20 temas guardados. Borra alguno para guardar otro.'); return; }
  var lista = _temas.concat([{ nombre: n, tema: _borrador.tema }]);
  try{ _temas = (await pedir('/admin/sitio/temas', { temas: lista })).temas; pintar(); if(window.toastPanel) window.toastPanel('Tema "' + n + '" guardado.'); }
  catch(e){ alert('No se pudo guardar el tema: ' + e.message); }
}
async function borrarTema(i){
  var t = _temas[i]; if(!t || !confirm('¿Borrar el tema "' + t.nombre + '"?')) return;
  try{ _temas = (await pedir('/admin/sitio/temas', { temas: _temas.filter(function(_, k){ return k !== i; }) })).temas; pintar(); }catch(e){ alert('No se pudo borrar: ' + e.message); }
}
function usarGuardado(i){ if(_temas[i]) usarTema(_temas[i].tema); }
function usarListo(id){ var t = TEMAS_LISTOS.find(function(x){ return x.id === id; }); if(t) usarTema(t.tema); }
function usarVersion(i){ var h = _historial[i]; if(h) aplicarCambio(validarSitio(h)); }

// ---------- vista previa ----------
function enviarVista(){
  var f = el('ed-vista'); if(!f || !f.contentWindow) return;
  try{ f.contentWindow.postMessage({ tipo: 'aph-sitio', sitio: _borrador }, location.origin); }catch(e){}
}
window.addEventListener('message', function(e){ if(e.origin === location.origin && e.data && e.data.tipo === 'aph-vista-lista') enviarVista(); });
function verEn(d){ _dispositivo = d; ajustarVista(); pintarDispositivo(); }
function ajustarVista(){
  var caja = el('ed-vista-caja'), f = el('ed-vista'); if(!caja || !f) return;
  var ancho = _dispositivo === 'celular' ? 390 : 1280, alto = _dispositivo === 'celular' ? 760 : 820;
  var k = Math.min(1, caja.clientWidth / ancho);
  f.style.width = ancho + 'px'; f.style.height = alto + 'px'; f.style.transform = 'scale(' + k + ')';
  caja.style.height = Math.round(alto * k) + 'px';
}
window.addEventListener('resize', function(){ if(el('ed-vista')) ajustarVista(); });
function recargarVista(){ var f = el('ed-vista'); if(f) f.src = TIENDA + '?vista-previa=1&t=' + Date.now(); }

// ---------- pintar ----------
function fechaCorta(ms){ if(!ms) return ''; var d = new Date(ms); return d.toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }); }
function renderTienda(vista){
  if(vista) _vista = vista;
  var raiz = el('tienda-editor'); if(!raiz) return;
  if(!raiz.dataset.armado){
    raiz.dataset.armado = '1';
    raiz.innerHTML =
      '<div class="ed-grid">' +
        '<div class="ed-vista-col"><div class="ed-vista-cab"><b>Vista previa</b><div class="ed-chips" id="ed-disp"></div>' +
          '<button type="button" class="btn btn-outline btn-sm" onclick="recargarVista()" title="Volver a cargar la tienda">Recargar</button></div>' +
          '<div class="ed-vista-caja" id="ed-vista-caja"><iframe id="ed-vista" title="Vista previa de la tienda" src="' + TIENDA + '?vista-previa=1"></iframe></div>' +
          '<p class="tenue-peq">Es la tienda real con tus cambios. Puedes navegar dentro. Los clientes no ven nada hasta que publiques.</p></div>' +
        '<div class="ed-ctrl" id="ed-ctrl"></div>' +
      '</div>' +
      '<div class="ed-barra" id="ed-barra"></div>';
    setTimeout(ajustarVista, 50);
  }
  if(!_cargado){ el('ed-ctrl').innerHTML = '<div class="card">Cargando la configuración de la tienda…</div>'; cargar(); return; }
  pintar();
}
function pintarDispositivo(){
  var d = el('ed-disp'); if(!d) return;
  d.innerHTML = [['celular', 'Celular'], ['computadora', 'Computadora']].map(function(x){
    return '<button type="button" class="fin-mes-btn' + (_dispositivo === x[0] ? ' active' : '') + '" onclick="verEnTienda(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('');
}
function muestras(t){ t = validarTema(t); return '<i class="ed-mini" aria-hidden="true"><i style="background:' + t.barraFondo + '"></i><i style="background:' + t.acento + '"></i><i style="background:' + t.botonFondo + '"></i></i>'; }
function pintar(){
  var c = el('ed-ctrl'); if(!c || !_borrador) return;
  pintarDispositivo();
  var h = _error ? '<div class="fin-aviso"><span>No se pudo leer la configuración publicada (' + esc(_error) + '). Revisa tu internet; tus cambios quedan guardados en este dispositivo.</span></div>' : '';
  h += _vista === 'portada' ? htmlPortada() : htmlDiseno();
  h += htmlHistorial();
  c.innerHTML = h;
  var probs = problemasTema(_borrador.tema);
  if(probs.length) c.insertAdjacentHTML('afterbegin', '<div class="fin-aviso ed-alerta"><span><b>No se puede publicar todavía:</b> ' + probs.map(function(p){ return esc(p.donde) + ' (contraste ' + p.ratio + ', mínimo 4.5)'; }).join(' · ') + '. Elige colores con más diferencia entre el fondo y las letras (en Diseño).</span></div>');
  pintarBarra();
}
// ---- Diseno ----
function filaColor(k){
  var v = _borrador.tema[k], base = TEMA_BASE[k], info = CAMPOS[k];
  return '<div class="ed-color">' +
    '<label class="ed-muestra" style="background:' + v + '"><input type="color" value="' + v + '" oninput="cambiarTema(\'' + k + '\',this.value,1);this.parentNode.style.background=this.value" onchange="cambiarTema(\'' + k + '\',this.value)" aria-label="' + esc(info[0]) + '"></label>' +
    '<div class="ed-color-txt"><b>' + esc(info[0]) + '</b>' + (info[1] ? '<span>' + esc(info[1]) + '</span>' : '') + '</div>' +
    '<input class="ed-hex" value="' + v + '" maxlength="7" spellcheck="false" onchange="cambiarHex(\'' + k + '\',this)" aria-label="Código del color">' +
    (v !== base ? '<button type="button" class="ed-rest" onclick="cambiarTema(\'' + k + '\',\'' + base + '\')" title="Volver al original">↺</button>' : '<span class="ed-rest-vacio"></span>') +
  '</div>';
}
function htmlDiseno(){
  var t = _borrador.tema, h = '';
  h += '<div class="card"><div class="card-title">Temas</div><p class="ed-ayuda">Elige una combinación lista o una que hayas guardado. Puedes ajustarla después.</p><div class="ed-chips">' +
    TEMAS_LISTOS.map(function(x){ return '<button type="button" class="ed-tema" onclick="usarTemaListo(\'' + x.id + '\')">' + muestras(x.tema) + esc(x.nombre) + '</button>'; }).join('') +
    _temas.map(function(x, i){ return '<span class="ed-tema guardado"><button type="button" onclick="usarTemaGuardado(' + i + ')">' + muestras(x.tema) + esc(x.nombre) + '</button><button type="button" class="ed-x" onclick="borrarTemaGuardado(' + i + ')" aria-label="Borrar tema">×</button></span>'; }).join('') +
    '</div><div class="ed-guardar"><input id="ed-tema-nombre" maxlength="40" placeholder="Nombre para guardar este diseño como tema"><button type="button" class="btn btn-outline btn-sm" onclick="guardarComoTema()">Guardar tema</button></div></div>';
  h += '<div class="card"><div class="card-title">Colores</div>' + COLORES.map(filaColor).join('') + '</div>';
  h += '<div class="card"><div class="card-title">Botones</div><p class="ed-ayuda">Forma de los botones principales y del botón del banner.</p><div class="ed-chips">' +
    FORMAS_TXT.map(function(f){ return '<button type="button" class="fin-mes-btn' + (t.formaBotones === f[0] ? ' active' : '') + '" onclick="cambiarTema(\'formaBotones\',\'' + f[0] + '\')">' + f[1] + '</button>'; }).join('') + '</div></div>';
  h += '<div class="card"><div class="card-title">Esquinas de las fotos</div><p class="ed-ayuda">Catálogo, carrusel, Hombre/Mujer, marcas y relojes parecidos.</p>' +
    '<label class="ed-check"><input type="checkbox"' + (t.esquinasFotos < 0 ? ' checked' : '') + ' onchange="cambiarTema(\'esquinasFotos\',this.checked?-1:12)"> Como están ahora</label>' +
    (t.esquinasFotos >= 0 ? '<div class="ed-rango"><input type="range" min="0" max="24" step="1" value="' + t.esquinasFotos + '" oninput="cambiarTema(\'esquinasFotos\',this.value,1)" onchange="cambiarTema(\'esquinasFotos\',this.value)" aria-label="Redondeo de las fotos"><b data-valor="esquinasFotos">' + t.esquinasFotos + ' px</b></div>' : '') + '</div>';
  h += '<div class="card"><div class="card-title">Tamaño de los títulos</div><p class="ed-ayuda">Títulos del banner y de las secciones.</p>' +
    '<div class="ed-rango"><input type="range" min="85" max="125" step="5" value="' + t.escalaTitulos + '" oninput="cambiarTema(\'escalaTitulos\',this.value,1)" onchange="cambiarTema(\'escalaTitulos\',this.value)" aria-label="Tamaño de los títulos"><b data-valor="escalaTitulos">' + t.escalaTitulos + ' %</b></div></div>';
  return h;
}
// ---- Portada ----
function htmlPortada(){
  var p = _borrador.portada, h = '';
  // secciones
  h += '<div class="card"><div class="card-title">Secciones de la portada</div><p class="ed-ayuda">Ordénalas con las flechas y apaga las que no quieras mostrar. El banner principal siempre va primero.</p>' +
    p.secciones.map(function(s, i){
      var info = SECCIONES.find(function(x){ return x.id === s.id; }) || { nombre: s.id };
      return '<div class="ed-fila' + (s.visible ? '' : ' apagada') + '"><span class="ed-num">' + (i + 1) + '</span><b>' + esc(info.nombre) + '</b>' +
        '<button type="button" class="ed-mini-btn" onclick="moverSeccionTienda(' + i + ',-1)"' + (i ? '' : ' disabled') + ' aria-label="Subir">↑</button>' +
        '<button type="button" class="ed-mini-btn" onclick="moverSeccionTienda(' + i + ',1)"' + (i < p.secciones.length - 1 ? '' : ' disabled') + ' aria-label="Bajar">↓</button>' +
        '<label class="ed-switch"><input type="checkbox"' + (s.visible ? ' checked' : '') + ' onchange="verSeccionTienda(' + i + ',this.checked)"><span></span>' + (s.visible ? 'Visible' : 'Oculta') + '</label></div>';
    }).join('') + '</div>';
  // mas vendidos
  var manual = p.destacados.length > 0, elegibles = relojesElegibles();
  h += '<div class="card"><div class="card-title">Relojes de "Más vendidos"</div><div class="ed-chips" style="margin-bottom:10px;">' +
    '<button type="button" class="fin-mes-btn' + (manual ? '' : ' active') + '" onclick="modoDestacadosTienda(0)">Automático</button>' +
    '<button type="button" class="fin-mes-btn' + (manual ? ' active' : '') + '" onclick="modoDestacadosTienda(1)">Elegir yo</button></div>' +
    (manual ? p.destacados.map(function(id, i){
      return '<div class="ed-fila"><span class="ed-num">' + (i + 1) + '</span><b>' + esc(nombreReloj(id)) + '</b>' +
        '<button type="button" class="ed-mini-btn" onclick="moverDestacadoTienda(' + i + ',-1)"' + (i ? '' : ' disabled') + ' aria-label="Subir">↑</button>' +
        '<button type="button" class="ed-mini-btn" onclick="moverDestacadoTienda(' + i + ',1)"' + (i < p.destacados.length - 1 ? '' : ' disabled') + ' aria-label="Bajar">↓</button>' +
        '<button type="button" class="ed-mini-btn quitar" onclick="quitarDestacadoTienda(' + i + ')" aria-label="Quitar">×</button></div>';
    }).join('') + (p.destacados.length < MAX_DESTACADOS ? '<select class="ed-agregar" onchange="agregarDestacadoTienda(this.value)"><option value="">+ Agregar un reloj…</option>' +
      elegibles.filter(function(x){ return p.destacados.indexOf(x.id) === -1; }).map(function(x){ return '<option value="' + esc(x.id) + '">' + esc(etiquetaReloj(x)) + '</option>'; }).join('') + '</select>' : '')
      : '<p class="ed-ayuda" style="margin:0;">Se muestran solos los relojes más pedidos por WhatsApp. Los vendidos nunca salen.</p>') + '</div>';
  // botones del futuro
  h += '<div class="card"><div class="card-title">Botones de "El futuro en tu muñeca"</div><p class="ed-ayuda">A qué reloj lleva cada botón.</p>' +
    Object.keys(ENLACES).map(function(k){
      var actual = p.enlaces[k] || '';
      return '<label class="ed-campo"><span>' + esc(ENLACES[k][1]) + '</span><select onchange="cambiarEnlaceTienda(\'' + k + '\',this.value)"><option value="">Como está ahora</option>' +
        elegibles.map(function(x){ return '<option value="' + esc(x.id) + '"' + (x.id === actual ? ' selected' : '') + '>' + esc(etiquetaReloj(x)) + '</option>'; }).join('') + '</select></label>';
    }).join('') + '</div>';
  // textos por grupo
  var grupos = {};
  Object.keys(TEXTOS).forEach(function(k){ (grupos[TEXTOS[k][3]] = grupos[TEXTOS[k][3]] || []).push(k); });
  h += '<div class="card"><div class="card-title">Textos</div><p class="ed-ayuda">Deja un campo vacío para usar el texto original (se ve en gris). En los campos de varias líneas, Enter hace un salto de línea; **texto** se ve en negrita.</p>' +
    Object.keys(grupos).map(function(g){
      return '<div class="ed-grupo"><div class="ed-grupo-t">' + esc(g) + '</div>' + grupos[g].map(function(k){
        var cfg = TEXTOS[k], v = p.textos[k] || '', ph = (_originales && _originales[k]) || '';
        var campo = cfg[2]
          ? '<textarea rows="2" maxlength="' + cfg[1] + '" placeholder="' + esc(ph) + '" oninput="cambiarTextoTienda(\'' + k + '\',this.value,1);contarTexto(this)" onchange="cambiarTextoTienda(\'' + k + '\',this.value)">' + esc(v) + '</textarea>'
          : '<input maxlength="' + cfg[1] + '" value="' + esc(v) + '" placeholder="' + esc(ph) + '" oninput="cambiarTextoTienda(\'' + k + '\',this.value,1);contarTexto(this)" onchange="cambiarTextoTienda(\'' + k + '\',this.value)">';
        return '<label class="ed-campo"><span>' + esc(cfg[4]) + ' <em class="ed-cont">' + v.length + '/' + cfg[1] + '</em></span>' + campo + '</label>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  return h;
}
function contarTexto(c){ var e = c.parentNode.querySelector('.ed-cont'); if(e) e.textContent = c.value.length + '/' + c.maxLength; }
// ---- historial ----
function htmlHistorial(){
  return '<div class="card"><div class="card-title">Historial</div>' +
    (_meta.version ? '<div class="ed-hist actual"><span><b>Versión ' + _meta.version + '</b> · publicada ' + esc(fechaCorta(_meta.fecha)) + ' · la que se ve hoy</span></div>' : '<p class="ed-ayuda">Todavía no has publicado cambios: la tienda usa su configuración original.</p>') +
    _historial.slice(0, 10).map(function(x, i){ return '<div class="ed-hist"><span>' + muestras(x.tema) + '<b>Versión ' + (x.version || '?') + '</b> · ' + esc(fechaCorta(x.fecha)) + (x.nota ? ' · ' + esc(x.nota) : '') + '</span><button type="button" class="btn btn-outline btn-sm" onclick="usarVersionTema(' + i + ')">Volver a esta</button></div>'; }).join('') + '</div>';
}
function pintarBarra(){
  var b = el('ed-barra'); if(!b || !_borrador) return;
  var cambios = !iguales(_borrador, _publicado), probs = problemasTema(_borrador.tema).length;
  var estado = probs ? '<span class="ed-estado mal">Hay colores que no se leen</span>' : cambios ? '<span class="ed-estado pend">Cambios sin publicar</span>' : '<span class="ed-estado ok">Igual a la tienda</span>';
  var parte = _vista === 'portada' ? 'portada' : 'tema';
  var esOriginal = JSON.stringify(_borrador[parte]) === JSON.stringify(parte === 'tema' ? validarTema(TEMA_BASE) : validarPortada({}));
  b.innerHTML = estado +
    '<input id="ed-nota" class="ed-nota" maxlength="80" placeholder="Nota (opcional): ej. colores de Navidad" value="' + esc(_nota) + '" oninput="notaTema(this.value)"' + (cambios ? '' : ' hidden') + '>' +
    '<div class="ed-barra-acc">' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="deshacerTema()"' + (_pila.length ? '' : ' disabled') + '>Deshacer</button>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="descartarTema()"' + (cambios ? '' : ' disabled') + '>Descartar</button>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="restaurarOriginal()"' + (esOriginal ? ' disabled' : '') + '>' + (parte === 'tema' ? 'Diseño original' : 'Portada original') + '</button>' +
      '<button type="button" class="btn btn-gold btn-sm" onclick="publicarTema()"' + (cambios && !probs && !_publicando ? '' : ' disabled') + '>' + (_publicando ? 'Publicando…' : 'Publicar') + '</button>' +
    '</div>';
}
function cambiarHex(k, input){
  var v = String(input.value || '').trim(); if(v && v[0] !== '#') v = '#' + v;
  var ok = validarTema((function(o){ o[k] = v; return o; })({}))[k];
  if(ok === TEMA_BASE[k] && v.toLowerCase() !== TEMA_BASE[k]){ input.value = _borrador.tema[k]; if(window.toastPanel) window.toastPanel('Ese código de color no es válido. Usa el formato #a7c4d6.'); return; }
  cambiarTema(k, ok);
}
function notaTema(v){ _nota = String(v || '').slice(0, 80); }

export { renderTienda };
// usadas desde atributos onclick/oninput del HTML
Object.assign(window, { agregarDestacadoTienda: agregarDestacado, borrarTemaGuardado: borrarTema, cambiarEnlaceTienda: cambiarEnlace, cambiarHex, cambiarTema, cambiarTextoTienda: cambiarTexto,
  contarTexto, descartarTema, deshacerTema, guardarComoTema, modoDestacadosTienda: modoDestacados, moverDestacadoTienda: moverDestacado, moverSeccionTienda: moverSeccion,
  notaTema, publicarTema, quitarDestacadoTienda: quitarDestacado, recargarVista, renderTienda, restaurarOriginal, usarTemaGuardado: usarGuardado, usarTemaListo: usarListo,
  usarVersionTema: usarVersion, verEnTienda: verEn, verSeccionTienda: verSeccion });
