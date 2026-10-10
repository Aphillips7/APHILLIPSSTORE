// --- Overlay: navegacion entre vistas ---
import { cargarAuthSettingsNube, contarBackupInfo, generarLoteCodigosRespaldo, generarSecretoTotp, getTotpSecret, guardarAuthSettingsNube, totpVerificar, verificarCodigoRespaldo } from './totp.js';
import { renderInicio } from '../inicio.js';
import { renderResumenRespaldo } from '../respaldo.js';
import { esPropietario } from '../state.js';
import { renderEspacioUsado } from '../sync/espacio.js';
import { renderSyncHistory, setSyncStatus } from '../sync/estado-sync.js';
import { _firebaseListo } from '../sync/sync.js';

var _authBuffer='';
var _secretoTemporal='';
function mostrarVistaAuth(vista){
  ['code','backup','setup','codigos-generados'].forEach(function(v){
    var el=document.getElementById('auth-view-'+v);
    if(el)el.style.display=(v===vista)?'block':'none';
  });
}
async function showAuth(){
  if(!esPropietario()){
    alert('Esta seccion es unicamente para el propietario de la tienda.');
    return;
  }
  if(!navegadorSoportaAuth()){
    alert('Este navegador no puede verificar codigos de autenticacion aqui. Esto pasa si abres el archivo directamente (doble clic) en vez de visitarlo desde una direccion https:// o localhost. Abre la app desde el enlace publicado (Firebase Hosting) e intenta de nuevo.');
    return;
  }
  await cargarAuthSettingsNube();
  if(!getTotpSecret()){
    iniciarConfiguracionAuth();
  }else{
    _authBuffer='';
    actualizarPuntosAuth();
    mostrarVistaAuth('code');
    document.getElementById('auth-overlay').style.display='flex';
  }
}
function hideAuth(){ document.getElementById('auth-overlay').style.display='none'; _authBuffer=''; }
function authCancel(){
  hideAuth();
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-inicio').classList.add('active');
  document.querySelector('.nav-tab').classList.add('active');
  renderInicio();
}
function authPress(digit){
  if(_authBuffer.length>=6)return;
  _authBuffer+=digit;
  actualizarPuntosAuth();
  if(_authBuffer.length===6)setTimeout(checkAuthCode,150);
}
function authDelete(){ _authBuffer=_authBuffer.slice(0,-1); actualizarPuntosAuth(); }
function actualizarPuntosAuth(){
  for(var i=0;i<6;i++){
    var dot=document.getElementById('auth-dot-'+i);
    if(!dot)continue;
    dot.classList.remove('filled','error');
    if(i<_authBuffer.length)dot.classList.add('filled');
  }
}
async function checkAuthCode(){
  var ok=await totpVerificar(getTotpSecret(),_authBuffer);
  if(ok){
    onAuthSuccess();
  }else{
    var box=document.getElementById('auth-box');
    box.classList.add('pin-shake');
    document.querySelectorAll('#auth-view-code .pin-dot').forEach(function(d){d.classList.add('error');});
    setTimeout(function(){ box.classList.remove('pin-shake'); _authBuffer=''; actualizarPuntosAuth(); },600);
  }
}
function onAuthSuccess(){
  hideAuth();
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(function(t){ t.classList.remove('active'); if(t.textContent.trim()==='Sync')t.classList.add('active'); });
  document.getElementById('page-config').classList.add('active');
  var lastSync=localStorage.getItem('lastSync');if(lastSync&&!_firebaseListo)setSyncStatus('Ultima sync: '+lastSync,'var(--muted)','info');
  renderConfigPage();
}
function irABackupCode(){ mostrarVistaAuth('backup'); document.getElementById('auth-backup-input').value=''; }
function volverACodigoAuth(){ _authBuffer=''; actualizarPuntosAuth(); mostrarVistaAuth('code'); }
async function verificarBackupCodeIngresado(){
  var val=document.getElementById('auth-backup-input').value.trim();
  if(!val)return;
  var res=await verificarCodigoRespaldo(val);
  if(res.ok){
    if(res.restantes<=2){ alert('Advertencia: te quedan '+res.restantes+' codigos de respaldo. Genera nuevos desde Sync > Seguridad cuando puedas.'); }
    onAuthSuccess();
  }else{
    alert('Codigo de respaldo invalido o ya usado.');
  }
}

// --- Configuracion inicial (enrolamiento) ---
function navegadorSoportaAuth(){
  return !!(window.crypto && window.crypto.subtle && window.isSecureContext);
}
async function iniciarConfiguracionAuth(){
  if(!navegadorSoportaAuth()){
    alert('Este navegador no puede generar codigos de autenticacion aqui. Esto pasa si abres el archivo directamente (doble clic) en vez de visitarlo desde una direccion https:// o localhost. Abre la app desde el enlace publicado (Firebase Hosting) e intenta de nuevo.');
    return;
  }
  var pendiente=localStorage.getItem('authTotpPendiente');
  _secretoTemporal = pendiente || generarSecretoTotp();
  if(!pendiente) localStorage.setItem('authTotpPendiente',_secretoTemporal);
  var cuenta='AphillipsStore:tienda';
  var uri='otpauth://totp/'+encodeURIComponent(cuenta)+'?secret='+_secretoTemporal+'&issuer=AphillipsStore&digits=6&period=30';
  var qrEl=document.getElementById('auth-qr');
  qrEl.innerHTML='';
  try{ new QRCode(qrEl,{text:uri,width:170,height:170,colorDark:'#1a1a1a',colorLight:'#ffffff'}); }catch(e){}
  document.getElementById('auth-secreto-manual').textContent=_secretoTemporal.match(/.{1,4}/g).join(' ');
  document.getElementById('auth-setup-input').value='';
  mostrarVistaAuth('setup');
  document.getElementById('auth-overlay').style.display='flex';
}
function generarOtroQrAuth(){
  if(!confirm('Esto genera un QR nuevo. Tendras que escanearlo de nuevo en tu app (borra el anterior si ya lo agregaste). Continuar?'))return;
  localStorage.removeItem('authTotpPendiente');
  iniciarConfiguracionAuth();
}
async function confirmarConfiguracionAuth(){
  var codigo=document.getElementById('auth-setup-input').value.trim();
  if(!/^\d{6}$/.test(codigo)){ alert('Ingresa el codigo de 6 digitos que muestra tu app de autenticacion.'); return; }
  var ok=await totpVerificar(_secretoTemporal,codigo);
  if(!ok){ alert('El codigo no coincide.\n\nRevisa:\n1. Que la hora de tu telefono este en automatico (fecha y hora automatica activada).\n2. Que escaneaste este mismo QR (si cambiaste de app y la pagina se recargo, puede haberse generado uno nuevo; usa "Generar otro QR" y escanea de nuevo).\n3. Que no haya pasado mas de 30-60 segundos desde que viste el codigo.'); return; }
  var lote=await generarLoteCodigosRespaldo(8);
  await guardarAuthSettingsNube(_secretoTemporal,lote.hashes);
  localStorage.removeItem('authTotpPendiente');
  mostrarCodigosRespaldoGenerados(lote.codigos,function(){ onAuthSuccess(); });
}
function mostrarCodigosRespaldoGenerados(codigos,alTerminar){
  document.getElementById('auth-codigos-lista').innerHTML=codigos.map(function(c){
    return '<div style="font-family:\'DM Mono\',monospace;font-size:14px;">'+c+'</div>';
  }).join('');
  window._alTerminarCodigosAuth=alTerminar;
  mostrarVistaAuth('codigos-generados');
}
function confirmarCodigosGuardados(){
  if(!confirm('Confirmas que guardaste tus codigos de respaldo en un lugar seguro? No se volveran a mostrar.'))return;
  if(window._alTerminarCodigosAuth)window._alTerminarCodigosAuth();
}

// --- Gestion desde la pantalla de Sync (ya autenticado) ---
function renderSeguridadAuth(){
  var el=document.getElementById('auth-estado-info');
  if(!el)return;
  if(getTotpSecret()){
    var info=contarBackupInfo();
    el.innerHTML='Codigo de autenticacion activo (guardado en la nube, funciona en todos tus dispositivos) · <strong style="color:var(--black);">'+info.restantes+' de '+info.total+'</strong> codigos de respaldo disponibles.'+(info.restantes<=2?' <span style="color:var(--red);">Te quedan pocos, genera nuevos.</span>':'');
  }else{
    el.textContent='Aun no configurado.';
  }
}
async function generarNuevosBackupCodes(){
  var actual=prompt('Ingresa tu codigo actual de 6 digitos para generar nuevos codigos de respaldo:');
  if(!actual)return;
  var ok=await totpVerificar(getTotpSecret(),actual.trim());
  if(!ok){ alert('Codigo incorrecto.'); return; }
  var lote=await generarLoteCodigosRespaldo(8);
  await guardarAuthSettingsNube(getTotpSecret(),lote.hashes);
  document.getElementById('auth-overlay').style.display='flex';
  mostrarCodigosRespaldoGenerados(lote.codigos,function(){ hideAuth(); renderSeguridadAuth(); });
}
async function reiniciarAuth(){
  var actual=prompt('Para reiniciar, ingresa tu codigo actual de 6 digitos:');
  if(!actual)return;
  var ok=await totpVerificar(getTotpSecret(),actual.trim());
  if(!ok){ alert('Codigo incorrecto.'); return; }
  if(!confirm('Esto invalidara tu codigo actual y tus codigos de respaldo. Tendras que escanear un nuevo QR con tu app de autenticacion. Continuar?'))return;
  await guardarAuthSettingsNube('',[]);
  iniciarConfiguracionAuth();
}
function renderConfigPage(){
  try{ renderEspacioUsado(); }catch(e){}
  try{ renderResumenRespaldo(); }catch(e){}
  try{ renderSeguridadAuth(); }catch(e){}
  try{ renderSyncHistory(); }catch(e){}
}

export { _authBuffer, _secretoTemporal, actualizarPuntosAuth, authCancel, authDelete, authPress, checkAuthCode, confirmarCodigosGuardados, confirmarConfiguracionAuth, generarNuevosBackupCodes, generarOtroQrAuth, hideAuth, iniciarConfiguracionAuth, irABackupCode, mostrarCodigosRespaldoGenerados, mostrarVistaAuth, navegadorSoportaAuth, onAuthSuccess, reiniciarAuth, renderConfigPage, renderSeguridadAuth, showAuth, verificarBackupCodeIngresado, volverACodigoAuth };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { authCancel, authDelete, authPress, confirmarCodigosGuardados, confirmarConfiguracionAuth, generarNuevosBackupCodes, generarOtroQrAuth, irABackupCode, reiniciarAuth, verificarBackupCodeIngresado, volverACodigoAuth });
