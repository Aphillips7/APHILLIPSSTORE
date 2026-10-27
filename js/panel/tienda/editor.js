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
import { ETIQUETAS_LISTAS, MAX, WA_BASE, dinero, hoy, validarPromos } from '../../sitio/promos.js';
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
function validarSitio(s){ s = s || {}; return { tema: validarTema(s.tema), portada: validarPortada(s.portada), promos: validarPromos(s.promos) }; }
// cada pestana edita una parte del sitio
const PARTES = { diseno: 'tema', portada: 'portada', promos: 'promos' };
function parteActual(){ return PARTES[_vista] || 'tema'; }
function original(parte){ return parte === 'tema' ? validarTema(TEMA_BASE) : parte === 'portada' ? validarPortada({}) : validarPromos({}); }
// todo lo que impide publicar: contraste (Diseno) y promociones mal puestas
function problemasSitio(s){
  var out = problemasTema(s.tema).map(function(p){ return { vista: 'Diseño', texto: p.donde + ' (contraste ' + p.ratio + ', mínimo 4.5)' }; });
  var pr = s.promos;
  pr.ofertas.forEach(function(o){
    var r = state.inventario.find(function(x){ return x.id === o.id; });
    if(!r) out.push({ vista: 'Promociones', texto: 'Oferta de un reloj que ya no existe (quítala)' });
    else if(!(Number(r.precio) > 0)) out.push({ vista: 'Promociones', texto: 'Oferta en "' + r.nombre + '", que no tiene precio normal' });
    else if(!(o.precio < Number(r.precio))) out.push({ vista: 'Promociones', texto: 'La oferta de "' + r.nombre + '" (' + dinero(o.precio) + ') no es menor que su precio (' + dinero(r.precio) + ')' });
    if(o.hasta && o.hasta < hoy()) out.push({ vista: 'Promociones', texto: 'La oferta de "' + (r ? r.nombre : 'un reloj') + '" ya venció el ' + o.hasta });
  });
  pr.anuncios.forEach(function(a){ if(a.desde && a.hasta && a.hasta < a.desde) out.push({ vista: 'Promociones', texto: 'Anuncio "' + a.texto + '": la fecha de fin es antes que la de inicio' }); });
  var q = pr.popup;
  if(q.activo){
    if(!q.titulo && !q.texto) out.push({ vista: 'Promociones', texto: 'La ventana emergente está activa pero no tiene título ni texto' });
    if(q.destino === 'reloj' && !q.reloj) out.push({ vista: 'Promociones', texto: 'La ventana emergente lleva a un reloj, pero no elegiste cuál' });
    if(q.desde && q.hasta && q.hasta < q.desde) out.push({ vista: 'Promociones', texto: 'Ventana emergente: la fecha de fin es antes que la de inicio' });
  }
  return out;
}
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
  var parte = parteActual(), orig = original(parte);
  if(JSON.stringify(_borrador[parte]) === JSON.stringify(orig)) return;
  var preguntas = { tema: '¿Volver al diseño original de la tienda (glaciar)?', portada: '¿Volver la portada a como venía (orden, textos y relojes originales)?',
    promos: '¿Quitar todas las promociones (anuncios, ofertas, etiquetas, ventana emergente y mensajes)?' };
  if(!confirm(preguntas[parte] + ' Puedes deshacerlo antes de publicar.')) return;
  var s = copia(); s[parte] = orig; aplicarCambio(s);
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
  if(problemasSitio(_borrador).length){ alert('Corrige primero lo marcado en rojo arriba: hay cosas que no se pueden publicar así.'); return; }
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
  h += _vista === 'portada' ? htmlPortada() : _vista === 'promos' ? htmlPromos() : htmlDiseno();
  h += htmlHistorial();
  c.innerHTML = h;
  var probs = problemasSitio(_borrador);
  if(probs.length) c.insertAdjacentHTML('afterbegin', '<div class="fin-aviso ed-alerta"><span><b>No se puede publicar todavía:</b> ' + probs.map(function(p){ return '<b>' + esc(p.vista) + ':</b> ' + esc(p.texto); }).join(' · ') + '.</span></div>');
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
  var cambios = !iguales(_borrador, _publicado), probs = problemasSitio(_borrador).length;
  var estado = probs ? '<span class="ed-estado mal">Hay cosas por corregir</span>' : cambios ? '<span class="ed-estado pend">Cambios sin publicar</span>' : '<span class="ed-estado ok">Igual a la tienda</span>';
  var parte = parteActual();
  var esOriginal = JSON.stringify(_borrador[parte]) === JSON.stringify(original(parte));
  b.innerHTML = estado +
    '<input id="ed-nota" class="ed-nota" maxlength="80" placeholder="Nota (opcional): ej. colores de Navidad" value="' + esc(_nota) + '" oninput="notaTema(this.value)"' + (cambios ? '' : ' hidden') + '>' +
    '<div class="ed-barra-acc">' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="deshacerTema()"' + (_pila.length ? '' : ' disabled') + '>Deshacer</button>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="descartarTema()"' + (cambios ? '' : ' disabled') + '>Descartar</button>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="restaurarOriginal()"' + (esOriginal ? ' disabled' : '') + '>' + ({ tema: 'Diseño original', portada: 'Portada original', promos: 'Quitar promociones' })[parte] + '</button>' +
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

// ---------- Promociones (fase 3) ----------
function promo(f){ var s = copia(); f(s.promos); return s; }
function agregarAnuncio(){ if(_borrador.promos.anuncios.length >= MAX.anuncios){ alert('Puedes tener hasta ' + MAX.anuncios + ' anuncios.'); return; } aplicarCambio(promo(function(p){ p.anuncios.push({ texto: 'Nuevo anuncio', desde: '', hasta: '' }); })); }
function cambiarAnuncio(i, campo, v, vivo){ aplicarCambio(promo(function(p){ if(p.anuncios[i]) p.anuncios[i][campo] = v; }), vivo); }
function quitarAnuncio(i){ aplicarCambio(promo(function(p){ p.anuncios.splice(i, 1); })); }
function moverAnuncio(i, d){ aplicarCambio(promo(function(p){ var j = i + d; if(j < 0 || j >= p.anuncios.length) return; var x = p.anuncios[i]; p.anuncios[i] = p.anuncios[j]; p.anuncios[j] = x; })); }
function agregarOferta(id){
  if(!id) return; var r = state.inventario.find(function(x){ return x.id === id; }); if(!r) return;
  if(_borrador.promos.ofertas.length >= MAX.ofertas){ alert('Puedes tener hasta ' + MAX.ofertas + ' ofertas.'); pintar(); return; }
  // propuesta: 10 % menos, redondeado a dolares
  aplicarCambio(promo(function(p){ p.ofertas.push({ id: id, precio: Math.max(1, Math.floor(Number(r.precio) * 0.9)), hasta: '' }); }));
}
function cambiarOferta(i, campo, v, vivo){ aplicarCambio(promo(function(p){ if(p.ofertas[i]) p.ofertas[i][campo] = campo === 'precio' ? Number(String(v).replace(',', '.')) : v; }), vivo); }
function quitarOferta(i){ aplicarCambio(promo(function(p){ p.ofertas.splice(i, 1); })); }
function agregarEtiqueta(id){
  if(!id) return;
  if(_borrador.promos.etiquetas.length >= MAX.etiquetas){ alert('Puedes tener hasta ' + MAX.etiquetas + ' etiquetas.'); pintar(); return; }
  aplicarCambio(promo(function(p){ p.etiquetas.push({ id: id, texto: ETIQUETAS_LISTAS[0] }); }));
}
function cambiarEtiqueta(i, v, vivo){ aplicarCambio(promo(function(p){ if(p.etiquetas[i]) p.etiquetas[i].texto = v; }), vivo); }
function quitarEtiqueta(i){ aplicarCambio(promo(function(p){ p.etiquetas.splice(i, 1); })); }
function cambiarPopup(campo, v, vivo){ aplicarCambio(promo(function(p){ p.popup[campo] = v; }), vivo); }
function verPopup(){
  var q = _borrador.promos.popup;
  if(!q.titulo && !q.texto){ alert('Escribe primero el título o el texto de la ventana.'); return; }
  var f = el('ed-vista'); if(f && f.contentWindow) try{ f.contentWindow.postMessage({ tipo: 'aph-popup', promos: _borrador.promos }, location.origin); }catch(e){}
}
function cambiarWa(k, v, vivo){ aplicarCambio(promo(function(p){ if(v) p.wa[k] = v; else delete p.wa[k]; }), vivo); }
function insertarWa(k, marca){
  var t = el('ed-wa-' + k); if(!t) return;
  var a = t.selectionStart || t.value.length; t.value = t.value.slice(0, a) + marca + t.value.slice(t.selectionEnd || a);
  cambiarWa(k, t.value); setTimeout(function(){ var n = el('ed-wa-' + k); if(n){ n.focus(); n.selectionStart = n.selectionEnd = a + marca.length; } }, 30);
}
function opcionesRelojes(excluir, actual, conPrecio){
  return relojesElegibles().filter(function(x){ return (!excluir || excluir.indexOf(x.id) === -1) && (!conPrecio || Number(x.precio) > 0); })
    .map(function(x){ return '<option value="' + esc(x.id) + '"' + (x.id === actual ? ' selected' : '') + '>' + esc(etiquetaReloj(x)) + (conPrecio ? ' · ' + dinero(x.precio) : '') + '</option>'; }).join('');
}
function htmlPromos(){
  var p = _borrador.promos, h = '';
  // anuncios
  h += '<div class="card"><div class="card-title">Barra de anuncios</div><p class="ed-ayuda">Mensajes que van rotando cada 5 segundos en la barra de arriba. Con fechas, se muestran solo en esos días. Sin anuncios, la barra muestra su texto normal.</p>' +
    p.anuncios.map(function(a, i){
      return '<div class="ed-promo"><div class="ed-promo-cab"><span class="ed-num">' + (i + 1) + '</span>' +
        '<input maxlength="70" value="' + esc(a.texto) + '" oninput="cambiarAnuncio(' + i + ',\'texto\',this.value,1)" onchange="cambiarAnuncio(' + i + ',\'texto\',this.value)" aria-label="Texto del anuncio">' +
        '<button type="button" class="ed-mini-btn" onclick="moverAnuncio(' + i + ',-1)"' + (i ? '' : ' disabled') + ' aria-label="Subir">↑</button>' +
        '<button type="button" class="ed-mini-btn quitar" onclick="quitarAnuncio(' + i + ')" aria-label="Quitar">×</button></div>' +
        '<div class="ed-fechas"><label>Desde <input type="date" value="' + a.desde + '" onchange="cambiarAnuncio(' + i + ',\'desde\',this.value)"></label><label>Hasta <input type="date" value="' + a.hasta + '" onchange="cambiarAnuncio(' + i + ',\'hasta\',this.value)"></label></div></div>';
    }).join('') + (p.anuncios.length < MAX.anuncios ? '<button type="button" class="btn btn-outline btn-sm" onclick="agregarAnuncio()">+ Agregar anuncio</button>' : '') + '</div>';
  // ofertas
  var conOferta = p.ofertas.map(function(o){ return o.id; });
  h += '<div class="card"><div class="card-title">Ofertas</div><p class="ed-ayuda">El precio normal sale tachado, con el de oferta y el % de descuento, en el catálogo, el carrusel y la ficha. Google recibe el mismo precio. Con fecha de fin, se apaga sola.</p>' +
    p.ofertas.map(function(o, i){
      var r = state.inventario.find(function(x){ return x.id === o.id; }), normal = r ? Number(r.precio) || 0 : 0;
      var ok = r && normal > 0 && o.precio < normal, pct = ok ? Math.round((1 - o.precio / normal) * 100) : 0;
      return '<div class="ed-promo' + (ok ? '' : ' mal') + '"><div class="ed-promo-cab"><b>' + esc(r ? etiquetaReloj(r) : 'Reloj que ya no está') + '</b><button type="button" class="ed-mini-btn quitar" onclick="quitarOferta(' + i + ')" aria-label="Quitar">×</button></div>' +
        '<div class="ed-oferta"><span>Normal <b>' + (normal ? dinero(normal) : '—') + '</b></span>' +
        '<label>Oferta $ <input type="number" min="1" step="1" inputmode="decimal" value="' + o.precio + '" oninput="cambiarOferta(' + i + ',\'precio\',this.value,1)" onchange="cambiarOferta(' + i + ',\'precio\',this.value)"></label>' +
        '<span class="ed-pct' + (ok ? '' : ' mal') + '">' + (ok ? '-' + pct + '%' : 'Debe ser menor') + '</span>' +
        '<label>Hasta <input type="date" value="' + o.hasta + '" min="' + hoy() + '" onchange="cambiarOferta(' + i + ',\'hasta\',this.value)"></label></div></div>';
    }).join('') + '<select class="ed-agregar" onchange="agregarOferta(this.value)"><option value="">+ Poner en oferta un reloj…</option>' + opcionesRelojes(conOferta, '', true) + '</select></div>';
  // etiquetas
  var conEtq = p.etiquetas.map(function(e){ return e.id; });
  h += '<div class="card"><div class="card-title">Etiquetas en las tarjetas</div><p class="ed-ayuda">Una etiqueta sobre la foto del reloj (como "Nuevo"). Elige una de la lista o escribe la tuya.</p>' +
    p.etiquetas.map(function(e, i){
      var r = state.inventario.find(function(x){ return x.id === e.id; });
      return '<div class="ed-fila"><b>' + esc(r ? etiquetaReloj(r) : 'Reloj que ya no está') + '</b>' +
        '<input class="ed-etq" list="ed-etq-lista" maxlength="22" value="' + esc(e.texto) + '" oninput="cambiarEtiqueta(' + i + ',this.value,1)" onchange="cambiarEtiqueta(' + i + ',this.value)" aria-label="Texto de la etiqueta">' +
        '<button type="button" class="ed-mini-btn quitar" onclick="quitarEtiqueta(' + i + ')" aria-label="Quitar">×</button></div>';
    }).join('') + '<datalist id="ed-etq-lista">' + ETIQUETAS_LISTAS.map(function(t){ return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>' +
    '<select class="ed-agregar" onchange="agregarEtiqueta(this.value)"><option value="">+ Poner etiqueta a un reloj…</option>' + opcionesRelojes(conEtq, '') + '</select></div>';
  // ventana emergente
  var q = p.popup;
  h += '<div class="card"><div class="card-title">Ventana emergente</div><p class="ed-ayuda">Un aviso que aparece una sola vez a cada visitante (por ejemplo, una oferta o el boletín). Si cambias el texto, vuelve a salir una vez.</p>' +
    '<label class="ed-switch" style="margin-bottom:6px;"><input type="checkbox"' + (q.activo ? ' checked' : '') + ' onchange="cambiarPopup(\'activo\',this.checked)"><span></span>' + (q.activo ? 'Activa' : 'Apagada') + '</label>' +
    '<label class="ed-campo"><span>Título</span><input maxlength="50" value="' + esc(q.titulo) + '" placeholder="Ej: 10 % de descuento este fin de semana" oninput="cambiarPopup(\'titulo\',this.value,1)" onchange="cambiarPopup(\'titulo\',this.value)"></label>' +
    '<label class="ed-campo"><span>Texto</span><textarea rows="2" maxlength="220" placeholder="Ej: En todos los Invicta disponibles hasta el domingo." oninput="cambiarPopup(\'texto\',this.value,1)" onchange="cambiarPopup(\'texto\',this.value)">' + esc(q.texto) + '</textarea></label>' +
    '<label class="ed-campo"><span>Botón</span><input maxlength="24" value="' + esc(q.boton) + '" placeholder="Ej: Ver relojes" oninput="cambiarPopup(\'boton\',this.value,1)" onchange="cambiarPopup(\'boton\',this.value)"></label>' +
    '<label class="ed-campo"><span>El botón lleva a</span><select onchange="cambiarPopup(\'destino\',this.value)">' +
      [['catalogo', 'Todos los relojes'], ['reloj', 'Un reloj'], ['boletin', 'El boletín (suscribirse)'], ['ninguno', 'Sin botón']].map(function(o){ return '<option value="' + o[0] + '"' + (q.destino === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
    (q.destino === 'reloj' ? '<label class="ed-campo"><span>Reloj</span><select onchange="cambiarPopup(\'reloj\',this.value)"><option value="">Elige un reloj…</option>' + opcionesRelojes(null, q.reloj) + '</select></label>' : '') +
    '<label class="ed-campo"><span>Cuándo aparece</span><select onchange="cambiarPopup(\'momento\',this.value)"><option value="entrada"' + (q.momento === 'entrada' ? ' selected' : '') + '>Al entrar, después de unos segundos</option><option value="salida"' + (q.momento === 'salida' ? ' selected' : '') + '>Al intentar salir (en celular, después de un rato)</option></select></label>' +
    '<label class="ed-campo"><span>Segundos de espera: ' + q.segundos + '</span><input type="range" min="2" max="60" value="' + q.segundos + '" onchange="cambiarPopup(\'segundos\',this.value)"></label>' +
    '<div class="ed-fechas"><label>Desde <input type="date" value="' + q.desde + '" onchange="cambiarPopup(\'desde\',this.value)"></label><label>Hasta <input type="date" value="' + q.hasta + '" onchange="cambiarPopup(\'hasta\',this.value)"></label></div>' +
    '<button type="button" class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="verPopupTienda()">Ver la ventana en la vista previa</button></div>';
  // mensajes de WhatsApp
  h += '<div class="card"><div class="card-title">Mensajes de WhatsApp</div><p class="ed-ayuda">Lo que se escribe solo cuando un cliente toca el botón. Antes va el saludo ("¡Hola, Ana!") y después el enlace del reloj. Deja vacío para usar el mensaje de siempre.</p>' +
    [['comprar', 'Al tocar "Comprar por WhatsApp" (relojes disponibles)'], ['cotizar', 'Al tocar "Cotizar" (relojes bajo pedido)']].map(function(x){
      var k = x[0], v = p.wa[k] || '';
      return '<label class="ed-campo"><span>' + esc(x[1]) + '</span><textarea id="ed-wa-' + k + '" rows="3" maxlength="300" placeholder="' + esc(WA_BASE[k]) + '" oninput="cambiarWa(\'' + k + '\',this.value,1)" onchange="cambiarWa(\'' + k + '\',this.value)">' + esc(v) + '</textarea></label>' +
        '<div class="ed-chips" style="margin-top:6px;"><button type="button" class="fin-mes-btn" onclick="insertarWa(\'' + k + '\',\'{reloj}\')">+ nombre del reloj</button>' + (k === 'comprar' ? '<button type="button" class="fin-mes-btn" onclick="insertarWa(\'' + k + '\',\'{precio}\')">+ precio</button>' : '') + '</div>';
    }).join('') + '</div>';
  return h;
}

export { renderTienda };
// usadas desde atributos onclick/oninput del HTML
Object.assign(window, { agregarDestacadoTienda: agregarDestacado, borrarTemaGuardado: borrarTema, cambiarEnlaceTienda: cambiarEnlace, cambiarHex, cambiarTema, cambiarTextoTienda: cambiarTexto,
  contarTexto, descartarTema, deshacerTema, guardarComoTema, modoDestacadosTienda: modoDestacados, moverDestacadoTienda: moverDestacado, moverSeccionTienda: moverSeccion,
  notaTema, publicarTema, quitarDestacadoTienda: quitarDestacado, recargarVista, renderTienda, restaurarOriginal, usarTemaGuardado: usarGuardado, usarTemaListo: usarListo,
  usarVersionTema: usarVersion, verEnTienda: verEn, verSeccionTienda: verSeccion,
  agregarAnuncio, agregarEtiqueta, agregarOferta, cambiarAnuncio, cambiarEtiqueta, cambiarOferta, cambiarPopup, cambiarWa, insertarWa, moverAnuncio,
  quitarAnuncio, quitarEtiqueta, quitarOferta, verPopupTienda: verPopup });
