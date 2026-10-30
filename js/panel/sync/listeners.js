import { firebase } from '../../firebase.js';
import { renderConfigPage } from '../auth/auth-overlay.js';
import { renderCatalogoAdmin } from '../catalogo-admin.js';
import { poblarSelectClientes, renderClientes } from '../clientes/clientes.js';
import { cargarCuentasWeb, renderCuentasWeb } from '../clientes/cuentas-web.js';
import { cargarPedidosWeb, renderPedidosWeb } from '../ventas/pedidos-web.js';
import { cargarBoletin } from '../clientes/boletin.js';
import { cargarSalud } from '../clientes/salud.js';
import { renderContenido, renderIdeas } from '../contenido.js';
import { renderAnalisis } from '../finanzas/analisis.js';
import { renderFinanzas } from '../finanzas/finanzas.js';
import { renderHistorial } from '../finanzas/historial.js';
import { renderPickerCompra } from '../finanzas/registrar-compra.js';
import { renderPicker } from '../finanzas/registrar-venta.js';
import { renderResumen } from '../finanzas/resumen.js';
import { renderChecklist, renderInicio } from '../inicio.js';
import { renderFotosAntiguas } from '../inventario/fotos.js';
import { renderInventario } from '../inventario/lista.js';
import { cargarRespaldosNube } from '../respaldo.js';
import { state } from '../state.js';
import { marcarInventarioCargado, syncCatalogoPublico } from './catalogo-publico.js';
import { renderEspacioUsado } from './espacio.js';
import { iniciarNube } from './nube.js';
import { marcarSyncListo } from './sync.js';

function refrescarVista(key){
  try{ renderInicio(); }catch(e){}
  try{ renderEspacioUsado(); }catch(e){}
  if(key==='inventario'){
    try{ renderInventario(); }catch(e){}
    try{ renderCatalogoAdmin(); }catch(e){}
    try{ renderPicker(); }catch(e){}
    try{ renderPickerCompra(); }catch(e){}
    try{ renderClientes(); }catch(e){}
    try{ syncCatalogoPublico(); }catch(e){}
    try{ renderFotosAntiguas(); }catch(e){}
    try{ renderCuentasWeb(); }catch(e){}
    try{ renderPedidosWeb(); }catch(e){}
  }else if(key==='movimientos'){
    try{ renderHistorial(); }catch(e){}
    try{ renderResumen(); }catch(e){}
    try{ renderAnalisis(); }catch(e){}
    try{ renderFinanzas(); }catch(e){}
    try{ renderClientes(); }catch(e){}
  }else if(key==='clientes'){
    try{ renderClientes(); }catch(e){}
    try{ renderCuentasWeb(); }catch(e){}
    try{ renderPedidosWeb(); }catch(e){}
    try{ poblarSelectClientes('fin-cliente'); if(window.elegirClienteFin) window.elegirClienteFin((document.getElementById('fin-cliente') || {}).value || ''); }catch(e){}
    try{ poblarSelectClientes('reserva-cliente'); }catch(e){}
  }else if(key==='config'){
    try{ renderResumen(); }catch(e){}
    try{ renderChecklist(); }catch(e){}
    try{ renderIdeas(); }catch(e){}
    try{ renderContenido(); }catch(e){}
    try{ renderConfigPage(); }catch(e){}
  }
}

// Arranque de los datos del panel cuando hay sesion: todo viene de Cloudflare (ver nube.js).
// (El nombre se conserva porque lo llama sesion.js.)
function iniciarListenersFirebase(){
  if(!marcarSyncListo()) return;
  iniciarNube({ refrescarVista: refrescarVista, refrescarVistaCompleta: refrescarVistaCompleta, marcarInventarioCargado: marcarInventarioCargado });
  cargarMetricasCloudflare();
  try{ cargarRespaldosNube(); }catch(e){}
  try{ cargarCuentasWeb(); }catch(e){}
  try{ cargarPedidosWeb(); }catch(e){}
  try{ cargarBoletin(); }catch(e){}
  try{ cargarSalud(); }catch(e){}
  if(!_timerMetricas) _timerMetricas=setInterval(function(){ if(document.hidden) return; cargarMetricasCloudflare(); try{ cargarCuentasWeb(); }catch(e){} try{ cargarPedidosWeb(); }catch(e){} try{ cargarBoletin(); }catch(e){} }, 120000);
}

// Metricas del catalogo (vistas, aperturas, clics), guardadas en Cloudflare (D1).
var _timerMetricas=null, _importando=false;
function mostrarMetricas(origen){
  var m={};
  Object.keys(origen||{}).forEach(function(id){
    var b=origen[id]||{};
    m[id]={ vistas:b.vistas||0, aperturas:b.aperturas||0, clics:b.clics||0, _ultima:b._ultima||0 };
  });
  state.metricas=m;
  try{ renderCatalogoAdmin(); }catch(e){}
}
// Una sola vez: las metricas antiguas que quedaron en Firestore (metricas_catalogo) se suman a las
// de Cloudflare. Se carga el SDK de Firestore solo para esto; el Worker solo acepta importar una vez.
function cargarScript(src){
  return new Promise(function(res, rej){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
}
async function importarMetricasAntiguas(token){
  if(_importando) return; _importando=true;
  try{
    if(!firebase.firestore) await cargarScript('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore-compat.js');
    var snap=await firebase.firestore().collection('metricas_catalogo').get();
    var antiguas={};
    snap.forEach(function(doc){ antiguas[doc.id]=doc.data(); });
    var r=await fetch('https://api.aphillipsstore.com/metricas/importar',{ method:'POST', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}, body: JSON.stringify({ metricas: antiguas }) });
    if(r.ok) cargarMetricasCloudflare();
  }catch(e){ /* se reintenta la proxima vez que se abra el panel */ }
}
async function cargarMetricasCloudflare(){
  try{
    var usuario=firebase.auth().currentUser; if(!usuario) return;
    var token=await usuario.getIdToken();
    var r=await fetch('https://api.aphillipsstore.com/metricas',{headers:{'Authorization':'Bearer '+token}});
    if(!r.ok) return;
    var d=await r.json();
    mostrarMetricas(d.metricas);
    if(d.importado===false) importarMetricasAntiguas(token);
  }catch(e){ /* sin conexion: se reintenta despues */ }
}

function refrescarVistaCompleta(){
  ['inventario','movimientos','clientes','config'].forEach(function(k){ try{ refrescarVista(k); }catch(e){} });
}

export { iniciarListenersFirebase, refrescarVista, refrescarVistaCompleta };
