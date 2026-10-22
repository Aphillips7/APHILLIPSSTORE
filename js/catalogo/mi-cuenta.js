// =================== MI CUENTA DEL CLIENTE: registro, datos, pedidos y favoritos ===================
// cuenta.js se encarga de iniciar sesion; este modulo arma lo que el cliente ve con su sesion:
//   - Registro (crear cuenta) y "Completa tu registro" (cuentas de Google o viejas sin WhatsApp/terminos)
//   - Tres secciones: Mi cuenta (datos, direccion de envio, preferencias), Mis pedidos y Mis favoritos
//   - Pedidos: al tocar "Comprar por WhatsApp" con sesion se crea un pedido (P-XXXXX) que va en el
//     mensaje; el dueno lo avanza desde el panel y aqui el cliente ve en que paso va.
// POKA-YOKE: los botones de guardar se activan solo cuando todo es valido; cada campo dice que corregir
// mientras se escribe; el WhatsApp se ordena solo (+507 6123-4567); el correo sugiere arreglar errores
// de dedo; no se puede crear la cuenta sin ser mayor de edad y aceptar los terminos. El servidor vuelve
// a validar todo (y no deja dos cuentas con el mismo WhatsApp).
import { relojes } from './datos.js';
import { _favoritos, quitarFavorito } from './favoritos.js';
import { abrir } from './modal.js';
import { sesion } from './sesion.js';
import { _destEsc as esc, miniatura, sugerirCorreo, toast } from './ui.js';
import { WHATSAPP_NUM } from './whatsapp.js';

let _pedir = null, _render = null;
let _tab = 'cuenta';
try{ _tab = localStorage.getItem('aphillips_tab_cuenta') || 'cuenta'; }catch(e){}
let _pedidos = null;            // null = sin cargar; [] = cargados; { error }
let _compras = null;            // compras y apartados en tienda (cuenta vinculada por el dueno)

function iniciarMiCuenta(pedir, render){ _pedir = pedir; _render = render; }
function reiniciarMiCuenta(){ _pedidos = null; _compras = null; }

// ---------- reglas de los campos ----------
const PROVINCIAS = ['Bocas del Toro', 'Chiriqui', 'Cocle', 'Colon', 'Darien', 'Herrera', 'Los Santos', 'Panama', 'Panama Oeste', 'Veraguas',
  'Comarca Guna Yala', 'Comarca Embera-Wounaan', 'Comarca Ngabe-Bugle'];
const NOMBRE_PROV = { Chiriqui: 'Chiriquí', Cocle: 'Coclé', Colon: 'Colón', Darien: 'Darién', Panama: 'Panamá', 'Panama Oeste': 'Panamá Oeste', 'Comarca Ngabe-Bugle': 'Comarca Ngäbe-Buglé', 'Comarca Embera-Wounaan': 'Comarca Emberá-Wounaan' };
// mismo criterio que el servidor: 7 u 8 digitos = Panama; otros paises con su codigo
function telefonoBonito(t){
  var d = String(t || '').replace(/[^0-9]/g, '');
  if(!d) return '';
  if(d.length === 7 || d.length === 8) d = '507' + d;
  if(d.length < 10 || d.length > 15) return String(t).trim();
  if(d.indexOf('507') === 0 && (d.length === 10 || d.length === 11)){ var n = d.slice(3); return '+507 ' + (n.length === 8 ? n.slice(0, 4) + '-' + n.slice(4) : n.slice(0, 3) + '-' + n.slice(3)); }
  return '+' + d;
}
function telefonoValido(t){ var d = String(t || '').replace(/[^0-9]/g, ''); if(d.length === 7 || d.length === 8) return true; return d.length >= 10 && d.length <= 15; }
function edad(fecha){
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha || ''); if(!m) return -1;
  var hoy = new Date(), e = hoy.getFullYear() - +m[1];
  if(hoy.getMonth() + 1 < +m[2] || (hoy.getMonth() + 1 === +m[2] && hoy.getDate() < +m[3])) e--;
  return e;
}
function claveSegura(c){ return c.length >= 8 && /[A-Z]/.test(c) && /[a-z]/.test(c); }
// devuelve { campo: 'mensaje' } con lo que esta mal en el formulario
function erroresDe(form){
  var v = function(n){ var el = form.querySelector('[name="' + n + '"]'); if(!el) return null; return el.type === 'checkbox' ? el.checked : el.value.trim(); };
  var e = {};
  if(v('nombre') !== null && !v('nombre')) e.nombre = 'Escribe tu nombre.';
  if(v('apellido') !== null && !v('apellido')) e.apellido = 'Escribe tu apellido.';
  if(v('email') !== null){ if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) e.email = 'Escribe un correo válido.'; }
  if(v('telefono') !== null){ if(!v('telefono')) e.telefono = 'Tu WhatsApp es necesario para atenderte.'; else if(!telefonoValido(v('telefono'))) e.telefono = '8 dígitos si es de Panamá, o con el código de tu país.'; }
  if(v('clave') !== null && !claveSegura(form.querySelector('[name="clave"]').value)) e.clave = 'Mínimo 8 caracteres, con una mayúscula y una minúscula.';
  if(v('clave2') !== null && form.querySelector('[name="clave2"]').value !== form.querySelector('[name="clave"]').value) e.clave2 = 'Las dos contraseñas no coinciden.';
  if(v('terminos') === false) e.terminos = 'Necesario para crear tu cuenta.';
  if(v('nacimiento')){ var a = edad(v('nacimiento')); if(a < 0 || a > 110) e.nacimiento = 'Revisa la fecha.'; else if(a < 18) e.nacimiento = 'Debes ser mayor de 18 años.'; }
  if(v('muneca')){ var n = Number(v('muneca').replace(',', '.')); if(!(n >= 12 && n <= 25)) e.muneca = 'En centímetros, entre 12 y 25.'; }
  if(v('provincia') !== null && !v('provincia') && (v('ciudad') || v('linea'))) e.provincia = 'Elige la provincia.';
  return e;
}
// pinta los mensajes de los campos ya tocados y activa el boton solo si todo esta bien
function revisarForm(form){
  var e = erroresDe(form);
  form.querySelectorAll('[name]').forEach(function(el){
    var caja = el.closest('.cta-campo, .mc-check'); if(!caja) return;
    var msg = caja.querySelector('.mc-error');
    var mal = e[el.name] && el.dataset.tocado === '1';
    caja.classList.toggle('con-error', !!mal);
    if(mal){ if(!msg){ msg = document.createElement('small'); msg.className = 'mc-error'; caja.appendChild(msg); } msg.textContent = e[el.name]; }
    else if(msg) msg.remove();
  });
  // sugerencia de correo ("¿Quisiste decir ...@gmail.com?")
  var em = form.querySelector('[name="email"]');
  if(em){
    var caja = em.closest('.cta-campo'), s = caja.querySelector('.mc-sug'), sug = sugerirCorreo(em.value.trim());
    if(sug && !e.email){ if(!s){ s = document.createElement('button'); s.type = 'button'; s.className = 'mc-sug'; caja.appendChild(s); } s.textContent = '¿Quisiste decir ' + sug + '? Toca para corregir'; s.dataset.valor = sug; }
    else if(s) s.remove();
  }
  var cambiado = form.dataset.original === undefined || form.dataset.original !== firmaForm(form);
  var btn = form.querySelector('button[type="submit"]');
  if(btn && !btn.dataset.ocupado) btn.disabled = Object.keys(e).length > 0 || !cambiado;
  return e;
}
function firmaForm(form){ return Array.prototype.map.call(form.querySelectorAll('[name]'), function(el){ return el.name + '=' + (el.type === 'checkbox' ? el.checked : el.value.trim()); }).join('&'); }
// escucha todos los formularios de la cuenta (se arman con innerHTML)
document.addEventListener('input', function(ev){ var f = ev.target.closest && ev.target.closest('form.mc-form'); if(f){ if(ev.target.type !== 'checkbox' && ev.target.tagName !== 'SELECT') ev.target.dataset.tocado = ev.target.dataset.tocado || (ev.target.value.length > 2 ? '1' : ''); revisarForm(f); } });
document.addEventListener('change', function(ev){ var f = ev.target.closest && ev.target.closest('form.mc-form'); if(f){ ev.target.dataset.tocado = '1'; revisarForm(f); } });
document.addEventListener('focusout', function(ev){
  var f = ev.target.closest && ev.target.closest('form.mc-form'); if(!f || !ev.target.name) return;
  ev.target.dataset.tocado = '1';
  if(ev.target.name === 'telefono' && ev.target.value.trim()) ev.target.value = telefonoBonito(ev.target.value);
  if(ev.target.name === 'nombre' || ev.target.name === 'apellido') ev.target.value = ev.target.value.replace(/\s+/g, ' ').trim();
  if(ev.target.name === 'email') ev.target.value = ev.target.value.trim().toLowerCase();
  revisarForm(f);
});
document.addEventListener('click', function(ev){
  var s = ev.target.closest && ev.target.closest('.mc-sug'); if(!s) return;
  var f = s.closest('form'), em = f.querySelector('[name="email"]'); em.value = s.dataset.valor; s.remove(); revisarForm(f); em.focus();
});
// marca todo como tocado (para mostrar todos los errores al intentar enviar) y devuelve si es valido
function formListo(form){
  form.querySelectorAll('[name]').forEach(function(el){ el.dataset.tocado = '1'; });
  var e = revisarForm(form);
  var primero = form.querySelector('.con-error [name]');
  if(primero) primero.focus();
  return Object.keys(e).length === 0;
}
function datosForm(form){
  var d = {};
  form.querySelectorAll('[name]').forEach(function(el){ d[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
  return d;
}
function preparar(cont){ cont.querySelectorAll('form.mc-form').forEach(function(f){ if(f.dataset.conOriginal === '1') f.dataset.original = firmaForm(f); revisarForm(f); }); }

// ---------- piezas de formulario ----------
function campo(nombre, etiqueta, valor, opc){
  opc = opc || {};
  return '<div class="cta-campo"><input type="' + (opc.tipo || 'text') + '" name="' + nombre + '" id="mc-' + nombre + '" placeholder=" "' +
    (opc.auto ? ' autocomplete="' + opc.auto + '"' : '') + (opc.modo ? ' inputmode="' + opc.modo + '"' : '') + ' maxlength="' + (opc.max || 60) + '"' +
    (opc.extra || '') + ' value="' + esc(valor || '') + '"><label for="mc-' + nombre + '">' + etiqueta + (opc.oblig ? ' <b>*</b>' : '') + '</label>' +
    (opc.ayuda ? '<small class="mc-ayuda">' + opc.ayuda + '</small>' : '') + '</div>';
}
function selector(nombre, etiqueta, valor, opciones){
  return '<div class="cta-campo mc-select"><select name="' + nombre + '" id="mc-' + nombre + '">' + opciones.map(function(o){
    return '<option value="' + esc(o[0]) + '"' + (o[0] === valor ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
  }).join('') + '</select><label for="mc-' + nombre + '">' + etiqueta + '</label></div>';
}
function casilla(nombre, html, marcado, oblig){
  return '<div class="mc-check"><label class="cta-check"><input type="checkbox" name="' + nombre + '"' + (marcado ? ' checked' : '') + '> <span>' + html + (oblig ? ' <b class="mc-ast">*</b>' : '') + '</span></label></div>';
}
const TEXTO_TERMINOS = 'Soy mayor de 18 años y acepto los <a href="legal#terminos" target="_blank" rel="noopener">términos y condiciones</a> y la <a href="legal#privacidad" target="_blank" rel="noopener">política de privacidad</a>.';
const TEXTO_NOVEDADES = 'Quiero recibir novedades: relojes nuevos y ofertas (puedes darte de baja cuando quieras).';

// Formulario de registro (crear cuenta con correo)
function htmlRegistro(){
  return '<form class="mc-form" onsubmit="return crearCuenta(event)" novalidate>' +
    '<div class="mc-dos">' + campo('nombre', 'Nombre', '', { auto: 'given-name', oblig: true }) + campo('apellido', 'Apellido(s)', '', { auto: 'family-name', oblig: true }) + '</div>' +
    campo('email', 'Correo electrónico', '', { tipo: 'email', auto: 'email', modo: 'email', max: 120, oblig: true }) +
    campo('telefono', 'WhatsApp', '', { tipo: 'tel', auto: 'tel', modo: 'tel', max: 20, oblig: true, ayuda: 'Ej. 6123-4567. Te escribimos por aquí sobre tus pedidos.' }) +
    campo('clave', 'Contraseña', '', { tipo: 'password', auto: 'new-password', max: 100, oblig: true, ayuda: 'Mínimo 8 caracteres, con una mayúscula y una minúscula.' }) +
    campo('clave2', 'Confirma tu contraseña', '', { tipo: 'password', auto: 'new-password', max: 100, oblig: true }) +
    casilla('terminos', TEXTO_TERMINOS, false, true) + casilla('novedades', TEXTO_NOVEDADES, false) +
    '<div class="cta-fila" style="margin-top:8px;"><button type="submit" class="cta-btn primario" id="cta-crear" disabled>Crear mi cuenta</button>' +
    '<button type="button" class="cta-link" onclick="cambiarModo(\'entrar\')">Ya tengo una cuenta</button></div></form>';
}
// Cuentas que entraron con Google o son anteriores: faltan WhatsApp, apellido o terminos
function htmlCompletar(){
  var p = sesion.perfil || {};
  var partes = String(p.nombre || '').split(' ');
  var nombre = p.apellido ? p.nombre : partes[0] || '', apellido = p.apellido || partes.slice(1).join(' ');
  return '<section class="cta-seccion"><h2 class="cta-titulo">Completa tu registro</h2>' +
    '<p class="cta-texto">Para usar tu cuenta y hacer pedidos necesitamos estos datos. Solo te toma un momento.</p>' +
    '<p class="cta-texto" style="margin-top:-14px;"><b>' + esc(p.email || '') + '</b></p>' +
    '<form class="mc-form" onsubmit="return completarRegistro(event)" novalidate>' +
      '<div class="mc-dos">' + campo('nombre', 'Nombre', nombre, { auto: 'given-name', oblig: true }) + campo('apellido', 'Apellido(s)', apellido, { auto: 'family-name', oblig: true }) + '</div>' +
      campo('telefono', 'WhatsApp', p.telefono, { tipo: 'tel', auto: 'tel', modo: 'tel', max: 20, oblig: true, ayuda: 'Ej. 6123-4567. Te escribimos por aquí sobre tus pedidos.' }) +
      (p.terminos && p.mayorEdad ? '' : casilla('terminos', TEXTO_TERMINOS, false, true)) + casilla('novedades', TEXTO_NOVEDADES, p.novedades) +
      '<div class="cta-fila" style="margin-top:8px;"><button type="submit" class="cta-btn primario" disabled>Guardar y continuar</button>' +
      '<button type="button" class="cta-link" onclick="cerrarSesionCliente()">Cerrar sesión</button></div>' +
    '</form></section>';
}
async function completarRegistro(ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  var f = ev.target;
  if(!formListo(f)) return false;
  var d = datosForm(f), p = sesion.perfil || {};
  await enviarPerfil(f, { nombre: d.nombre, apellido: d.apellido, telefono: d.telefono, novedades: !!d.novedades,
    terminos: d.terminos !== undefined ? !!d.terminos : p.terminos, mayorEdad: d.terminos !== undefined ? !!d.terminos : p.mayorEdad }, '/cuenta/perfil', 'PUT');
  return false;
}
// guarda en el servidor; si responde con un campo malo, lo marca en el formulario
async function enviarPerfil(form, cuerpo, ruta, metodo){
  var btn = form.querySelector('button[type="submit"]'), txt = btn.textContent;
  btn.disabled = true; btn.dataset.ocupado = '1'; btn.textContent = 'Guardando...';
  try{
    var r = await _pedir(ruta, { method: metodo, body: cuerpo });
    sesion.perfil = r.perfil;
    document.dispatchEvent(new CustomEvent('sesion-cambiada'));
    toast('Datos guardados');
    _render();
    return true;
  }catch(e){
    delete btn.dataset.ocupado; btn.textContent = txt;
    var c = e.datos && e.datos.campo && form.querySelector('[name="' + e.datos.campo + '"]');
    if(c){
      var caja = c.closest('.cta-campo, .mc-check'); caja.classList.add('con-error');
      var m = caja.querySelector('.mc-error') || caja.appendChild(Object.assign(document.createElement('small'), { className: 'mc-error' }));
      m.textContent = e.message; c.focus();
    }else toast(e.message);
    btn.disabled = false;
    return false;
  }
}

// ---------- vista con sesion: tres secciones ----------
function htmlMiCuenta(htmlAvisos){
  var p = sesion.perfil || {};
  var abiertos = (_pedidos && _pedidos.length) ? _pedidos.filter(function(x){ return ['solicitado', 'confirmado', 'pagado', 'enviado'].indexOf(x.estado) !== -1; }).length : 0;
  var h = '<div class="mc-cabeza"><h2 class="cta-titulo">Hola, ' + esc(p.nombre || '') + '</h2>' +
    '<button type="button" class="mc-codigo" onclick="copiarCodigoCliente()" title="Toca para copiar">Tu código de cliente <b>' + esc(p.codigo || '') + '</b>' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg></button></div>' +
    '<nav class="mc-tabs" role="tablist">' +
      pestana('cuenta', 'Mi cuenta', '') + pestana('pedidos', 'Mis pedidos', abiertos || '') + pestana('favoritos', 'Mis favoritos', _favoritos.size || '') +
    '</nav><div class="mc-contenido" role="tabpanel">';
  if(_tab === 'pedidos') h += htmlPedidos();
  else if(_tab === 'favoritos') h += htmlFavoritos();
  else h += htmlDatos() + htmlAvisos;
  return h + '</div>';
}
function pestana(id, texto, n){
  return '<button type="button" role="tab" class="mc-tab' + (_tab === id ? ' on' : '') + '" aria-selected="' + (_tab === id) + '" onclick="irPestanaCuenta(\'' + id + '\')">' +
    texto + (n ? '<span>' + n + '</span>' : '') + '</button>';
}
function irPestanaCuenta(t){
  _tab = t; try{ localStorage.setItem('aphillips_tab_cuenta', t); }catch(e){}
  _render();
  var c = document.querySelector('#panel-cuenta .fav-body'); if(c) c.scrollTop = 0;
}
function copiarCodigoCliente(){
  var c = (sesion.perfil || {}).codigo || '';
  try{ navigator.clipboard.writeText(c).then(function(){ toast('Código copiado: ' + c); }, function(){ toast('Tu código: ' + c); }); }catch(e){ toast('Tu código: ' + c); }
}

// Mi cuenta: datos personales, direccion de envio y preferencias
function htmlDatos(){
  var p = sesion.perfil || {}, d = p.direccion || {};
  var maxNac = new Date(); maxNac.setFullYear(maxNac.getFullYear() - 18);
  return '<form class="mc-form" data-con-original="1" onsubmit="return guardarDatosCuenta(event)" novalidate>' +
    '<h3 class="mc-sub">Datos personales</h3>' +
    '<div class="mc-dos">' + campo('nombre', 'Nombre', p.nombre, { auto: 'given-name', oblig: true }) + campo('apellido', 'Apellido(s)', p.apellido, { auto: 'family-name', oblig: true }) + '</div>' +
    '<div class="cta-campo mc-fijo"><input type="email" value="' + esc(p.email || '') + '" disabled placeholder=" "><label>Correo electrónico</label></div>' +
    campo('telefono', 'WhatsApp', p.telefono, { tipo: 'tel', auto: 'tel', modo: 'tel', max: 20, oblig: true }) +
    '<div class="mc-dos">' + campo('cedula', 'Cédula o pasaporte', p.cedula, { max: 20, ayuda: 'Para la factura y la garantía.' }) +
      campo('nacimiento', 'Fecha de nacimiento', p.nacimiento, { tipo: 'date', extra: ' max="' + maxNac.toISOString().slice(0, 10) + '" min="1910-01-01"' }) + '</div>' +
    '<div class="mc-dos">' + campo('muneca', 'Medida de tu muñeca (cm)', p.muneca, { modo: 'decimal', max: 5, ayuda: '<a href="guia-de-tamanos">¿Cómo medirla?</a> Te recomendamos el tamaño ideal.' }) +
      selector('contacto', 'Prefiero que me contacten por', p.contacto || 'whatsapp', [['whatsapp', 'WhatsApp'], ['llamada', 'Llamada'], ['correo', 'Correo']]) + '</div>' +
    '<h3 class="mc-sub">Dirección de envío</h3>' +
    selector('provincia', 'Provincia', d.provincia || '', [['', 'Elige tu provincia']].concat(PROVINCIAS.map(function(x){ return [x, NOMBRE_PROV[x] || x]; }))) +
    campo('ciudad', 'Ciudad, distrito o corregimiento', d.ciudad, { max: 80, auto: 'address-level2' }) +
    campo('linea', 'Dirección (calle, edificio, casa o apto.)', d.linea, { max: 160, auto: 'street-address' }) +
    campo('referencia', 'Punto de referencia', d.referencia, { max: 160, ayuda: 'Ej. frente a la farmacia, portón negro.' }) +
    '<h3 class="mc-sub">Preferencias</h3>' + casilla('novedades', TEXTO_NOVEDADES, p.novedades) +
    '<div class="cta-fila" style="margin-top:6px;"><button type="submit" class="cta-btn primario" disabled>Guardar cambios</button></div>' +
    '</form><hr class="cta-sep">';
}
async function guardarDatosCuenta(ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  var f = ev.target;
  if(!formListo(f)) return false;
  var d = datosForm(f);
  await enviarPerfil(f, { nombre: d.nombre, apellido: d.apellido, telefono: d.telefono, cedula: d.cedula, nacimiento: d.nacimiento,
    muneca: d.muneca, contacto: d.contacto, novedades: !!d.novedades,
    direccion: { provincia: d.provincia, ciudad: d.ciudad, linea: d.linea, referencia: d.referencia } }, '/cuenta/perfil', 'PUT');
  return false;
}

// ---------- Mis pedidos ----------
const PASOS = [['solicitado', 'Solicitado'], ['confirmado', 'Confirmado'], ['pagado', 'Pagado'], ['enviado', 'Enviado'], ['entregado', 'Entregado']];
const TEXTO_ESTADO = { solicitado: 'Recibimos tu pedido. Te escribiremos por WhatsApp para confirmarlo.', confirmado: 'Confirmamos tu pedido. Te indicamos cómo pagar por WhatsApp.',
  pagado: 'Pago recibido. Estamos preparando tu reloj.', enviado: 'Tu reloj va en camino.', entregado: '¡Entregado! Gracias por tu compra.', cancelado: 'Este pedido fue cancelado.' };
async function cargarPedidos(){
  try{ _pedidos = (await _pedir('/cuenta/pedidos')).pedidos || []; }catch(e){ _pedidos = { error: e.message }; }
  try{ _compras = await _pedir('/cuenta/compras'); }catch(e){ _compras = { error: e.message }; }
  _render();
}
function fechaCorta(ms){ return ms ? new Date(ms).toLocaleDateString('es-PA', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
function htmlPedidos(){
  if(_pedidos === null){ setTimeout(cargarPedidos, 0); return '<p class="cta-texto">Cargando tus pedidos...</p>'; }
  if(_pedidos.error) return '<p class="cta-texto">No se pudieron cargar tus pedidos: ' + esc(_pedidos.error) + ' <button type="button" class="cta-link" onclick="recargarPedidos()">Reintentar</button></p>';
  var h = '';
  if(!_pedidos.length){
    h += '<p class="cta-texto">Aún no tienes pedidos. Cuando toques “Comprar por WhatsApp” en un reloj, tu pedido aparecerá aquí con su número para que sigas cada paso.</p>' +
      '<button type="button" class="cta-btn secundario" onclick="cerrarCuenta();irAGenero(\'\')">Ver relojes</button>';
  }else h += _pedidos.map(htmlPedido).join('');
  // compras y apartados que el dueno registro en la tienda (cuenta vinculada)
  if(_compras && !_compras.error && _compras.vinculado && (_compras.compras.length || _compras.apartados.length)){
    h += '<hr class="cta-sep"><h3 class="mc-sub">Compras y apartados en tienda</h3>';
    _compras.apartados.forEach(function(a){
      h += '<div class="cta-item">' + (a.foto ? '<span class="mc-marco"><img src="' + esc(miniatura(a.foto)) + '" alt="" onerror="this.remove()"></span>' : '') +
        '<div><b>Apartado: ' + esc(a.reloj) + '</b><span>Abonado $' + a.abonado.toLocaleString() + ' de $' + a.precioAcordado.toLocaleString() + ' · <strong>Te falta $' + a.saldo.toLocaleString() + '</strong></span></div></div>';
    });
    _compras.compras.forEach(function(c){
      h += '<div class="cta-item"><div><b>' + (c.tipo === 'abono' ? 'Abono' : 'Compra') + ' · $' + c.monto.toLocaleString() + '</b><span>' + esc(c.descripcion) + (c.fecha ? ' · ' + esc(c.fecha) : '') + '</span></div></div>';
    });
  }
  return h;
}
function htmlPedido(x){
  var i = PASOS.findIndex(function(p){ return p[0] === x.estado; });
  var cancelado = x.estado === 'cancelado';
  var hist = {}; (x.historial || []).forEach(function(h){ hist[h.estado] = h.fecha; });
  var pasos = PASOS.map(function(p, k){
    if(p[0] === 'enviado' && x.entrega === 'retiro') return '';
    var cls = cancelado ? '' : (k < i ? ' hecho' : k === i ? ' actual' : '');
    return '<li class="mc-paso' + cls + '"><span>' + (p[0] === 'entregado' && x.entrega === 'retiro' ? 'Retirado' : p[1]) + '</span>' + (hist[p[0]] && !cancelado ? '<em>' + fechaCorta(hist[p[0]]) + '</em>' : '') + '</li>';
  }).join('');
  var msg = '¡Hola! Soy ' + ((sesion.perfil || {}).nombre || '') + ' (' + ((sesion.perfil || {}).codigo || '') + '). Te escribo por mi pedido ' + x.numero + ' (' + x.reloj + ').';
  return '<article class="mc-pedido' + (cancelado ? ' cancelado' : '') + '">' +
    '<div class="mc-ped-cab">' + (x.foto ? '<span class="mc-marco"><img src="' + esc(miniatura(x.foto)) + '" alt="" onerror="this.remove()"></span>' : '<span class="mc-marco"></span>') +
      '<div><b>' + esc(x.reloj) + '</b><span>Pedido <strong>' + esc(x.numero) + '</strong> · ' + fechaCorta(x.creado) + '</span><span>$' + Number(x.precio || 0).toLocaleString() + '</span></div></div>' +
    (cancelado ? '' : '<ol class="mc-pasos">' + pasos + '</ol>') +
    '<p class="mc-ped-estado">' + esc(TEXTO_ESTADO[x.estado] || '') + '</p>' +
    (x.tracking ? '<p class="mc-ped-dato">Número de guía: <b>' + esc(x.tracking) + '</b></p>' : '') +
    (x.nota ? '<p class="mc-ped-dato">' + esc(x.nota) + '</p>' : '') +
    '<div class="cta-fila"><a class="cta-link" href="https://wa.me/' + WHATSAPP_NUM + '?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">Escribir sobre este pedido</a>' +
      '<button type="button" class="cta-link" onclick="cerrarCuenta();abrir(\'' + esc(x.relojId) + '\')">Ver el reloj</button>' +
      (x.estado === 'solicitado' ? '<button type="button" class="cta-link cta-peligro" onclick="cancelarPedido(\'' + esc(x.numero) + '\')">Cancelar pedido</button>' : '') +
    '</div></article>';
}
function recargarPedidos(){ _pedidos = null; _render(); }
async function cancelarPedido(numero){
  if(!confirm('¿Cancelar el pedido ' + numero + '?')) return;
  try{ await _pedir('/cuenta/pedidos/cancelar', { method: 'POST', body: { numero: numero } }); toast('Pedido cancelado'); }
  catch(e){ toast(e.message); }
  _pedidos = null; _render();
}

// Crear el pedido al tocar "Comprar por WhatsApp" (lo llama whatsapp.js). Devuelve el numero al instante
// (para ponerlo en el mensaje) y lo guarda en el servidor sin hacer esperar al cliente. Si ya hay un
// pedido abierto de ese reloj, se usa el mismo numero (no se duplica).
const LETRAS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function numeroNuevo(){
  var a = new Uint8Array(5); crypto.getRandomValues(a);
  return 'P-' + Array.prototype.map.call(a, function(n){ return LETRAS[n % LETRAS.length]; }).join('');
}
function pedidoPara(relojId){
  if(!sesion.activa || !sesion.perfil || !sesion.perfil.completo || !_pedir) return null;
  var abierto = Array.isArray(_pedidos) && _pedidos.find(function(x){ return x.relojId === relojId && (x.estado === 'solicitado' || x.estado === 'confirmado'); });
  if(abierto) return abierto.numero;
  var numero = numeroNuevo();
  var intento = function(n, quedan){
    return _pedir('/cuenta/pedidos', { method: 'POST', body: { numero: n, relojId: relojId }, keepalive: true })
      .then(function(r){ _pedidos = null; return r; })
      .catch(function(e){ if(e.datos && e.datos.repetido && quedan) return intento(numeroNuevo(), quedan - 1); });
  };
  intento(numero, 2);
  return numero;
}
sesion.pedidoPara = pedidoPara;

// ---------- Mis favoritos ----------
function htmlFavoritos(){
  var lista = relojes.filter(function(r){ return _favoritos.has(r.id); });
  if(!lista.length) return '<p class="cta-texto">Aún no tienes favoritos. Toca el corazón en cualquier reloj para guardarlo aquí; se guardan en tu cuenta y los ves en cualquier celular.</p>' +
    '<button type="button" class="cta-btn secundario" onclick="cerrarCuenta();irAGenero(\'\')">Ver relojes</button>';
  var lineas = lista.map(function(r){ return '• ' + (r.nombre || 'reloj') + (r.sku ? ' (Ref. ' + r.sku + ')' : ''); });
  var msg = '¡Hola! Soy ' + ((sesion.perfil || {}).nombre || '') + ' (' + ((sesion.perfil || {}).codigo || '') + '). Me interesan estos relojes:\n' + lineas.join('\n');
  return '<div class="mc-favs">' + lista.map(function(r){
    var precio = r.precio ? '$' + Number(r.precio).toLocaleString() : '';
    return '<div class="mc-fav"><button type="button" class="mc-fav-abrir" onclick="cerrarCuenta();abrir(\'' + esc(r.id) + '\')">' +
      '<span class="mc-marco">' + (r.foto ? '<img src="' + esc(miniatura(r.foto)) + '" alt="" onerror="this.remove()">' : '') + '</span>' +
      '<span><b>' + esc(r.nombre || 'Reloj') + '</b><em>' + esc(precio) + '</em></span></button>' +
      '<button type="button" class="mc-fav-quitar" onclick="quitarFavoritoCuenta(\'' + esc(r.id) + '\')" aria-label="Quitar de favoritos">Quitar</button></div>';
  }).join('') + '</div>' +
  '<a class="cta-btn primario cta-ancho" style="margin-top:22px;" href="https://wa.me/' + WHATSAPP_NUM + '?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">Consultar mis favoritos por WhatsApp</a>';
}
function quitarFavoritoCuenta(id){ quitarFavorito(id); _render(); }

export { completarRegistro, htmlCompletar, htmlMiCuenta, htmlRegistro, iniciarMiCuenta, preparar as prepararFormularios, formListo, datosForm, reiniciarMiCuenta, telefonoBonito };
// Usadas desde atributos onclick del HTML
Object.assign(window, { abrir, cancelarPedido, completarRegistro, copiarCodigoCliente, guardarDatosCuenta, irPestanaCuenta, quitarFavoritoCuenta, recargarPedidos });
