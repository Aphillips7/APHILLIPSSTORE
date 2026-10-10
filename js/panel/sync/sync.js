import { db } from '../../firebase.js';
import { COLECCIONES, idAleatorio, state } from '../state.js';
import { syncCatalogoPublico } from './catalogo-publico.js';
import { setSyncStatus } from './estado-sync.js';

let _remoteIds = { inventario: new Set(), movimientos: new Set(), clientes: new Set() };
let _syncTimers = {};
let _firebaseListo = false;
// true la primera vez (cuando hay que conectar los listeners), false si ya estaba conectado
function marcarSyncListo(){ if(_firebaseListo) return false; _firebaseListo = true; return true; }
function detenerSync(){ _firebaseListo = false; }

function scheduleSync(key) {
  clearTimeout(_syncTimers[key]);
  setSyncStatus('Guardando...', 'var(--accent)');
  _syncTimers[key] = setTimeout(function () {
    if (key === 'config') { syncConfig(); } else { syncColeccion(key); }
  }, 1200);
}

function asegurarIds(key){
  state[key].forEach(function(item){
    if(!item.id) item.id=idAleatorio(key.slice(0,3));
    if(!item._ts) item._ts=Date.now();
  });
}

let _lastSynced = { inventario:{}, movimientos:{}, clientes:{} };

async function syncColeccion(key){
  if(!_firebaseListo) return;
  asegurarIds(key);
  setSyncStatus('Sincronizando...','var(--accent)','warn');
  try{
    var coll=db.collection(key);
    var idsActuales=new Set();
    var cache=_lastSynced[key];
    var ops=[];
    state[key].forEach(function(item){
      idsActuales.add(item.id);
      var json=JSON.stringify(item);
      if(cache[item.id]!==json){
        ops.push({tipo:'set',id:item.id,item:item,json:json});
      }
    });
    _remoteIds[key].forEach(function(id){
      if(!idsActuales.has(id)) ops.push({tipo:'delete',id:id});
    });
    _remoteIds[key]=idsActuales;
    for(var i=0;i<ops.length;i+=450){
      var chunk=ops.slice(i,i+450);
      var batch=db.batch();
      chunk.forEach(function(op){
        if(op.tipo==='set'){ batch.set(coll.doc(op.id),op.item); }
        else { batch.delete(coll.doc(op.id)); }
      });
      await batch.commit();
      chunk.forEach(function(op){
        if(op.tipo==='set'){ cache[op.id]=op.json; }
        else { delete cache[op.id]; }
      });
    }
    var now=new Date().toLocaleTimeString('es-MX');
    setSyncStatus('Sincronizado · '+now,'var(--green)','ok');
    localStorage.setItem('lastSync',now);
    if(key==='inventario'){ await syncCatalogoPublico(); }
  }catch(e){
    setSyncStatus('Error de sincronizacion','var(--red)','error');
  }
}

async function syncConfig(){
  if(!_firebaseListo) return;
  setSyncStatus('Guardando...','var(--accent)','warn');
  try{
    await db.collection('config').doc('main').set({
      meta: state.meta,
      tasks: state.tasks,
      weekTasks: state.weekTasks,
      ideas: state.ideas
    });
    var now=new Date().toLocaleTimeString('es-MX');
    setSyncStatus('Sincronizado · '+now,'var(--green)','ok');
    localStorage.setItem('lastSync',now);
  }catch(e){
    setSyncStatus('Error de sincronizacion','var(--red)','error');
  }
}

function forzarSyncTodo(){
  if(!_firebaseListo){ alert('Aun conectando con la nube, espera un momento.'); return; }
  COLECCIONES.forEach(function(key){ syncColeccion(key); });
  syncConfig();
}

export { _firebaseListo, _lastSynced, _remoteIds, _syncTimers, asegurarIds, detenerSync, forzarSyncTodo, marcarSyncListo, scheduleSync, syncColeccion, syncConfig };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { forzarSyncTodo });
