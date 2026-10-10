// =================== SESION (LOGIN REAL) ===================
import { firebase } from '../firebase.js';
import { hideAuth } from './auth/auth-overlay.js';
import { limpiarCacheAuth } from './auth/totp.js';
import { esPropietario } from './state.js';
import { iniciarListenersFirebase } from './sync/listeners.js';
import { detenerSync } from './sync/sync.js';

function mostrarLoginGate(){
  var gate=document.getElementById('login-gate');
  if(gate) gate.style.display='flex';
  var loading=document.getElementById('login-loading');
  if(loading) loading.style.display='none';
  var form=document.getElementById('login-form-wrap');
  if(form) form.style.display='block';
}
function ocultarLoginGate(){
  var gate=document.getElementById('login-gate');
  if(gate) gate.style.display='none';
}
function vigilarSesion(){
  firebase.auth().onAuthStateChanged(function(user){
    if(user && !user.isAnonymous){
      ocultarLoginGate();
      var elEmail=document.getElementById('sesion-usuario-email');
      if(elEmail) elEmail.textContent=user.email||'';
      var navEmail=document.getElementById('nav-sesion-email');
      if(navEmail) navEmail.textContent=user.email||'';
      var tabSync=document.getElementById('nav-tab-sync');
      if(tabSync) tabSync.style.display = esPropietario() ? '' : 'none';
      iniciarListenersFirebase();
    }else{
      detenerSync();
      limpiarCacheAuth();
      mostrarLoginGate();
    }
  });
}
async function iniciarSesion(){
  var email=document.getElementById('login-email').value.trim();
  var pass=document.getElementById('login-pass').value;
  var errEl=document.getElementById('login-error');
  errEl.style.display='none';
  if(!email||!pass){ errEl.textContent='Ingresa tu correo y contrasena.'; errEl.style.display='block'; return; }
  var btn=document.getElementById('login-btn');
  btn.disabled=true; btn.textContent='Entrando...';
  try{
    await firebase.auth().signInWithEmailAndPassword(email,pass);
    document.getElementById('login-pass').value='';
  }catch(e){
    var msg='No se pudo iniciar sesion. Verifica tu correo y contrasena.';
    if(e && e.code==='auth/too-many-requests') msg='Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.';
    if(e && e.code==='auth/user-disabled') msg='Esta cuenta esta deshabilitada.';
    if(e && e.code==='auth/invalid-email') msg='El correo no tiene un formato valido.';
    errEl.textContent=msg;
    errEl.style.display='block';
  }
  btn.disabled=false; btn.textContent='Iniciar sesion';
}
async function recuperarContrasenaLogin(){
  var email=document.getElementById('login-email').value.trim();
  if(!email){ alert('Escribe tu correo arriba primero, luego presiona este enlace.'); return; }
  try{
    await firebase.auth().sendPasswordResetEmail(email);
    alert('Te enviamos un enlace para restablecer tu contrasena a '+email+'. Revisa tu bandeja de entrada (y la carpeta de spam).');
  }catch(e){
    alert('No se pudo enviar el correo. Verifica que este bien escrito y que la cuenta exista.');
  }
}
function cerrarSesion(){
  if(!confirm('Cerrar sesion en este dispositivo?'))return;
  if(typeof hideAuth==='function') hideAuth();
  firebase.auth().signOut();
}

export { cerrarSesion, iniciarSesion, mostrarLoginGate, ocultarLoginGate, recuperarContrasenaLogin, vigilarSesion };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { cerrarSesion, iniciarSesion, recuperarContrasenaLogin });
