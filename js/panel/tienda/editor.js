// =================== TIENDA (editor de la tienda) ===================
// Fase 1 Diseno: colores, botones, esquinas de las fotos y tamano de los titulos.
// Fase 2 Portada: orden y visibilidad de las secciones, textos, relojes de "Mas vendidos" y a que reloj lleva
//   cada boton de "El futuro en tu muneca".
// Fase 3 Promociones: anuncios, ofertas, etiquetas, ventana emergente y mensajes de WhatsApp.
// Fase 4 Fotos y textos: fotos de la portada, Google y compartir, preguntas frecuentes y notas legales.
// Fase 5 Control: aviso de vacaciones, publicar en una fecha, enlace de vista previa y vistas/toques por seccion.
// Todo es un solo "sitio" { tema, portada, promos, contenido, control } con vista previa en vivo (la tienda real dentro de un marco, en
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
import { FOTOS, MAX as MAXC, SECCIONES_LEGAL, SEO_BASE, TEMAS_FAQ, claveFaq, validarContenido } from '../../sitio/contenido.js';
import { comprimirImg, leerImagen, subirArchivo } from '../inventario/fotos.js';
import { prepararFoto } from '../inventario/fondo.js';
import { MAX_VACACIONES, SECCIONES_CLICS, validarControl } from '../../sitio/control.js';
import { esPublicable } from '../../products.js';
import { esc } from '../componentes.js';
import { state } from '../state.js';

const API = 'https://api.aphillipsstore.com';
const CLAVE_BORRADOR = 'aph_editor_sitio';
// la tienda vive en / (en el servidor local de pruebas, en /catalogo.html)
const LOCAL = /^(localhost|127\.)/.test(location.hostname);
const TIENDA = LOCAL ? '/catalogo.html' : '/';
// paginas que se pueden ver en la vista previa (Contenido edita tambien Preguntas y Legal)
const PAGINAS = { inicio: TIENDA, preguntas: LOCAL ? '/preguntas.html' : '/preguntas', legal: LOCAL ? '/legal.html' : '/legal' };
const TEXTO_NUEVA = { p: 'Nueva pregunta', r: 'Escribe aquí la respuesta.' };
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
var _programado = null, _clics = null, _enlacePrevia = null, _fotosOrig = {}, _pagina = 'inicio', _faqOrig = null, _faqAbiertas = {}, _subiendoFoto = {};

function el(id){ return document.getElementById(id); }
function validarSitio(s){ s = s || {}; return { tema: validarTema(s.tema), portada: validarPortada(s.portada), promos: validarPromos(s.promos), contenido: validarContenido(s.contenido), control: validarControl(s.control) }; }
// cada pestana edita una parte del sitio
const PARTES = { diseno: 'tema', portada: 'portada', promos: 'promos', fotos: 'contenido', control: 'control' };
function parteActual(){ return PARTES[_vista] || 'tema'; }
function original(parte){ return parte === 'tema' ? validarTema(TEMA_BASE) : parte === 'portada' ? validarPortada({}) : parte === 'promos' ? validarPromos({}) : parte === 'control' ? validarControl({}) : validarContenido({}); }
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
  // contenido: preguntas nuevas sin terminar y textos para Google
  var c = s.contenido;
  c.faq.nuevas.forEach(function(n){
    if(n.p === TEXTO_NUEVA.p || n.r === TEXTO_NUEVA.r) out.push({ vista: 'Contenido', texto: 'Hay una pregunta nueva sin terminar (escribe la pregunta y su respuesta)' });
    else if(n.p.length < 8) out.push({ vista: 'Contenido', texto: 'La pregunta "' + n.p + '" es muy corta' });
  });
  if(c.seo.titulo && c.seo.titulo.length < 15) out.push({ vista: 'Contenido', texto: 'El título para Google es muy corto (mínimo 15 letras)' });
  if(c.seo.descripcion && c.seo.descripcion.length < 50) out.push({ vista: 'Contenido', texto: 'La descripción para Google es muy corta (mínimo 50 letras)' });
  var v = s.control.vacaciones;
  if(v.activo && !v.texto) out.push({ vista: 'Control', texto: 'El aviso de vacaciones está encendido pero no tiene texto' });
  if(v.desde && v.hasta && v.hasta < v.desde) out.push({ vista: 'Control', texto: 'Aviso de vacaciones: la fecha de fin es antes que la de inicio' });
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
    _historial = a.historial || []; _temas = b.temas || []; _programado = a.programado || null; _error = '';
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
    // fotos de siempre (en la tienda publicada, la original queda en data-orig)
    Object.keys(FOTOS).forEach(function(k){
      var e = d.querySelector(FOTOS[k][0]); if(!e) return;
      var src = e.getAttribute('data-orig') || e.getAttribute(e.tagName === 'SOURCE' ? 'srcset' : 'src') || '';
      if(src) _fotosOrig[k] = /^https:/.test(src) ? src : '/' + src.replace(/^\.?\//, '');
    });
    _originales = o; if(_vista === 'portada' || _vista === 'fotos') pintar();
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
    promos: '¿Quitar todas las promociones (anuncios, ofertas, etiquetas, ventana emergente y mensajes)?',
    contenido: '¿Volver a las fotos, textos para Google, preguntas y páginas legales originales?',
    control: '¿Quitar el aviso de vacaciones?' };
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
  if(!confirm('¿Publicar estos cambios en la tienda?\n\nLos clientes los verán en segundos. Si no te gustan, puedes volver a la versión anterior desde el historial.' +
    (_programado ? '\n\nOjo: hay una publicación programada para el ' + fechaCorta(_programado.cuando) + '. Cuando llegue esa hora reemplazará lo que publiques ahora (puedes cancelarla en Tienda > Control).' : ''))) return;
  _publicando = true; pintarBarra();
  try{
    var r = await pedir('/admin/sitio', { sitio: _borrador, nota: _nota.trim() });
    if(_meta.version) _historial.unshift(Object.assign({ version: _meta.version, fecha: _meta.fecha }, _publicado));
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
function recargarVista(){ var f = el('ed-vista'); if(f) f.src = PAGINAS[_pagina] + '?vista-previa=1&t=' + Date.now(); }
function verPagina(p){ if(!PAGINAS[p] || p === _pagina) return; _pagina = p; recargarVista(); pintar(); }

// ---------- pintar ----------
function fechaCorta(ms){ if(!ms) return ''; var d = new Date(ms); return d.toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }); }
function renderTienda(vista){
  if(vista) _vista = vista;
  // fuera de Contenido la vista previa vuelve a la portada
  if(_vista !== 'fotos' && _pagina !== 'inicio'){ _pagina = 'inicio'; recargarVista(); }
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
  h += _vista === 'portada' ? htmlPortada() : _vista === 'promos' ? htmlPromos() : _vista === 'fotos' ? htmlContenido() : _vista === 'control' ? htmlControl() : htmlDiseno();
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
      '<button type="button" class="btn btn-outline btn-sm" onclick="restaurarOriginal()"' + (esOriginal ? ' disabled' : '') + '>' + ({ tema: 'Diseño original', portada: 'Portada original', promos: 'Quitar promociones', contenido: 'Contenido original', control: 'Quitar aviso' })[parte] + '</button>' +
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

// ---------- Contenido (fase 4) ----------
function contenido(f){ var s = copia(); f(s.contenido); return s; }
// sube una foto a fotos.aphillipsstore.com/relojes/sitio/ (la limpieza nocturna no la borra)
async function subirFotoSitio(k, input){
  var archivo = input.files && input.files[0]; input.value = '';
  if(!archivo) return;
  if(!navigator.onLine){ alert('Necesitas internet para subir fotos.'); return; }
  _subiendoFoto[k] = true; pintar();
  try{
    var img = await leerImagen(archivo), w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var minimo = k === 'hero' || k === 'futPortada' || k === 'seo' ? 1000 : 600;
    if(Math.max(w, h) < minimo) throw new Error('La foto es muy pequeña (' + w + '×' + h + ' px); se vería borrosa. Usa una de al menos ' + minimo + ' px de lado.');
    var sinFondo = k === 'futFicha' && (el('ed-sinfondo') || {}).checked;
    if(sinFondo) img = prepararFoto(img).canvas;
    var blob = k === 'seo' ? await jpegCompartir(img) : await comprimirImg(img, sinFondo);
    var url = await subirArchivo(blob, 'sitio');
    _subiendoFoto[k] = false;
    aplicarCambio(contenido(function(c){ if(k === 'seo') c.seo.imagen = url; else c.fotos[k] = url; }));
  }catch(e){ _subiendoFoto[k] = false; pintar(); alert('No se pudo subir la foto: ' + e.message); }
}
// imagen para compartir: JPEG de 1200 px (WhatsApp no siempre muestra WebP)
function jpegCompartir(img){
  var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, 1200 / w);
  var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
  return new Promise(function(ok, mal){ c.toBlob(function(b){ b ? ok(b) : mal(new Error('No se pudo convertir la imagen')); }, 'image/jpeg', 0.85); });
}
function quitarFotoSitio(k){ aplicarCambio(contenido(function(c){ if(k === 'seo') delete c.seo.imagen; else delete c.fotos[k]; })); }
function cambiarSeo(k, v, vivo){ aplicarCambio(contenido(function(c){ if(v) c.seo[k] = v; else delete c.seo[k]; }), vivo); }
function cambiarFaq(clave, campo, v, vivo){
  aplicarCambio(contenido(function(c){
    var x = c.faq.cambios[clave] || {};
    if(campo === 'oculta'){ if(v) x.oculta = true; else delete x.oculta; } else { if(v) x.r = v; else delete x.r; }
    if(x.oculta || x.r) c.faq.cambios[clave] = x; else delete c.faq.cambios[clave];
  }), vivo);
}
function agregarPregunta(tema){
  if(_borrador.contenido.faq.nuevas.length >= MAXC.nuevas){ alert('Puedes agregar hasta ' + MAXC.nuevas + ' preguntas.'); return; }
  _faqAbiertas['nueva-' + _borrador.contenido.faq.nuevas.length] = true;
  aplicarCambio(contenido(function(c){ c.faq.nuevas.push({ tema: tema || 'comprar', p: TEXTO_NUEVA.p, r: TEXTO_NUEVA.r }); }));
}
function cambiarPregunta(i, campo, v, vivo){
  // vacio no se acepta (la pregunta se borraria sola): se vuelve al texto de ejemplo
  aplicarCambio(contenido(function(c){ if(c.faq.nuevas[i]) c.faq.nuevas[i][campo] = v || TEXTO_NUEVA[campo] || v; }), vivo);
}
function quitarPregunta(i){ if(!confirm('¿Quitar esta pregunta?')) return; aplicarCambio(contenido(function(c){ c.faq.nuevas.splice(i, 1); })); }
function faqAbierta(k, abierta){ if(abierta) _faqAbiertas[k] = true; else delete _faqAbiertas[k]; }
function cambiarLegal(k, v, vivo){ aplicarCambio(contenido(function(c){ if(v) c.legal[k] = v; else delete c.legal[k]; }), vivo); }

// preguntas tal como estan en la pagina (para editarlas, ocultarlas y mostrar la respuesta original)
function cargarFaq(){
  if(_faqOrig) return;
  _faqOrig = [];
  fetch(PAGINAS.preguntas, { cache: 'no-cache' }).then(function(r){ return r.text(); }).then(function(html){
    var d = new DOMParser().parseFromString(html, 'text/html');
    _faqOrig = Object.keys(TEMAS_FAQ).map(function(t){
      var sec = d.getElementById(t);
      return { tema: t, items: sec ? Array.prototype.map.call(sec.querySelectorAll('details.fq'), function(x){
        var p = x.querySelector('summary').textContent.trim(), div = x.querySelector('div');
        return { p: p, clave: claveFaq(p), r: div.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim(), enlaces: !!div.querySelector('a') };
      }) : [] };
    });
    if(_vista === 'fotos') pintar();
  }).catch(function(){});
}
function cajaFoto(k, nombre, ayuda, actual, extra){
  var cargando = _subiendoFoto[k];
  return '<div class="ed-foto">' +
    '<div class="ed-foto-img">' + (actual ? '<img src="' + esc(actual) + '" alt="">' : _fotosOrig[k] ? '<img src="' + esc(_fotosOrig[k]) + '" alt=""><em>Original</em>' : '<span>Original</span>') + '</div>' +
    '<div class="ed-foto-txt"><b>' + esc(nombre) + '</b><span>' + esc(ayuda) + '</span>' + (extra || '') +
      '<div class="ed-chips">' +
        '<label class="btn btn-outline btn-sm' + (cargando ? ' disabled' : '') + '">' + (cargando ? 'Subiendo…' : actual ? 'Cambiar' : 'Subir foto') +
          '<input type="file" accept="image/jpeg,image/png,image/webp" hidden' + (cargando ? ' disabled' : '') + ' onchange="subirFotoSitio(\'' + k + '\',this)"></label>' +
        (actual ? '<button type="button" class="btn btn-outline btn-sm" onclick="quitarFotoSitio(\'' + k + '\')">Usar la original</button>' : '') +
      '</div></div></div>';
}
function contador(id, v, max){ return '<span class="ed-cuenta" id="' + id + '">' + String(v || '').length + '/' + max + '</span>'; }
function htmlContenido(){
  var c = _borrador.contenido, h = '';
  cargarFaq();
  h += '<div class="card"><div class="card-title">Ver en la vista previa</div><div class="ed-chips">' +
    [['inicio', 'Portada'], ['preguntas', 'Preguntas frecuentes'], ['legal', 'Información legal']].map(function(x){
      return '<button type="button" class="fin-mes-btn' + (_pagina === x[0] ? ' active' : '') + '" onclick="verPaginaTienda(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div></div>';
  // fotos
  h += '<div class="card"><div class="card-title">Fotos de la portada</div><p class="ed-ayuda">Sube JPG, PNG o WebP. Se achican solas para que la tienda cargue rápido. "Usar la original" vuelve a la foto de siempre.</p>' +
    Object.keys(FOTOS).map(function(k){
      var extra = k === 'futFicha' ? '<label class="ed-check" style="margin:6px 0 0;"><input type="checkbox" id="ed-sinfondo" checked> Quitar el fondo blanco al subir</label>' : '';
      return cajaFoto(k, FOTOS[k][1], FOTOS[k][2], c.fotos[k], extra);
    }).join('') + '</div>';
  // google y compartir
  var titulo = c.seo.titulo || SEO_BASE.titulo, desc = c.seo.descripcion || SEO_BASE.descripcion;
  h += '<div class="card"><div class="card-title">Google y al compartir</div><p class="ed-ayuda">Cómo aparece la tienda en Google y cuando alguien manda el enlace por WhatsApp o Facebook. Vacío = el texto de siempre.</p>' +
    '<label class="ed-campo"><span>Título ' + contador('ed-c-titulo', c.seo.titulo, MAXC.titulo) + '</span><input maxlength="' + MAXC.titulo + '" value="' + esc(c.seo.titulo || '') + '" placeholder="' + esc(SEO_BASE.titulo) + '" oninput="cambiarSeo(\'titulo\',this.value,1);el_cuenta(\'ed-c-titulo\',this,' + MAXC.titulo + ')" onchange="cambiarSeo(\'titulo\',this.value)"></label>' +
    '<label class="ed-campo"><span>Descripción ' + contador('ed-c-desc', c.seo.descripcion, MAXC.descripcion) + '</span><textarea rows="3" maxlength="' + MAXC.descripcion + '" placeholder="' + esc(SEO_BASE.descripcion) + '" oninput="cambiarSeo(\'descripcion\',this.value,1);el_cuenta(\'ed-c-desc\',this,' + MAXC.descripcion + ')" onchange="cambiarSeo(\'descripcion\',this.value)">' + esc(c.seo.descripcion || '') + '</textarea></label>' +
    cajaFoto('seo', 'Imagen al compartir', 'Horizontal (1200 × 630 se ve mejor). Sale en WhatsApp, Facebook e Instagram.', c.seo.imagen) +
    '<div class="ed-google"><span>aphillipsstore.com</span><b>' + esc(titulo) + '</b><p>' + esc(desc) + '</p></div>' +
    '<p class="ed-ayuda" style="margin:8px 0 0;">Google tarda unos días en mostrar el texto nuevo.</p></div>';
  // preguntas frecuentes
  h += '<div class="card"><div class="card-title">Preguntas frecuentes</div><p class="ed-ayuda">Toca una pregunta para cambiar su respuesta u ocultarla. Usa **texto** para negrita. Respuesta vacía = la original.</p>';
  if(!_faqOrig || !_faqOrig.length) h += '<p class="ed-ayuda">Cargando las preguntas…</p>';
  else _faqOrig.forEach(function(g){
    var nuevas = c.faq.nuevas.map(function(n, i){ return { n: n, i: i }; }).filter(function(x){ return x.n.tema === g.tema; });
    h += '<div class="ed-faq-tema"><b>' + esc(TEMAS_FAQ[g.tema]) + '</b>' +
      g.items.map(function(q){
        var cam = c.faq.cambios[q.clave] || {}, k = 'f-' + q.clave;
        return '<details class="ed-faq' + (cam.oculta ? ' apagada' : '') + (cam.r ? ' editada' : '') + '"' + (_faqAbiertas[k] ? ' open' : '') + ' ontoggle="faqAbiertaTienda(\'' + k + '\',this.open)"><summary>' + esc(q.p) +
          (cam.oculta ? ' <i>Oculta</i>' : cam.r ? ' <i>Cambiada</i>' : '') + '</summary>' +
          '<label class="ed-check"><input type="checkbox"' + (cam.oculta ? ' checked' : '') + ' onchange="cambiarFaqTienda(\'' + q.clave + '\',\'oculta\',this.checked)"> Ocultar esta pregunta</label>' +
          '<textarea rows="4" maxlength="' + MAXC.respuesta + '" placeholder="' + esc(q.r) + '" oninput="cambiarFaqTienda(\'' + q.clave + '\',\'r\',this.value,1)" onchange="cambiarFaqTienda(\'' + q.clave + '\',\'r\',this.value)">' + esc(cam.r || '') + '</textarea>' +
          (q.enlaces ? '<p class="ed-ayuda" style="margin:4px 0 0;">La respuesta original tiene enlaces; si la cambias, quedan como texto.</p>' : '') + '</details>';
      }).join('') +
      nuevas.map(function(x){
        var k = 'nueva-' + x.i;
        return '<details class="ed-faq nueva"' + (_faqAbiertas[k] ? ' open' : '') + ' ontoggle="faqAbiertaTienda(\'' + k + '\',this.open)"><summary>' + esc(x.n.p) + ' <i>Nueva</i></summary>' +
          '<label class="ed-campo"><span>Pregunta</span><input maxlength="' + MAXC.pregunta + '" value="' + esc(x.n.p === TEXTO_NUEVA.p ? '' : x.n.p) + '" placeholder="Ej: ¿Hacen envíos el mismo día?" onchange="cambiarPreguntaTienda(' + x.i + ',\'p\',this.value)"></label>' +
          '<label class="ed-campo"><span>Respuesta</span><textarea rows="4" maxlength="' + MAXC.respuesta + '" placeholder="Escribe la respuesta" oninput="if(this.value)cambiarPreguntaTienda(' + x.i + ',\'r\',this.value,1)" onchange="cambiarPreguntaTienda(' + x.i + ',\'r\',this.value)">' + esc(x.n.r === TEXTO_NUEVA.r ? '' : x.n.r) + '</textarea></label>' +
          '<label class="ed-campo"><span>Tema</span><select onchange="cambiarPreguntaTienda(' + x.i + ',\'tema\',this.value)">' + Object.keys(TEMAS_FAQ).map(function(t){ return '<option value="' + t + '"' + (t === x.n.tema ? ' selected' : '') + '>' + esc(TEMAS_FAQ[t]) + '</option>'; }).join('') + '</select></label>' +
          '<button type="button" class="btn btn-outline btn-sm" onclick="quitarPreguntaTienda(' + x.i + ')">Quitar pregunta</button></details>';
      }).join('') +
      '<button type="button" class="ed-mas" onclick="agregarPreguntaTienda(\'' + g.tema + '\')">+ Agregar pregunta en ' + esc(TEMAS_FAQ[g.tema]) + '</button></div>';
  });
  h += '</div>';
  // legal
  h += '<div class="card"><div class="card-title">Información legal</div><p class="ed-ayuda">Agrega una nota al final de cualquier sección (por ejemplo, un cambio en la garantía). El texto legal de siempre no se toca.</p>' +
    Object.keys(SECCIONES_LEGAL).map(function(k){
      return '<label class="ed-campo"><span>' + esc(SECCIONES_LEGAL[k]) + '</span><textarea rows="2" maxlength="' + MAXC.nota + '" placeholder="Sin nota" oninput="cambiarLegalTienda(\'' + k + '\',this.value,1)" onchange="cambiarLegalTienda(\'' + k + '\',this.value)">' + esc(c.legal[k] || '') + '</textarea></label>';
    }).join('') + '</div>';
  return h;
}
function el_cuenta(id, input, max){ var e = el(id); if(e) e.textContent = input.value.length + '/' + max; }

// ---------- Control (fase 5) ----------
function cambiarVacaciones(campo, v, vivo){ var x = copia(); x.control.vacaciones[campo] = v; aplicarCambio(x, vivo); }
function aFechaLocal(ms){ var d = new Date(ms - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
async function programar(){
  var input = el('ed-cuando'), cuando = input && input.value ? new Date(input.value).getTime() : NaN;
  if(!(cuando > Date.now() + 5 * 60000)){ alert('Elige una fecha y hora al menos 5 minutos en el futuro.'); return; }
  if(cuando > Date.now() + 89 * 86400000){ alert('Solo se puede programar hasta 3 meses adelante.'); return; }
  if(problemasSitio(_borrador).length){ alert('Corrige primero lo marcado en rojo arriba.'); return; }
  if(iguales(_borrador, _publicado)){ alert('No hay cambios para programar: lo que tienes es igual a lo que se ve hoy.'); return; }
  if(!confirm('¿Publicar estos cambios automáticamente el ' + fechaCorta(cuando) + '?' + (_programado ? '\n\nReemplaza la publicación programada para el ' + fechaCorta(_programado.cuando) + '.' : ''))) return;
  try{
    var r = await pedir('/admin/sitio/programar', { sitio: _borrador, cuando: cuando, nota: _nota.trim() || 'Programada' });
    _programado = r.programado; pintar();
    if(window.toastPanel) window.toastPanel('Listo: se publicará solo el ' + fechaCorta(cuando) + '.');
  }catch(e){ alert('No se pudo programar: ' + e.message); }
}
async function cancelarProgramado(){
  if(!_programado || !confirm('¿Cancelar la publicación programada para el ' + fechaCorta(_programado.cuando) + '?')) return;
  try{ await pedir('/admin/sitio/programar', { cancelar: true }); _programado = null; pintar(); }catch(e){ alert('No se pudo cancelar: ' + e.message); }
}
function verProgramado(){ if(_programado && confirm('¿Cargar en el editor los cambios programados? Reemplaza lo que tienes sin publicar (puedes deshacerlo).')) aplicarCambio(validarSitio(_programado.sitio)); }
async function crearEnlacePrevia(){
  if(problemasSitio(_borrador).length){ alert('Corrige primero lo marcado en rojo arriba.'); return; }
  try{
    var r = await pedir('/admin/sitio/previa', { sitio: _borrador });
    _enlacePrevia = { url: 'https://aphillipsstore.com/?vista=' + r.codigo, vence: r.vence }; pintar();
  }catch(e){ alert('No se pudo crear el enlace: ' + e.message); }
}
function copiarEnlacePrevia(){
  if(!_enlacePrevia) return;
  var ok = function(){ if(window.toastPanel) window.toastPanel('Enlace copiado.'); };
  if(navigator.clipboard) navigator.clipboard.writeText(_enlacePrevia.url).then(ok, function(){ var i = el('ed-enlace'); if(i){ i.select(); } });
  else { var i = el('ed-enlace'); if(i) i.select(); }
}
async function cargarClics(){
  try{ _clics = (await pedir('/admin/sitio/clics')).secciones || {}; }catch(e){ _clics = { _error: e.message }; }
  if(_vista === 'control') pintar();
}
function htmlControl(){
  var v = _borrador.control.vacaciones, h = '';
  // vacaciones
  h += '<div class="card"><div class="card-title">Aviso de vacaciones</div><p class="ed-ayuda">Una franja arriba en todas las páginas y una nota junto al botón de WhatsApp de cada reloj. Con fechas, se prende y se apaga sola.</p>' +
    '<label class="ed-switch" style="margin-bottom:6px;"><input type="checkbox"' + (v.activo ? ' checked' : '') + ' onchange="cambiarVacaciones(\'activo\',this.checked)"><span></span>' + (v.activo ? 'Encendido' : 'Apagado') + '</label>' +
    '<label class="ed-campo"><span>Texto ' + contador('ed-c-vac', v.texto, MAX_VACACIONES) + '</span><textarea rows="2" maxlength="' + MAX_VACACIONES + '" placeholder="Ej: Estamos de vacaciones hasta el 5 de enero. Puedes escribirnos y te respondemos al volver." oninput="cambiarVacaciones(\'texto\',this.value,1);el_cuenta(\'ed-c-vac\',this,' + MAX_VACACIONES + ')" onchange="cambiarVacaciones(\'texto\',this.value)">' + esc(v.texto) + '</textarea></label>' +
    '<div class="ed-fechas"><label>Desde <input type="date" value="' + v.desde + '" onchange="cambiarVacaciones(\'desde\',this.value)"></label><label>Hasta <input type="date" value="' + v.hasta + '" onchange="cambiarVacaciones(\'hasta\',this.value)"></label></div>' +
    '<p class="ed-ayuda" style="margin:8px 0 0;">Se publica con el botón Publicar, como lo demás.</p></div>';
  // programar
  var cambios = !iguales(_borrador, _publicado), probs = problemasSitio(_borrador).length;
  h += '<div class="card"><div class="card-title">Publicar en una fecha</div><p class="ed-ayuda">Deja listos tus cambios (de todas las pestañas) y elige cuándo salen. Por ejemplo, el tema de Navidad el 1 de diciembre a las 6:00 a. m.</p>' +
    (_programado ? '<div class="ed-prog"><span><b>Programada:</b> ' + esc(fechaCorta(_programado.cuando)) + (_programado.nota ? ' · ' + esc(_programado.nota) : '') + '</span>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="verProgramadoTienda()">Ver en el editor</button><button type="button" class="btn btn-outline btn-sm" onclick="cancelarProgramadoTienda()">Cancelar</button></div>' : '') +
    '<div class="ed-guardar"><input type="datetime-local" id="ed-cuando" min="' + aFechaLocal(Date.now() + 6 * 60000) + '" max="' + aFechaLocal(Date.now() + 89 * 86400000) + '">' +
    '<button type="button" class="btn btn-outline btn-sm" onclick="programarTienda()"' + (cambios && !probs ? '' : ' disabled') + '>' + (_programado ? 'Reprogramar con estos cambios' : 'Programar estos cambios') + '</button></div>' +
    (!cambios ? '<p class="ed-ayuda" style="margin:6px 0 0;">Haz algún cambio en las otras pestañas para poder programarlo.</p>' : '') + '</div>';
  // enlace de vista previa
  h += '<div class="card"><div class="card-title">Enlace de vista previa</div><p class="ed-ayuda">Un enlace para que otra persona vea tus cambios en su celular antes de publicarlos. Dura 7 días y los clientes no lo ven.</p>' +
    (_enlacePrevia ? '<div class="ed-guardar"><input id="ed-enlace" readonly value="' + esc(_enlacePrevia.url) + '" onclick="this.select()"><button type="button" class="btn btn-outline btn-sm" onclick="copiarEnlacePrevia()">Copiar</button></div>' +
      '<p class="ed-ayuda" style="margin:6px 0 10px;">Vence el ' + esc(fechaCorta(_enlacePrevia.vence)) + '. Si sigues cambiando cosas, crea otro.</p>' : '') +
    '<button type="button" class="btn btn-outline btn-sm" onclick="crearEnlacePrevia()"' + (probs ? ' disabled' : '') + '>' + (_enlacePrevia ? 'Crear otro enlace' : 'Crear enlace') + '</button></div>';
  // clics por seccion
  if(_clics === null){ _clics = {}; cargarClics(); }
  var filas = Object.keys(SECCIONES_CLICS).map(function(k){ var x = _clics[k] || { vistas: 0, clics: 0 }; return { k: k, n: SECCIONES_CLICS[k], v: x.vistas || 0, c: x.clics || 0 }; });
  var maxV = Math.max(1, Math.max.apply(null, filas.map(function(f){ return f.v; })));
  h += '<div class="card"><div class="card-title">Qué miran y qué tocan</div><p class="ed-ayuda">Cuántas visitas vieron cada sección de la portada y cuántas tocaron algo dentro. Sirve para saber qué ordenar arriba (en Portada).</p>' +
    (_clics._error ? '<p class="ed-ayuda">No se pudo leer (' + esc(_clics._error) + ').</p>' :
      '<div class="ed-clics">' + filas.map(function(f){
        var pct = f.v ? Math.round(f.c / f.v * 100) : 0;
        return '<div class="ed-clic"><b>' + esc(f.n) + '</b><span class="ed-clic-barra"><i style="width:' + Math.round(f.v / maxV * 100) + '%"></i></span><span>' + f.v.toLocaleString('es-PA') + ' vistas</span><span>' + f.c.toLocaleString('es-PA') + ' toques</span><em>' + (f.v ? pct + ' %' : '—') + '</em></div>';
      }).join('') + '</div>') +
    '<button type="button" class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="actualizarClics()">Actualizar</button>' +
    '<p class="ed-ayuda" style="margin:6px 0 0;">Empieza a contar desde que se publica esta función. Tus visitas desde el panel no cuentan.</p></div>';
  return h;
}
function actualizarClics(){ _clics = {}; cargarClics(); }

export { renderTienda };
// usadas desde atributos onclick/oninput del HTML
Object.assign(window, { agregarDestacadoTienda: agregarDestacado, borrarTemaGuardado: borrarTema, cambiarEnlaceTienda: cambiarEnlace, cambiarHex, cambiarTema, cambiarTextoTienda: cambiarTexto,
  contarTexto, descartarTema, deshacerTema, guardarComoTema, modoDestacadosTienda: modoDestacados, moverDestacadoTienda: moverDestacado, moverSeccionTienda: moverSeccion,
  notaTema, publicarTema, quitarDestacadoTienda: quitarDestacado, recargarVista, renderTienda, restaurarOriginal, usarTemaGuardado: usarGuardado, usarTemaListo: usarListo,
  usarVersionTema: usarVersion, verEnTienda: verEn, verSeccionTienda: verSeccion,
  agregarAnuncio, agregarEtiqueta, agregarOferta, cambiarAnuncio, cambiarEtiqueta, cambiarOferta, cambiarPopup, cambiarWa, insertarWa, moverAnuncio,
  quitarAnuncio, quitarEtiqueta, quitarOferta, verPopupTienda: verPopup,
  agregarPreguntaTienda: agregarPregunta, cambiarFaqTienda: cambiarFaq, cambiarLegalTienda: cambiarLegal, cambiarPreguntaTienda: cambiarPregunta, cambiarSeo,
  el_cuenta, faqAbiertaTienda: faqAbierta, quitarFotoSitio, quitarPreguntaTienda: quitarPregunta, subirFotoSitio, verPaginaTienda: verPagina,
  actualizarClics, cambiarVacaciones, cancelarProgramadoTienda: cancelarProgramado, copiarEnlacePrevia, crearEnlacePrevia, programarTienda: programar, verProgramadoTienda: verProgramado });
