// =================== BOLETIN (suscriptores del catalogo) ===================
// Lista de quienes se suscribieron desde "Suscribete al boletin" en el pie de la tienda (GET /admin/boletin).
// Se pueden copiar los correos activos o descargarlos en CSV para usarlos en un servicio de correo masivo.
import { firebase } from '../../firebase.js';

const API = 'https://api.aphillipsstore.com';
let _subs = null, _error = '';

function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function fecha(ms){ return ms ? new Date(ms).toLocaleDateString('es-PA', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

async function cargarBoletin(){
  try{
    var u = firebase.auth().currentUser; if(!u) return;
    var r = await fetch(API + '/admin/boletin', { headers: { 'Authorization': 'Bearer ' + await u.getIdToken() } });
    var d = {}; try{ d = await r.json(); }catch(e){}
    if(!r.ok) throw new Error(d.error || ('Error ' + r.status));
    _subs = d.suscriptores || []; _error = '';
  }catch(e){ _error = e.message; }
  renderBoletin();
}
function activos(){ return (_subs || []).filter(function(s){ return s.activo; }); }

function renderBoletin(){
  var cont = document.getElementById('boletin-subs');
  if(!cont) return;
  if(_error && !_subs){ cont.innerHTML = '<div style="font-size:12px;color:var(--red);">No se pudo cargar el boletín: ' + esc(_error) + '</div>'; return; }
  if(!_subs){ cont.innerHTML = '<div style="font-size:12px;color:var(--muted);">Cargando...</div>'; return; }
  var act = activos(), bajas = _subs.length - act.length;
  var badge = document.getElementById('boletin-badge');
  if(badge){ badge.textContent = act.length; badge.style.display = act.length ? '' : 'none'; }
  var h = '<div style="font-size:13px;margin-bottom:10px;"><b>' + act.length + '</b> suscrito' + (act.length === 1 ? '' : 's') + (bajas ? ' · <span style="color:var(--muted);">' + bajas + ' dado' + (bajas === 1 ? '' : 's') + ' de baja</span>' : '') + '</div>';
  if(act.length) h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' +
    '<button class="btn btn-sm" onclick="copiarBoletin()">Copiar correos</button>' +
    '<button class="btn btn-sm" onclick="descargarBoletin()">Descargar CSV</button></div>';
  if(!_subs.length) h += '<div style="font-size:12px;color:var(--muted);">Todavía nadie se suscribió.</div>';
  else h += _subs.slice(0, 200).map(function(s){
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;' + (s.activo ? '' : 'opacity:.5;') + '">' +
      '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;">' + esc(s.email) + (s.nombre ? ' <span style="color:var(--muted);">· ' + esc(s.nombre) + '</span>' : '') + '</span>' +
      '<span style="flex:none;font-size:12px;color:var(--muted);">' + (s.activo ? fecha(s.creado) : 'de baja') + '</span></div>';
  }).join('');
  cont.innerHTML = h;
}
async function copiarBoletin(){
  var txt = activos().map(function(s){ return s.email; }).join(', ');
  try{ await navigator.clipboard.writeText(txt); alert('Copiados ' + activos().length + ' correos.'); }
  catch(e){ prompt('Copia los correos:', txt); }
}
function descargarBoletin(){
  var filas = [['correo', 'nombre', 'desde']].concat(activos().map(function(s){ return [s.email, s.nombre || '', new Date(s.creado).toISOString().slice(0, 10)]; }));
  var csv = filas.map(function(f){ return f.map(function(v){ return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'boletin-aphillips-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

export { cargarBoletin, renderBoletin };
// Usadas desde atributos onclick del HTML
Object.assign(window, { copiarBoletin, descargarBoletin });
