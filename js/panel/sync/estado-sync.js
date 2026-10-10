import { forzarSyncTodo } from './sync.js';

function setSyncStatus(msg,color,tipo){
  var el=document.getElementById('sync-status');if(el){el.textContent=msg;el.style.color=color||'var(--muted)';}
  var nav=document.getElementById('nav-sync-indicator');if(nav){nav.textContent=msg;nav.style.color=color||'rgba(255,255,255,0.55)';nav.style.display='block';}
  var dot=document.getElementById('nav-sync-dot');
  if(dot){ dot.style.background = tipo==='error'?'var(--red)':tipo==='warn'?'var(--accent)':tipo==='ok'?'var(--green)':'var(--muted)'; }
  var btnRetry=document.getElementById('btn-reintentar-sync');
  if(btnRetry) btnRetry.style.display = tipo==='error' ? 'inline-block' : 'none';
  if(tipo==='ok'||tipo==='error'){ registrarEventoSync(msg,tipo); }
}
function registrarEventoSync(msg,tipo){
  try{
    var hist=JSON.parse(localStorage.getItem('syncHistory')||'[]');
    hist.unshift({hora:new Date().toLocaleTimeString('es-MX'),msg:msg,tipo:tipo||'info'});
    hist=hist.slice(0,5);
    localStorage.setItem('syncHistory',JSON.stringify(hist));
    renderSyncHistory();
  }catch(e){}
}
function renderSyncHistory(){
  var cont=document.getElementById('sync-history-lista');
  if(!cont)return;
  var hist=JSON.parse(localStorage.getItem('syncHistory')||'[]');
  if(!hist.length){ cont.innerHTML='<div style="font-size:12px;color:var(--muted);">Sin eventos recientes.</div>'; return; }
  cont.innerHTML=hist.map(function(h){
    var color=h.tipo==='error'?'var(--red)':h.tipo==='ok'?'var(--green)':'var(--muted)';
    return '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border);"><span style="color:'+color+';">'+h.msg+'</span><span style="color:var(--muted);font-family:\'DM Mono\',monospace;">'+h.hora+'</span></div>';
  }).join('');
}
function reintentarSync(){
  if(!navigator.onLine){ alert('Tu dispositivo no tiene conexion a internet en este momento.'); return; }
  forzarSyncTodo();
}

export { registrarEventoSync, reintentarSync, renderSyncHistory, setSyncStatus };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { reintentarSync });
