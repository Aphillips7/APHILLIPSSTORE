import { db } from '../../firebase.js';
import { renderConfigPage } from '../auth/auth-overlay.js';
import { renderCatalogoAdmin } from '../catalogo-admin.js';
import { poblarSelectClientes, renderClientes } from '../clientes/clientes.js';
import { renderContenido, renderIdeas } from '../contenido.js';
import { renderAnalisis } from '../finanzas/analisis.js';
import { renderFinanzas } from '../finanzas/finanzas.js';
import { renderHistorial } from '../finanzas/historial.js';
import { renderPickerCompra } from '../finanzas/registrar-compra.js';
import { renderPicker } from '../finanzas/registrar-venta.js';
import { renderResumen } from '../finanzas/resumen.js';
import { renderChecklist, renderInicio } from '../inicio.js';
import { renderInventario } from '../inventario/lista.js';
import { COLECCIONES, state } from '../state.js';
import { cargarCatalogoPublicoRemoto, marcarInventarioCargado, syncCatalogoPublico } from './catalogo-publico.js';
import { renderEspacioUsado } from './espacio.js';
import { setSyncStatus } from './estado-sync.js';
import { _lastSynced, _remoteIds, marcarSyncListo } from './sync.js';

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
  }else if(key==='movimientos'){
    try{ renderHistorial(); }catch(e){}
    try{ renderResumen(); }catch(e){}
    try{ renderAnalisis(); }catch(e){}
    try{ renderFinanzas(); }catch(e){}
    try{ renderClientes(); }catch(e){}
  }else if(key==='clientes'){
    try{ renderClientes(); }catch(e){}
    try{ poblarSelectClientes('fin-cliente'); }catch(e){}
    try{ poblarSelectClientes('reserva-cliente'); }catch(e){}
  }else if(key==='config'){
    try{ renderResumen(); }catch(e){}
    try{ renderChecklist(); }catch(e){}
    try{ renderIdeas(); }catch(e){}
    try{ renderContenido(); }catch(e){}
    try{ renderConfigPage(); }catch(e){}
  }
}

function iniciarListenersFirebase(){
  if(!marcarSyncListo()) return;

  COLECCIONES.forEach(function(key){
    db.collection(key).onSnapshot(function(snap){
      var items=[];
      var ids=new Set();
      var cache=_lastSynced[key];
      snap.forEach(function(doc){
        var data=doc.data();
        data.id=doc.id;
        items.push(data);
        ids.add(doc.id);
        cache[doc.id]=JSON.stringify(data);
      });
      Object.keys(cache).forEach(function(id){ if(!ids.has(id)) delete cache[id]; });
      items.sort(function(a,b){return (b._ts||0)-(a._ts||0);});
      _remoteIds[key]=ids;
      state[key]=items;
      // Solo una lectura confirmada por el servidor sirve para decidir que despublicar
      if(key==='inventario' && !(snap.metadata && snap.metadata.fromCache)) marcarInventarioCargado();
      refrescarVista(key);
    }, function(err){
      // permission-denied = las reglas de Firestore rechazan esta cuenta (no es la del admin)
      if(err && err.code==='permission-denied') setSyncStatus('Sin permiso: esta cuenta no es la del administrador','var(--red)','error');
      else setSyncStatus('Sin conexion','var(--red)','error');
    });
  });

  // Lo que hay publicado de verdad en el catalogo (para limpiar lo que ya no debe verse)
  db.collection('catalogo_publico').onSnapshot(function(snap){
    if(snap.metadata && snap.metadata.fromCache) return;
    cargarCatalogoPublicoRemoto(snap);
    syncCatalogoPublico();
  }, function(){ /* el catalogo publico es un extra; si falla no afecta el panel */ });

  db.collection('config').doc('main').onSnapshot(function(doc){
    if(!doc.exists) return;
    var data=doc.data();
    if(typeof data.meta==='number'){ state.meta=data.meta; localStorage.setItem('meta',state.meta); }
    if(Array.isArray(data.tasks)){ state.tasks=data.tasks; localStorage.setItem('tasks',JSON.stringify(state.tasks)); }
    if(data.weekTasks){ state.weekTasks=data.weekTasks; localStorage.setItem('weekTasks',JSON.stringify(state.weekTasks)); }
    if(Array.isArray(data.ideas)){ state.ideas=data.ideas; localStorage.setItem('ideas',JSON.stringify(state.ideas)); }
    refrescarVista('config');
  }, function(){
    setSyncStatus('Sin conexion','var(--red)','error');
  });

  db.collection('metricas_catalogo').onSnapshot(function(snap){
    var m={};
    snap.forEach(function(doc){ m[doc.id]=doc.data(); });
    state.metricas=m;
    try{ renderCatalogoAdmin(); }catch(e){}
  }, function(){ /* las metricas son un extra; si fallan no afectan el resto del panel */ });

  setSyncStatus('Conectado','var(--green)','ok');
}

function refrescarVistaCompleta(){
  ['inventario','movimientos','clientes','config'].forEach(function(k){ try{ refrescarVista(k); }catch(e){} });
}

export { iniciarListenersFirebase, refrescarVista, refrescarVistaCompleta };
