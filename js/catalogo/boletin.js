// =================== BOLETIN ===================
// "Suscribete al boletin" (pie de pagina): ventana con el correo -> POST /boletin de la API, que lo guarda
// en D1 y manda un correo de bienvenida con enlace para darse de baja. La lista se ve en el panel.
var API = 'https://api.aphillipsstore.com';
var _ventana = null, _ultimoFoco = null;

function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }

function crearVentana(){
  var v = document.createElement('div');
  v.className = 'bol-fondo';
  v.innerHTML =
    '<div class="bol-caja" role="dialog" aria-modal="true" aria-labelledby="bol-titulo">' +
      '<button type="button" class="bol-cerrar" aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="bol-cuerpo"></div>' +
    '</div>';
  v.addEventListener('click', function(e){ if(e.target === v || e.target.closest('.bol-cerrar')) cerrarBoletin(); });
  document.body.appendChild(v);
  return v;
}
function formulario(mensaje){
  return '<h2 id="bol-titulo" class="bol-titulo">Suscríbete al boletín</h2>' +
    '<p class="bol-texto">Te avisamos cuando lleguen relojes nuevos y de ofertas especiales. Sin spam: puedes darte de baja cuando quieras.</p>' +
    '<form class="bol-form" novalidate>' +
      '<div class="cta-campo"><input type="email" id="bol-email" placeholder=" " autocomplete="email" maxlength="120" required><label for="bol-email">Correo electrónico <b>*</b></label></div>' +
      (mensaje ? '<p class="bol-error" role="alert">' + esc(mensaje) + '</p>' : '') +
      '<button type="submit" class="cta-btn primario bol-enviar">Suscribirme</button>' +
    '</form>' +
    '<p class="bol-legal">Al suscribirte aceptas nuestra <a href="legal#privacidad">política de privacidad</a>.</p>';
}
function listo(email){
  return '<h2 id="bol-titulo" class="bol-titulo">¡Listo!</h2>' +
    '<p class="bol-texto">Ya estás suscrito con <b>' + esc(email) + '</b>. Te enviamos un correo de bienvenida (si no lo ves, revisa la carpeta de spam).</p>' +
    '<button type="button" class="cta-btn primario bol-ok">Seguir viendo relojes</button>';
}
function pintar(html){
  var c = _ventana.querySelector('.bol-cuerpo');
  c.innerHTML = html;
  var f = c.querySelector('form');
  if(f) f.addEventListener('submit', enviar);
  var ok = c.querySelector('.bol-ok');
  if(ok){ ok.addEventListener('click', cerrarBoletin); ok.focus(); }
}

async function enviar(ev){
  ev.preventDefault();
  var campo = document.getElementById('bol-email');
  var email = campo.value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ pintar(formulario('Escribe un correo válido.')); document.getElementById('bol-email').value = email; document.getElementById('bol-email').focus(); return; }
  var btn = _ventana.querySelector('.bol-enviar');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try{
    var r = await fetch(API + '/boletin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) });
    var d = {}; try{ d = await r.json(); }catch(e){}
    if(!r.ok) throw new Error(d.error || 'No se pudo suscribir. Intenta de nuevo.');
    pintar(listo(email));
  }catch(e){
    pintar(formulario(e.message && e.message !== 'Failed to fetch' ? e.message : 'Sin conexión. Revisa tu internet e intenta de nuevo.'));
    document.getElementById('bol-email').value = email;
  }
}

function abrirBoletin(ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  _ultimoFoco = document.activeElement;
  if(!_ventana) _ventana = crearVentana();
  pintar(formulario(''));
  _ventana.classList.add('on');
  document.body.style.overflow = 'hidden';
  setTimeout(function(){ var c = document.getElementById('bol-email'); if(c) c.focus(); }, 80);
}
function cerrarBoletin(){
  if(!_ventana || !_ventana.classList.contains('on')) return;
  _ventana.classList.remove('on');
  document.body.style.overflow = '';
  if(_ultimoFoco && _ultimoFoco.focus) _ultimoFoco.focus();
}
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') cerrarBoletin(); });

export { abrirBoletin, cerrarBoletin };
// Usadas desde atributos onclick del HTML
Object.assign(window, { abrirBoletin, cerrarBoletin });
