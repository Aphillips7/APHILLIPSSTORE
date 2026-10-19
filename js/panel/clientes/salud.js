// =================== SALUD DE LA TIENDA ===================
// Tarjeta del panel (pagina Clientes) para tener control de lo automatico:
// - Errores de JavaScript que tuvieron los clientes o el panel en los ultimos 7 dias (GET /admin/errores).
// - Vista previa del informe semanal por correo (GET /admin/informe), sin enviarlo.
// - Vista previa de los avisos por correo a clientes (GET /admin/avisos/correo): a quien se le enviaria.
// El informe y los avisos por correo se activan en Cloudflare (INFORME_SEMANAL / AVISOS_CORREO = "1").
import { firebase } from '../../firebase.js';

const API = 'https://api.aphillipsstore.com';
let _errores = null, _error = '', _avisos = null;

function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
async function pedir(ruta, comoTexto){
  var u = firebase.auth().currentUser; if(!u) throw new Error('sin sesion');
  var r = await fetch(API + ruta, { headers: { 'Authorization': 'Bearer ' + await u.getIdToken() } });
  if(comoTexto){ if(!r.ok) throw new Error('Error ' + r.status); return r.text(); }
  var d = {}; try{ d = await r.json(); }catch(e){}
  if(!r.ok) throw new Error(d.error || ('Error ' + r.status));
  return d;
}

async function cargarSalud(){
  try{ _errores = (await pedir('/admin/errores?dias=7')).errores || []; _error = ''; }
  catch(e){ _error = e.message; }
  renderSalud();
}

function renderSalud(){
  var cont = document.getElementById('salud-tienda');
  if(!cont) return;
  var badge = document.getElementById('salud-badge');
  var total = (_errores || []).reduce(function(a, x){ return a + (x.veces || 0); }, 0);
  if(badge){ badge.textContent = total; badge.style.display = total ? '' : 'none'; }
  var h = '<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin:4px 0 8px;">Errores en la página (7 días)</div>';
  if(_error && !_errores) h += '<div style="font-size:12px;color:var(--red);">No se pudieron cargar: ' + esc(_error) + '</div>';
  else if(!_errores) h += '<div style="font-size:12px;color:var(--muted);">Cargando...</div>';
  else if(!_errores.length) h += '<div style="font-size:12px;color:var(--green);margin-bottom:12px;">Sin errores esta semana.</div>';
  else h += _errores.slice(0, 8).map(function(x){
    return '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px;">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;"><b style="min-width:0;overflow-wrap:anywhere;">' + esc(x.mensaje) + '</b><span class="badge" style="flex:none;">' + x.veces + '</span></div>' +
      '<div style="color:var(--muted);margin-top:2px;">' + esc((x.paginas || '').slice(0, 80)) + ' · ' + esc(x.navegadores || '') + (x.fuente ? ' · ' + esc(x.fuente) + ':' + (x.linea || 0) : '') + '</div></div>';
  }).join('');
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">' +
    '<button class="btn btn-sm" onclick="verInformeSemanal()">Ver informe semanal</button>' +
    '<button class="btn btn-sm" onclick="verAvisosCorreo()">Ver avisos por correo pendientes</button></div>';
  if(_avisos){
    h += '<div style="margin-top:12px;font-size:12.5px;">' + (_avisos.length ? _avisos.map(function(a){
      return '<div style="padding:6px 0;border-bottom:1px solid var(--border);">' + esc(a.asunto) + ' <span style="color:var(--muted);">→ ' + esc(a.email) + '</span></div>';
    }).join('') : '<div style="color:var(--muted);">Ningún aviso por enviar ahora mismo.</div>') + '</div>';
  }
  cont.innerHTML = h;
}

// abre el informe tal como llegaria por correo, en una pestana nueva
async function verInformeSemanal(){
  var ventana = window.open('', '_blank');
  try{
    var html = await pedir('/admin/informe', true);
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    if(ventana) ventana.location = url; else window.open(url, '_blank');
  }catch(e){ if(ventana) ventana.close(); alert('No se pudo abrir el informe: ' + e.message); }
}
async function verAvisosCorreo(){
  try{ _avisos = (await pedir('/admin/avisos/correo')).avisos || []; }
  catch(e){ alert('No se pudieron cargar los avisos: ' + e.message); return; }
  renderSalud();
}

export { cargarSalud, renderSalud };
// Usadas desde atributos onclick del HTML generado
Object.assign(window, { verAvisosCorreo, verInformeSemanal });
