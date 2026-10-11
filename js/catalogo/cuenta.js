// =================== MI CUENTA (clientes del catalogo) ===================
// Login con Google (Firebase Auth). El SDK de Firebase solo se descarga cuando hace falta: al abrir
// "Mi cuenta" o si el cliente ya habia iniciado sesion en este navegador.
// Con la sesion: favoritos en la nube, avisos por WhatsApp ("Avisame cuando llegue"), compras y
// apartados, y mensajes de WhatsApp con su nombre. La cuenta del dueno ve ademas el acceso al panel,
// las metricas y las opciones de desarrollador.
// SEGURIDAD: aqui solo se decide que se MUESTRA. El Worker (api.aphillipsstore.com) verifica el
// token de cada peticion: un cliente solo puede leer o cambiar SUS datos, y el panel y las rutas de
// admin solo aceptan el UID del dueno.
import { buscadorAbierto, toggleBuscador } from './buscador.js';
import { relojes } from './datos.js';
import { _favoritos, abrirFavoritos, alCambiarFavoritos, cerrarFavoritos, reemplazarFavoritos } from './favoritos.js';
import { sesion, tieneAviso } from './sesion.js';
import { _destEsc as esc, toast } from './ui.js';

const API = 'https://api.aphillipsstore.com';
const SDK = ['https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js',
             'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth-compat.js'];
const MARCAS = { invicta: 'Invicta', bulova: 'Bulova', technomarine: 'TechnoMarine' };
const CLAVE_SESION = 'aphillips_sesion';
const CLAVE_NO_CONTAR = 'aphillips_no_contar';

let _fb = null;              // promesa con window.firebase ya iniciado
let _cargando = false;       // esperando la respuesta de /cuenta
let _mensaje = '';           // aviso arriba del panel (p. ej. "Inicia sesion para recibir avisos")
let _pendiente = null;       // aviso que el cliente pidio antes de entrar o de poner su WhatsApp
let _compras = null;         // respuesta de /cuenta/compras
let _admin = null;           // datos de la seccion del administrador

// ---------- Firebase (solo Auth) ----------
function cargarScript(src){
  return new Promise(function(res, rej){
    if(document.querySelector('script[src="'+src+'"]')) return res();
    var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error('No se pudo cargar '+src)); };
    document.head.appendChild(s);
  });
}
function cargarFirebase(){
  if(_fb) return _fb;
  _fb = (async function(){
    for(var i = 0; i < SDK.length; i++) await cargarScript(SDK[i]);
    var m = await import('../firebase.js');
    m.firebase.auth().onAuthStateChanged(alCambiarSesion);
    return m.firebase;
  })();
  _fb.catch(function(){ _fb = null; });
  return _fb;
}
async function pedir(ruta, opciones){
  var fb = await cargarFirebase();
  var u = fb.auth().currentUser;
  if(!u) throw new Error('Inicia sesion de nuevo');
  opciones = opciones || {};
  opciones.headers = Object.assign({ 'Authorization': 'Bearer ' + await u.getIdToken() }, opciones.headers || {});
  if(opciones.body && typeof opciones.body !== 'string'){ opciones.body = JSON.stringify(opciones.body); opciones.headers['Content-Type'] = 'application/json'; }
  var r = await fetch(API + ruta, opciones);
  var d = {}; try{ d = await r.json(); }catch(e){}
  if(!r.ok){ var err = new Error(d.error || ('Error ' + r.status)); err.datos = d; throw err; }
  return d;
}

// ---------- sesion ----------
async function alCambiarSesion(user){
  if(user && !user.isAnonymous){
    try{ localStorage.setItem(CLAVE_SESION, '1'); }catch(e){}
    _cargando = true; render();
    try{
      var d = await pedir('/cuenta');
      sesion.activa = true; sesion.perfil = d.perfil; sesion.avisos = d.avisos || []; sesion.esAdmin = !!d.esAdmin;
      sesion.vinculado = !!d.vinculado;
      // la cuenta del dueno no suma visitas en las metricas (se puede cambiar en opciones de desarrollador)
      if(sesion.esAdmin){ try{ if(localStorage.getItem(CLAVE_NO_CONTAR) === null) localStorage.setItem(CLAVE_NO_CONTAR, '1'); }catch(e){} }
      await unirFavoritos(d.favoritos || []);
      if(_pendiente && sesion.perfil.telefono){ var p = _pendiente; _pendiente = null; await activarAviso(p.tipo, p.valor); }
    }catch(e){
      _mensaje = 'No se pudo cargar tu cuenta: ' + e.message;
    }
    _cargando = false;
  }else{
    sesion.activa = false; sesion.perfil = null; sesion.avisos = []; sesion.esAdmin = false; sesion.vinculado = false;
    _compras = null; _admin = null;
    try{ localStorage.removeItem(CLAVE_SESION); }catch(e){}
  }
  marcarBotonCuenta();
  avisarCambio();
  render();
}
function avisarCambio(){ document.dispatchEvent(new CustomEvent('sesion-cambiada')); }
function marcarBotonCuenta(){
  document.querySelectorAll('[onclick^="abrirCuenta"]').forEach(function(b){ b.classList.toggle('con-sesion', sesion.activa); });
}

async function entrarConGoogle(){
  _mensaje = '';
  var fb, prov;
  try{
    fb = await cargarFirebase();
    prov = new fb.auth.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: 'select_account' });
    await fb.auth().signInWithPopup(prov);
  }catch(e){
    var c = e && e.code;
    if(c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment'){
      try{ await fb.auth().signInWithRedirect(prov); return; }catch(e2){ c = e2.code; }
    }
    if(c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return;
    if(c === 'auth/operation-not-allowed') _mensaje = 'El inicio de sesion con Google aun no esta activado. Intentalo mas tarde.';
    else if(c === 'auth/unauthorized-domain') _mensaje = 'Este sitio todavia no esta autorizado para iniciar sesion. Intentalo mas tarde.';
    else if(c === 'auth/network-request-failed') _mensaje = 'Sin conexion. Revisa tu internet e intenta de nuevo.';
    else _mensaje = 'No se pudo iniciar sesion. Intenta de nuevo.';
    render();
  }
}
async function cerrarSesionCliente(){
  try{ (await cargarFirebase()).auth().signOut(); }catch(e){}
  toast('Sesion cerrada');
}
async function eliminarCuenta(){
  if(!confirm('Se borraran tu cuenta, tus favoritos guardados en la nube y tus avisos. Continuar?')) return;
  try{
    await pedir('/cuenta', { method: 'DELETE' });
    var fb = await cargarFirebase();
    try{ await fb.auth().currentUser.delete(); }catch(e){ await fb.auth().signOut(); }
    toast('Tu cuenta fue eliminada');
  }catch(e){ alert('No se pudo eliminar la cuenta: ' + e.message); }
}

// ---------- favoritos en la nube ----------
let _timerFav = null;
async function unirFavoritos(enNube){
  var union = Array.from(new Set(enNube.concat(Array.from(_favoritos))));
  reemplazarFavoritos(union);
  if(union.length !== enNube.length) await subirFavoritos();
}
function subirFavoritos(){
  if(!sesion.activa) return Promise.resolve();
  return pedir('/cuenta/favoritos', { method: 'PUT', body: { ids: Array.from(_favoritos) } }).catch(function(){});
}
alCambiarFavoritos(function(){
  if(!sesion.activa) return;
  clearTimeout(_timerFav);
  _timerFav = setTimeout(subirFavoritos, 800);
});

// ---------- perfil ----------
async function guardarPerfil(ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  var nombre = document.getElementById('cta-nombre').value;
  var telefono = document.getElementById('cta-tel').value;
  var btn = document.getElementById('cta-guardar');
  if(btn){ btn.disabled = true; btn.textContent = 'Guardando...'; }
  try{
    var d = await pedir('/cuenta/perfil', { method: 'PUT', body: { nombre: nombre, telefono: telefono } });
    sesion.perfil.nombre = d.perfil.nombre; sesion.perfil.telefono = d.perfil.telefono;
    _mensaje = '';
    toast('Datos guardados');
    avisarCambio();
    if(_pendiente && sesion.perfil.telefono){ var p = _pendiente; _pendiente = null; await activarAviso(p.tipo, p.valor); }
  }catch(e){ _mensaje = e.message; }
  render();
  return false;
}

// ---------- avisos ("Avisame cuando llegue") ----------
async function toggleAviso(tipo, valor){
  if(!sesion.activa){
    _pendiente = { tipo: tipo, valor: valor };
    _mensaje = 'Inicia sesion para que te avisemos por WhatsApp.';
    abrirCuenta();
    return;
  }
  if(tieneAviso(tipo, valor)){
    try{
      await pedir('/cuenta/avisos?tipo=' + encodeURIComponent(tipo) + '&valor=' + encodeURIComponent(valor), { method: 'DELETE' });
      sesion.avisos = sesion.avisos.filter(function(a){ return !(a.tipo === tipo && a.valor === valor); });
      toast('Aviso quitado');
    }catch(e){ toast('No se pudo quitar el aviso'); }
    avisarCambio(); render();
    return;
  }
  await activarAviso(tipo, valor);
}
async function activarAviso(tipo, valor){
  try{
    await pedir('/cuenta/avisos', { method: 'POST', body: { tipo: tipo, valor: valor } });
    sesion.avisos.unshift({ tipo: tipo, valor: valor, creado: Date.now() });
    toast('Listo, te avisaremos por WhatsApp');
  }catch(e){
    if(e.datos && e.datos.falta === 'telefono'){
      _pendiente = { tipo: tipo, valor: valor };
      _mensaje = 'Agrega tu WhatsApp para poder avisarte.';
      abrirCuenta();
      setTimeout(function(){ var t = document.getElementById('cta-tel'); if(t) t.focus(); }, 450);
    }else toast(e.message);
  }
  avisarCambio(); render();
}
function textoAviso(a){
  if(a.tipo === 'marca') return 'Nuevos ingresos de ' + (MARCAS[a.valor] || a.valor);
  var r = relojes.find(function(x){ return x.id === a.valor; });
  return r ? (r.nombre || 'Reloj') : 'Reloj que ya no esta en el catalogo';
}

// Boton "Avisame" en la pagina de un reloj
let _relojAbierto = null;
function pintarAvisoReloj(){
  var b = document.getElementById('modal-aviso');
  var r = _relojAbierto;
  if(!b || !r) return;
  var activo = sesion.activa && tieneAviso('reloj', r.id);
  var texto = r.estado === 'disponible' ? 'Avísame si baja de precio' : (r.estado === 'vendido' ? 'Avísame si vuelve a llegar' : 'Avísame cuando esté disponible');
  b.classList.toggle('activo', activo);
  b.querySelector('span').textContent = activo ? '✓ Te avisaremos por WhatsApp' : texto;
  b.onclick = function(){ toggleAviso('reloj', r.id); };
}
document.addEventListener('reloj-abierto', function(e){ _relojAbierto = e.detail; pintarAvisoReloj(); });
// Boton "Avisame de nuevos ..." en la pagina de una marca
let _marcaActual = '';
function pintarAvisoMarca(){
  var b = document.getElementById('btn-aviso-marca');
  if(!b) return;
  b.hidden = !_marcaActual;
  if(!_marcaActual) return;
  var activo = sesion.activa && tieneAviso('marca', _marcaActual);
  b.classList.toggle('activo', activo);
  b.querySelector('span').textContent = activo ? '✓ Te avisaremos de nuevos ' + MARCAS[_marcaActual] : 'Avísame de nuevos ' + MARCAS[_marcaActual];
  b.onclick = function(){ toggleAviso('marca', _marcaActual); };
}
document.addEventListener('marca-cambiada', function(e){ _marcaActual = e.detail || ''; pintarAvisoMarca(); });
document.addEventListener('sesion-cambiada', function(){ pintarAvisoReloj(); pintarAvisoMarca(); });

// ---------- compras y apartados ----------
async function cargarCompras(){
  try{ _compras = await pedir('/cuenta/compras'); }catch(e){ _compras = { error: e.message }; }
  render();
}
function htmlCompras(){
  if(!_compras) return '<p class="cta-texto">Cargando...</p>';
  if(_compras.error) return '<p class="cta-texto">No se pudo cargar: ' + esc(_compras.error) + '</p>';
  if(!_compras.vinculado || (!_compras.compras.length && !_compras.apartados.length)){
    return '<p class="cta-texto">Cuando compres o apartes un reloj con nosotros, aquí verás tu historial y cuánto te falta pagar.</p>';
  }
  var h = '';
  _compras.apartados.forEach(function(a){
    h += '<div class="cta-item">' + (a.foto ? '<img src="' + esc(a.foto) + '" alt="" onerror="this.remove()">' : '') +
      '<div><b>Apartado: ' + esc(a.reloj) + '</b><span>Abonado $' + a.abonado.toLocaleString() + ' de $' + a.precioAcordado.toLocaleString() +
      ' · <strong>Te falta $' + a.saldo.toLocaleString() + '</strong></span></div></div>';
  });
  _compras.compras.forEach(function(c){
    h += '<div class="cta-item"><div><b>' + (c.tipo === 'abono' ? 'Abono' : 'Compra') + ' · $' + c.monto.toLocaleString() + '</b><span>' + esc(c.descripcion) + (c.fecha ? ' · ' + esc(c.fecha) : '') + '</span></div></div>';
  });
  return h;
}

// ---------- administrador ----------
async function cargarAdmin(){
  _admin = { cargando: true };
  render();
  var a = {};
  var t0 = Date.now();
  try{ var r = await fetch(API + '/salud', { cache: 'no-store' }); a.api = r.ok ? 'ok (' + (Date.now() - t0) + ' ms)' : 'error ' + r.status; }catch(e){ a.api = 'sin respuesta'; }
  try{ var m = await pedir('/metricas'); a.metricas = m.metricas || {}; a.bd = 'ok'; }catch(e){ a.bd = 'error: ' + e.message; }
  try{ var rs = await pedir('/respaldos'); a.respaldo = (rs.respaldos || [])[0] || null; }catch(e){ a.respaldo = { error: e.message }; }
  try{ var cs = await pedir('/admin/cuentas'); a.cuentas = (cs.cuentas || []).length; }catch(e){ a.cuentas = '?'; }
  try{ var sw = await (await fetch('/sw.js', { cache: 'no-store' })).text(); var v = sw.match(/CACHE_NAME\s*=\s*'([^']+)'/); a.version = v ? v[1] : '?'; }catch(e){ a.version = '?'; }
  var foto = (relojes.find(function(x){ return x.foto && x.foto.indexOf('https://') === 0; }) || {}).foto;
  // se carga como imagen (las fotos no tienen CORS para fetch, pero si se pueden mostrar)
  if(foto){
    a.fotos = await new Promise(function(res){
      var img = new Image(), t = setTimeout(function(){ res('sin respuesta'); }, 8000);
      img.onload = function(){ clearTimeout(t); res('ok'); };
      img.onerror = function(){ clearTimeout(t); res('error al cargar'); };
      img.src = foto + (foto.indexOf('?') === -1 ? '?' : '&') + 'v=' + Date.now();
    });
  } else a.fotos = 'sin fotos';
  _admin = a;
  render();
}
function htmlAdmin(){
  var noContar = false; try{ noContar = localStorage.getItem(CLAVE_NO_CONTAR) === '1'; }catch(e){}
  var h = '<section class="cta-seccion cta-admin"><h2 class="cta-titulo">Administrador</h2>' +
    '<a class="cta-btn primario cta-ancho" href="/admin">Ir al panel de administración</a>';
  if(!_admin || _admin.cargando){ return h + '<p class="cta-texto" style="margin-top:18px;">Cargando datos...</p></section>'; }
  // metricas
  var met = _admin.metricas || {}, tot = { vistas: 0, aperturas: 0, clics: 0 };
  var filas = Object.keys(met).map(function(id){
    var m = met[id]; tot.vistas += m.vistas || 0; tot.aperturas += m.aperturas || 0; tot.clics += m.clics || 0;
    var r = relojes.find(function(x){ return x.id === id; });
    return { nombre: r ? r.nombre : '(ya no publicado)', m: m };
  }).sort(function(a, b){ return (b.m.vistas || 0) - (a.m.vistas || 0); }).slice(0, 5);
  h += '<h3 class="cta-sub">Métricas del catálogo</h3>' +
    '<div class="cta-metricas"><div><b>' + tot.vistas.toLocaleString() + '</b><span>vistas</span></div><div><b>' + tot.aperturas.toLocaleString() + '</b><span>aperturas</span></div><div><b>' + tot.clics.toLocaleString() + '</b><span>clics a WhatsApp</span></div></div>' +
    (filas.length ? '<ol class="cta-top">' + filas.map(function(f){ return '<li><span>' + esc(f.nombre) + '</span><em>' + (f.m.vistas || 0) + ' vistas · ' + (f.m.clics || 0) + ' clics</em></li>'; }).join('') + '</ol>' : '');
  // desarrollador
  var resp = _admin.respaldo;
  var textoResp = !resp ? 'todavía ninguno' : (resp.error ? 'error: ' + resp.error : new Date(resp.fecha).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }));
  var est = function(t){ return '<span class="' + (/^ok/.test(String(t)) ? 'cta-ok' : 'cta-mal') + '">' + esc(t) + '</span>'; };
  h += '<details class="cta-dev"><summary>Opciones de desarrollador</summary>' +
    '<ul class="cta-estado">' +
      '<li>API' + est(_admin.api) + '</li>' +
      '<li>Base de datos' + est(_admin.bd) + '</li>' +
      '<li>Fotos (R2)' + est(_admin.fotos) + '</li>' +
      '<li>Catálogo<span>' + relojes.length + ' relojes publicados</span></li>' +
      '<li>Cuentas de clientes<span>' + esc(_admin.cuentas) + '</span></li>' +
      '<li>Versión publicada<span>' + esc(_admin.version) + '</span></li>' +
      '<li>Último respaldo<span>' + esc(textoResp) + '</span></li>' +
    '</ul>' +
    '<label class="cta-check"><input type="checkbox" ' + (noContar ? 'checked' : '') + ' onchange="cambiarNoContar(this.checked)"> No contar mis visitas en las métricas</label>' +
    '<div class="cta-fila cta-dev-botones">' +
      '<button type="button" class="cta-btn secundario" onclick="hacerRespaldoCuenta(this)">Hacer respaldo ahora</button>' +
      '<button type="button" class="cta-btn secundario" onclick="forzarActualizacion()">Forzar actualización</button>' +
      '<button type="button" class="cta-link" onclick="cargarAdmin()">Volver a revisar</button>' +
    '</div></details></section><hr class="cta-sep">';
  return h;
}
function cambiarNoContar(si){
  try{ localStorage.setItem(CLAVE_NO_CONTAR, si ? '1' : '0'); }catch(e){}
  toast(si ? 'Tus visitas ya no se cuentan' : 'Tus visitas se vuelven a contar');
}
async function hacerRespaldoCuenta(btn){
  btn.disabled = true; btn.textContent = 'Haciendo respaldo...';
  try{
    var inf = await pedir('/mantenimiento', { method: 'POST' });
    if(inf.respaldo && inf.respaldo.error) throw new Error(inf.respaldo.error);
    toast('Respaldo listo');
    cargarAdmin();
  }catch(e){ alert('No se pudo hacer el respaldo: ' + e.message); btn.disabled = false; btn.textContent = 'Hacer respaldo ahora'; }
}
async function forzarActualizacion(){
  try{
    if(navigator.serviceWorker){ var regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(function(r){ return r.unregister(); })); }
    if(window.caches){ var ks = await caches.keys(); await Promise.all(ks.map(function(k){ return caches.delete(k); })); }
  }catch(e){}
  location.reload();
}

// ---------- panel ----------
function render(){
  var cont = document.getElementById('cuenta-contenido');
  if(!cont) return;
  var aviso = _mensaje ? '<p class="cta-mensaje">' + esc(_mensaje) + '</p>' : '';
  if(_cargando){ cont.innerHTML = aviso + '<p class="cta-texto">Cargando tu cuenta...</p>'; return; }
  if(!sesion.activa){
    cont.innerHTML = aviso +
      '<section class="cta-seccion"><h2 class="cta-titulo">Mi cuenta</h2>' +
      '<p class="cta-texto">Entra con tu cuenta de Google para guardar tus relojes favoritos en cualquier celular, recibir un aviso por WhatsApp cuando llegue el reloj que quieres y ver tus compras y apartados.</p>' +
      '<button type="button" class="cta-btn primario cta-google" onclick="entrarConGoogle()">' +
        '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>' +
        '<span>Continuar con Google</span></button>' +
      '<p class="cta-legal">Solo guardamos tu nombre, tu correo y el WhatsApp que tú agregues, para atenderte. No publicamos tus datos ni los compartimos.</p></section>';
    return;
  }
  var p = sesion.perfil || {};
  var h = aviso;
  if(sesion.esAdmin){ h += htmlAdmin(); if(!_admin) setTimeout(cargarAdmin, 0); }
  h += '<section class="cta-seccion"><h2 class="cta-titulo">Hola' + (p.nombre ? ', ' + esc(p.nombre.split(' ')[0]) : '') + '</h2>' +
    '<p class="cta-texto" style="margin-bottom:22px;">' + esc(p.email || '') + '</p>' +
    '<form onsubmit="return guardarPerfil(event)" novalidate>' +
      '<div class="cta-campo"><input type="text" id="cta-nombre" placeholder=" " maxlength="60" autocomplete="name" value="' + esc(p.nombre || '') + '"><label for="cta-nombre">Nombre</label></div>' +
      '<div class="cta-campo"><input type="tel" id="cta-tel" placeholder=" " maxlength="20" autocomplete="tel" inputmode="tel" value="' + esc(p.telefono || '') + '"><label for="cta-tel">WhatsApp (para avisarte)</label></div>' +
      '<button type="submit" class="cta-btn primario" id="cta-guardar">Guardar</button>' +
    '</form></section><hr class="cta-sep">';
  // avisos
  h += '<section class="cta-seccion"><h2 class="cta-titulo">Mis avisos</h2>';
  if(!sesion.avisos.length) h += '<p class="cta-texto">Toca “Avísame” en un reloj o en la página de una marca y te escribiremos por WhatsApp cuando llegue o baje de precio.</p>';
  else h += sesion.avisos.map(function(a){
    return '<div class="cta-item"><div><b>' + esc(textoAviso(a)) + '</b><span>' + (a.tipo === 'marca' ? 'Te avisamos cuando lleguen modelos nuevos' : 'Te avisamos cuando llegue o baje de precio') + '</span></div>' +
      '<button type="button" class="cta-link" onclick="toggleAviso(\'' + esc(a.tipo) + '\',\'' + esc(a.valor) + '\')">Quitar</button></div>';
  }).join('');
  h += '</section><hr class="cta-sep">';
  // compras
  h += '<section class="cta-seccion"><h2 class="cta-titulo">Mis compras y apartados</h2>' + htmlCompras() + '</section><hr class="cta-sep">';
  if(_compras === null) setTimeout(cargarCompras, 0);
  // favoritos y salida
  h += '<section class="cta-seccion"><h2 class="cta-titulo">Mis favoritos</h2>' +
    '<p class="cta-texto">Tienes ' + _favoritos.size + ' reloj' + (_favoritos.size === 1 ? '' : 'es') + ' guardado' + (_favoritos.size === 1 ? '' : 's') + '. Se guardan en tu cuenta y los ves en cualquier celular.</p>' +
    '<button type="button" class="cta-btn secundario" onclick="cerrarCuenta();abrirFavoritos()">Ver favoritos</button></section><hr class="cta-sep">' +
    '<div class="cta-fila"><button type="button" class="cta-link" onclick="cerrarSesionCliente()">Cerrar sesión</button>' +
    '<button type="button" class="cta-link cta-peligro" onclick="eliminarCuenta()">Eliminar mi cuenta</button></div>';
  cont.innerHTML = h;
}

// ---------- abrir / cerrar el panel ----------
function abrirCuenta(){
  cerrarFavoritos();
  if(typeof buscadorAbierto !== 'undefined' && buscadorAbierto){
    var bb = Array.prototype.find.call(document.querySelectorAll('.icon-btn[aria-label="Buscar"]'), function(x){ return x.offsetParent !== null; });
    if(bb) toggleBuscador(bb);
  }
  cargarFirebase().catch(function(){ _mensaje = 'No se pudo conectar. Revisa tu internet.'; render(); });   // listo antes de tocar "Continuar con Google"
  render();
  var hd = document.getElementById('site-header');
  document.documentElement.style.setProperty('--header-h', hd.offsetHeight + 'px');
  var m = document.getElementById('panel-cuenta');
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  hd.classList.add('panel-open');
  document.body.style.overflow = 'hidden';
  setTimeout(function(){ var c = document.getElementById('cuenta-cerrar'); if(c) c.focus({preventScroll:true}); }, 380);
}
function cerrarCuenta(){
  var m = document.getElementById('panel-cuenta');
  if(!m) return;
  var estabaAbierto = m.classList.contains('open');
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  if(estabaAbierto){
    var hd = document.getElementById('site-header');
    if(hd) hd.classList.remove('panel-open');
    document.body.style.overflow = '';
    _mensaje = '';
  }
}
document.getElementById('panel-cuenta').addEventListener('click', function(e){ if(e.target===this) cerrarCuenta(); });
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') cerrarCuenta(); });

// Si ya habia iniciado sesion en este navegador, se recupera la sesion sin esperar a que abra el panel
try{ if(localStorage.getItem(CLAVE_SESION) === '1') setTimeout(function(){ cargarFirebase().catch(function(){}); }, 600); }catch(e){}

export { abrirCuenta, cerrarCuenta, toggleAviso };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirCuenta, abrirFavoritos, cambiarNoContar, cargarAdmin, cerrarCuenta, cerrarSesionCliente, eliminarCuenta,
  entrarConGoogle, forzarActualizacion, guardarPerfil, hacerRespaldoCuenta, toggleAviso });
