// =================== TIENDA > DISENO (editor de la tienda, fase 1) ===================
// Colores, botones, esquinas de las fotos y tamano de los titulos de la tienda, con vista previa en vivo (la
// tienda real dentro de un marco, en celular o computadora) y publicacion con un toque.
// POKA-YOKE:
// - Nada cambia en la tienda hasta tocar "Publicar" (y se confirma). El borrador se guarda en este dispositivo.
// - Si un texto no se leeria sobre su fondo, se marca en rojo y "Publicar" queda desactivado (el servidor
//   tambien lo rechaza).
// - Deshacer paso a paso, volver a cualquier version anterior (historial) y restaurar el diseno original.
// - Los colores escritos a mano se corrigen solos (#abc -> #aabbcc) o vuelven al anterior si no son validos.
import { firebase } from '../../firebase.js';
import { COLORES, TEMA_BASE, TEMAS_LISTOS, contraste, iguales, problemasTema, validarTema } from '../../sitio/tema.js';
import { esc } from '../componentes.js';

const API = 'https://api.aphillipsstore.com';
const CLAVE_BORRADOR = 'aph_editor_borrador';
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

var _publicado = null, _historial = [], _temas = [], _borrador = null, _pila = [], _error = '', _cargado = false;
var _dispositivo = 'celular', _publicando = false, _nota = '';

function el(id){ return document.getElementById(id); }
function leerBorrador(){ try{ var t = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) || 'null'); return t ? validarTema(t) : null; }catch(e){ return null; } }
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
    _publicado = validarTema(a.publicado.tema); _publicado._version = a.publicado.version; _publicado._fecha = a.publicado.fecha;
    _historial = a.historial || []; _temas = b.temas || []; _error = '';
  }catch(e){ _error = e.message; if(!_publicado) _publicado = validarTema(TEMA_BASE); }
  if(!_borrador) _borrador = leerBorrador() || limpio(_publicado);
  _cargado = true;
  pintar(); enviarVista();
}
function limpio(t){ return validarTema(t); }   // sin _version ni _fecha

// ---------- cambios ----------
// vivo = true mientras se arrastra un color o una barra: solo se actualizan la vista previa y la barra de abajo
// (redibujar todo cerraria el selector de color). Al soltar (change) se guarda un solo paso para Deshacer.
var _antesDeArrastrar = null;
function cambiar(campo, valor, vivo){
  var nuevo = validarTema(Object.assign({}, _borrador, (function(o){ o[campo] = valor; return o; })({})));
  if(vivo){
    if(!_antesDeArrastrar) _antesDeArrastrar = _borrador;
    _borrador = nuevo; guardarBorrador(); enviarVista(); pintarBarra();
    var et = document.querySelector('[data-valor="' + campo + '"]'); if(et) et.textContent = campo === 'escalaTitulos' ? nuevo[campo] + ' %' : nuevo[campo] + ' px';
    return;
  }
  var antes = _antesDeArrastrar || _borrador; _antesDeArrastrar = null;
  if(iguales(nuevo, antes)){ _borrador = nuevo; pintar(); return; }
  _pila.push(antes); if(_pila.length > 50) _pila.shift();
  _borrador = nuevo; guardarBorrador(); pintar(); enviarVista();
}
function usarTema(t){
  var nuevo = validarTema(t); if(iguales(nuevo, _borrador)) return;
  _pila.push(_borrador); _borrador = nuevo; guardarBorrador(); pintar(); enviarVista();
}
function deshacerTema(){ if(!_pila.length) return; _borrador = _pila.pop(); guardarBorrador(); pintar(); enviarVista(); }
function descartarTema(){
  if(iguales(_borrador, _publicado)) return;
  if(!confirm('¿Descartar los cambios sin publicar y volver a lo que se ve hoy en la tienda?')) return;
  usarTema(limpio(_publicado));
}
function restaurarOriginal(){
  if(iguales(_borrador, TEMA_BASE)) return;
  if(!confirm('¿Volver al diseño original de la tienda (glaciar)? Puedes deshacerlo antes de publicar.')) return;
  usarTema(TEMA_BASE);
}

// ---------- publicar ----------
async function publicarTema(){
  if(_publicando) return;
  var probs = problemasTema(_borrador);
  if(probs.length){ alert('Corrige primero los colores marcados en rojo: hay textos que no se leerían.'); return; }
  if(iguales(_borrador, _publicado)){ return; }
  var nota = _nota;
  if(!confirm('¿Publicar este diseño en la tienda?\n\nLos clientes lo verán en segundos. Si no te gusta, puedes volver a la versión anterior desde el historial.')) return;
  _publicando = true; pintarBarra();
  try{
    var r = await pedir('/admin/sitio', { tema: _borrador, nota: nota.trim() });
    var antes = Object.assign({ version: _publicado._version, fecha: _publicado._fecha, tema: limpio(_publicado) });
    if(antes.version) _historial.unshift(antes);
    _publicado = validarTema(r.publicado.tema); _publicado._version = r.publicado.version; _publicado._fecha = r.publicado.fecha;
    _pila = []; _nota = '';
    try{ localStorage.removeItem(CLAVE_BORRADOR); }catch(e){}
    if(window.toastPanel) window.toastPanel('Diseño publicado (versión ' + r.publicado.version + '). Ya se ve en la tienda.');
  }catch(e){ alert('No se pudo publicar: ' + e.message); }
  _publicando = false; pintar();
}

// ---------- temas guardados ----------
async function guardarComoTema(){
  var n = (el('ed-tema-nombre') || {}).value || '';
  n = n.replace(/\s+/g, ' ').trim();
  if(n.length < 2){ alert('Escribe un nombre para el tema (por ejemplo "Navidad 2026").'); return; }
  if(_temas.length >= 20){ alert('Ya tienes 20 temas guardados. Borra alguno para guardar otro.'); return; }
  var lista = _temas.concat([{ nombre: n, tema: limpio(_borrador) }]);
  try{ _temas = (await pedir('/admin/sitio/temas', { temas: lista })).temas; el('ed-tema-nombre').value = ''; pintar();
    if(window.toastPanel) window.toastPanel('Tema "' + n + '" guardado.'); }
  catch(e){ alert('No se pudo guardar el tema: ' + e.message); }
}
async function borrarTema(i){
  var t = _temas[i]; if(!t || !confirm('¿Borrar el tema "' + t.nombre + '"?')) return;
  var lista = _temas.filter(function(_, k){ return k !== i; });
  try{ _temas = (await pedir('/admin/sitio/temas', { temas: lista })).temas; pintar(); }catch(e){ alert('No se pudo borrar: ' + e.message); }
}
function usarGuardado(i){ if(_temas[i]) usarTema(_temas[i].tema); }
function usarListo(id){ var t = TEMAS_LISTOS.find(function(x){ return x.id === id; }); if(t) usarTema(t.tema); }
function usarVersion(i){ var h = _historial[i]; if(h) usarTema(h.tema); }

// ---------- vista previa ----------
function enviarVista(){
  var f = el('ed-vista'); if(!f || !f.contentWindow) return;
  try{ f.contentWindow.postMessage({ tipo: 'aph-tema', tema: _borrador }, location.origin); }catch(e){}
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
function renderTienda(){
  var raiz = el('tienda-diseno'); if(!raiz) return;
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
  if(!_cargado){ el('ed-ctrl').innerHTML = '<div class="card">Cargando el diseño de la tienda…</div>'; cargar(); return; }
  pintar();
}
function pintarDispositivo(){
  var d = el('ed-disp'); if(!d) return;
  d.innerHTML = [['celular', 'Celular'], ['computadora', 'Computadora']].map(function(x){
    return '<button type="button" class="fin-mes-btn' + (_dispositivo === x[0] ? ' active' : '') + '" onclick="verEnTienda(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('');
}
function filaColor(k){
  var v = _borrador[k], base = TEMA_BASE[k], info = CAMPOS[k];
  return '<div class="ed-color">' +
    '<label class="ed-muestra" style="background:' + v + '"><input type="color" value="' + v + '" oninput="cambiarTema(\'' + k + '\',this.value,1);this.parentNode.style.background=this.value" onchange="cambiarTema(\'' + k + '\',this.value)" aria-label="' + esc(info[0]) + '"></label>' +
    '<div class="ed-color-txt"><b>' + esc(info[0]) + '</b>' + (info[1] ? '<span>' + esc(info[1]) + '</span>' : '') + '</div>' +
    '<input class="ed-hex" value="' + v + '" maxlength="7" spellcheck="false" onchange="cambiarHex(\'' + k + '\',this)" aria-label="Código del color">' +
    (v !== base ? '<button type="button" class="ed-rest" onclick="cambiarTema(\'' + k + '\',\'' + base + '\')" title="Volver al original">↺</button>' : '<span class="ed-rest-vacio"></span>') +
  '</div>';
}
function pintar(){
  var c = el('ed-ctrl'); if(!c || !_borrador) return;
  pintarDispositivo();
  var probs = problemasTema(_borrador);
  var t = _borrador;
  var h = '';
  if(_error) h += '<div class="fin-aviso"><span>No se pudo leer el diseño publicado (' + esc(_error) + '). Revisa tu internet; tus cambios quedan guardados en este dispositivo.</span></div>';
  // temas
  h += '<div class="card"><div class="card-title">Temas</div><p class="ed-ayuda">Elige una combinación lista o una que hayas guardado. Puedes ajustarla después.</p><div class="ed-chips">' +
    TEMAS_LISTOS.map(function(x){ return '<button type="button" class="ed-tema" onclick="usarTemaListo(\'' + x.id + '\')">' + muestras(x.tema) + esc(x.nombre) + '</button>'; }).join('') +
    _temas.map(function(x, i){ return '<span class="ed-tema guardado"><button type="button" onclick="usarTemaGuardado(' + i + ')">' + muestras(x.tema) + esc(x.nombre) + '</button><button type="button" class="ed-x" onclick="borrarTemaGuardado(' + i + ')" aria-label="Borrar tema">×</button></span>'; }).join('') +
    '</div><div class="ed-guardar"><input id="ed-tema-nombre" maxlength="40" placeholder="Nombre para guardar este diseño como tema"><button type="button" class="btn btn-outline btn-sm" onclick="guardarComoTema()">Guardar tema</button></div></div>';
  // colores
  h += '<div class="card"><div class="card-title">Colores</div>' + COLORES.map(filaColor).join('') + '</div>';
  // botones, fotos, titulos
  h += '<div class="card"><div class="card-title">Botones</div><p class="ed-ayuda">Forma de los botones principales y del botón del banner.</p><div class="ed-chips">' +
    FORMAS_TXT.map(function(f){ return '<button type="button" class="fin-mes-btn' + (t.formaBotones === f[0] ? ' active' : '') + '" onclick="cambiarTema(\'formaBotones\',\'' + f[0] + '\')">' + f[1] + '</button>'; }).join('') + '</div></div>';
  h += '<div class="card"><div class="card-title">Esquinas de las fotos</div><p class="ed-ayuda">Catálogo, carrusel, Hombre/Mujer, marcas y relojes parecidos.</p>' +
    '<label class="ed-check"><input type="checkbox"' + (t.esquinasFotos < 0 ? ' checked' : '') + ' onchange="cambiarTema(\'esquinasFotos\',this.checked?-1:12)"> Como están ahora</label>' +
    (t.esquinasFotos >= 0 ? '<div class="ed-rango"><input type="range" min="0" max="24" step="1" value="' + t.esquinasFotos + '" oninput="cambiarTema(\'esquinasFotos\',this.value,1)" onchange="cambiarTema(\'esquinasFotos\',this.value)" aria-label="Redondeo de las fotos"><b data-valor="esquinasFotos">' + t.esquinasFotos + ' px</b></div>' : '') + '</div>';
  h += '<div class="card"><div class="card-title">Tamaño de los títulos</div><p class="ed-ayuda">Títulos del banner y de las secciones.</p>' +
    '<div class="ed-rango"><input type="range" min="85" max="125" step="5" value="' + t.escalaTitulos + '" oninput="cambiarTema(\'escalaTitulos\',this.value,1)" onchange="cambiarTema(\'escalaTitulos\',this.value)" aria-label="Tamaño de los títulos"><b data-valor="escalaTitulos">' + t.escalaTitulos + ' %</b></div></div>';
  // historial
  h += '<div class="card"><div class="card-title">Historial</div>' +
    (_publicado && _publicado._version ? '<div class="ed-hist actual"><span><b>Versión ' + _publicado._version + '</b> · publicada ' + esc(fechaCorta(_publicado._fecha)) + ' · la que se ve hoy</span></div>' : '<p class="ed-ayuda">Todavía no has publicado cambios: la tienda usa el diseño original.</p>') +
    _historial.slice(0, 10).map(function(x, i){ return '<div class="ed-hist"><span>' + muestras(x.tema) + '<b>Versión ' + (x.version || '?') + '</b> · ' + esc(fechaCorta(x.fecha)) + (x.nota ? ' · ' + esc(x.nota) : '') + '</span><button type="button" class="btn btn-outline btn-sm" onclick="usarVersionTema(' + i + ')">Volver a esta</button></div>'; }).join('') + '</div>';
  c.innerHTML = h;
  // avisos de contraste: marca las filas con problema
  if(probs.length){
    var avisos = '<div class="fin-aviso ed-alerta"><span><b>No se puede publicar todavía:</b> ' + probs.map(function(p){ return esc(p.donde) + ' (contraste ' + p.ratio + ', mínimo 4.5)'; }).join(' · ') + '. Elige colores con más diferencia entre el fondo y las letras.</span></div>';
    c.insertAdjacentHTML('afterbegin', avisos);
  }
  pintarBarra();
}
function muestras(t){ t = validarTema(t); return '<i class="ed-mini" aria-hidden="true"><i style="background:' + t.barraFondo + '"></i><i style="background:' + t.acento + '"></i><i style="background:' + t.botonFondo + '"></i></i>'; }
function pintarBarra(){
  var b = el('ed-barra'); if(!b || !_borrador) return;
  var cambios = !iguales(_borrador, _publicado), probs = problemasTema(_borrador).length;
  var estado = probs ? '<span class="ed-estado mal">Hay colores que no se leen</span>' : cambios ? '<span class="ed-estado pend">Cambios sin publicar</span>' : '<span class="ed-estado ok">Igual a la tienda</span>';
  b.innerHTML = estado +
    '<input id="ed-nota" class="ed-nota" maxlength="80" placeholder="Nota (opcional): ej. colores de Navidad" value="' + esc(_nota) + '" oninput="notaTema(this.value)"' + (cambios ? '' : ' hidden') + '>' +
    '<div class="ed-barra-acc">' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="deshacerTema()"' + (_pila.length ? '' : ' disabled') + '>Deshacer</button>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="descartarTema()"' + (cambios ? '' : ' disabled') + '>Descartar</button>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="restaurarOriginal()"' + (iguales(_borrador, TEMA_BASE) ? ' disabled' : '') + '>Diseño original</button>' +
      '<button type="button" class="btn btn-gold btn-sm" onclick="publicarTema()"' + (cambios && !probs && !_publicando ? '' : ' disabled') + '>' + (_publicando ? 'Publicando…' : 'Publicar') + '</button>' +
    '</div>';
}
function cambiarHex(k, input){
  var v = String(input.value || '').trim(); if(v && v[0] !== '#') v = '#' + v;
  var ok = validarTema((function(o){ o[k] = v; return o; })({}))[k];
  if(ok === TEMA_BASE[k] && v.toLowerCase() !== TEMA_BASE[k]){ input.value = _borrador[k]; if(window.toastPanel) window.toastPanel('Ese código de color no es válido. Usa el formato #a7c4d6.'); return; }
  cambiar(k, ok);
}

export { renderTienda };
// usadas desde atributos onclick/oninput del HTML
function notaTema(v){ _nota = String(v || '').slice(0, 80); }
Object.assign(window, { notaTema, borrarTemaGuardado: borrarTema, cambiarHex, cambiarTema: cambiar, descartarTema, deshacerTema, guardarComoTema, publicarTema, recargarVista,
  renderTienda, restaurarOriginal, usarTemaGuardado: usarGuardado, usarTemaListo: usarListo, usarVersionTema: usarVersion, verEnTienda: verEn });
void contraste;
