// =================== DATOS DEL PANEL EN CLOUDFLARE ===================
// Cloudflare (D1, via https://api.aphillipsstore.com/datos) es la fuente principal del panel:
// - Al entrar se cargan los datos guardados en este dispositivo (IndexedDB) y despues se piden a
//   Cloudflare solo los cambios desde la ultima vez. Cada 10 s (con la pantalla visible) se vuelven
//   a pedir, asi se ven los cambios hechos en otro dispositivo.
// - save() -> se compara lo que hay en pantalla con lo ultimo que confirmo Cloudflare (_base) y se
//   envian solo las diferencias. Sin internet, los cambios quedan guardados en el dispositivo y se
//   envian solos al volver la conexion.
// - Si llega de otro dispositivo un cambio de un documento que aqui tiene cambios sin enviar, se
//   conserva el de aqui (se envia despues y queda como el ultimo).
import { firebase } from '../../firebase.js';
import { COLECCIONES, state } from '../state.js';
import { setSyncStatus } from './estado-sync.js';

const API_DATOS = 'https://api.aphillipsstore.com/datos';
const CADA_MS = 10000;
const LOTE = 150;
const COLS = ['inventario', 'movimientos', 'clientes', 'config', 'authSettings'];

// Lo que Cloudflare tiene confirmado: docs[col][id] = JSON canonico del documento
var _base = baseVacia();
var _hooks = {};
var _activo = false, _timer = null, _ciclo = null;
var _enviando = {}, _repetir = {};
var _ultimaOk = null, _error = '';
var _resolverListo, _listo = new Promise(function(r){ _resolverListo = r; });

function baseVacia(){
  var docs = {}; COLS.forEach(function(c){ docs[c] = {}; });
  return { version: 0, docs: docs };
}

// ---------- utilidades ----------
function canonico(v){
  if(Array.isArray(v)) return '['+v.map(canonico).join(',')+']';
  if(v && typeof v==='object'){
    return '{'+Object.keys(v).sort().filter(function(k){ return v[k]!==undefined; })
      .map(function(k){ return JSON.stringify(k)+':'+canonico(v[k]); }).join(',')+'}';
  }
  return JSON.stringify(v===undefined?null:v);
}
function conflicto(msg){ var e = new Error(msg); e.conflicto = true; return e; }
// cierres solo viaja si hay alguno (asi la config de siempre no cambia de huella y no se reenvia)
function hayCierres(c){ return c && typeof c === 'object' && Object.keys(c).length > 0; }
function configActual(){ return { meta: state.meta, tasks: state.tasks, weekTasks: state.weekTasks, ideas: state.ideas, cierres: hayCierres(state.cierres) ? state.cierres : undefined }; }
function normalizarConfig(d){ d = d || {}; return { meta: d.meta, tasks: d.tasks, weekTasks: d.weekTasks, ideas: d.ideas, cierres: hayCierres(d.cierres) ? d.cierres : undefined }; }
function conId(datos, id){ var o = Object.assign({}, datos); o.id = id; return o; }
function ordenar(col){ state[col].sort(function(a,b){ return (b._ts||0)-(a._ts||0); }); }

async function pedir(ruta, opciones){
  var usuario = firebase.auth().currentUser;
  if(!usuario) throw new Error('sin sesion');
  var token = await usuario.getIdToken();
  opciones = opciones || {};
  opciones.headers = Object.assign({ 'Authorization': 'Bearer '+token }, opciones.headers || {});
  var r = await fetch(API_DATOS+ruta, opciones);
  var d = {}; try{ d = await r.json(); }catch(e){}
  if(r.status === 409 && d.conflicto) throw conflicto(d.error);
  if(!r.ok) throw new Error(d.error || ('Error '+r.status));
  return d;
}

// ---------- guardado en el dispositivo (IndexedDB) ----------
var _idb = null;
function abrirIdb(){
  if(_idb) return _idb;
  _idb = new Promise(function(res, rej){
    var r = indexedDB.open('aphillips-panel', 1);
    r.onupgradeneeded = function(){ r.result.createObjectStore('kv'); };
    r.onsuccess = function(){ res(r.result); };
    r.onerror = function(){ rej(r.error); };
  });
  return _idb;
}
async function idbLeer(clave){
  var d = await abrirIdb();
  return new Promise(function(res, rej){
    var q = d.transaction('kv').objectStore('kv').get(clave);
    q.onsuccess = function(){ res(q.result); }; q.onerror = function(){ rej(q.error); };
  });
}
async function idbGuardar(clave, valor){
  var d = await abrirIdb();
  return new Promise(function(res, rej){
    var t = d.transaction('kv', 'readwrite');
    t.objectStore('kv').put(valor, clave);
    t.oncomplete = function(){ res(); }; t.onerror = function(){ rej(t.error); };
  });
}
var _timerLocal = null;
function guardarLocal(){
  clearTimeout(_timerLocal);
  _timerLocal = setTimeout(function(){
    var u = firebase.auth().currentUser; if(!u) return;
    idbGuardar('datos', {
      uid: u.uid, base: _base, config: configActual(),
      local: { inventario: state.inventario, movimientos: state.movimientos, clientes: state.clientes }
    }).catch(function(){ /* sin IndexedDB (modo privado): solo se pierde el modo sin internet */ });
  }, 400);
}
async function borrarDatosLocales(){
  try{ if(_idb){ (await _idb).close(); _idb = null; } }catch(e){}
  await new Promise(function(res){
    try{ var r = indexedDB.deleteDatabase('aphillips-panel'); r.onsuccess = r.onerror = r.onblocked = function(){ res(); }; }
    catch(e){ res(); }
  });
}

// ---------- recibir cambios ----------
function aplicarDoc(d, cambiadas){
  var col = d.col, id = d.id;
  if(!_base.docs[col]) _base.docs[col] = {};
  if(col === 'authSettings'){
    if(d.borrado) delete _base.docs[col][id]; else _base.docs[col][id] = canonico(d.datos);
    return;
  }
  if(col === 'config'){
    if(id !== 'main') return;
    var nuevoCfg = d.borrado ? null : canonico(normalizarConfig(d.datos));
    // si nunca se sincronizo en este dispositivo, manda lo de la nube (no lo que habia en localStorage)
    var pendienteCfg = _base.docs.config.main !== undefined && canonico(configActual()) !== _base.docs.config.main;
    if(nuevoCfg === null) delete _base.docs.config.main; else _base.docs.config.main = nuevoCfg;
    if(!pendienteCfg && !d.borrado){
      var c = normalizarConfig(d.datos);
      if(typeof c.meta === 'number'){ state.meta = c.meta; localStorage.setItem('meta', state.meta); }
      if(Array.isArray(c.tasks)){ state.tasks = c.tasks; localStorage.setItem('tasks', JSON.stringify(state.tasks)); }
      if(c.weekTasks){ state.weekTasks = c.weekTasks; localStorage.setItem('weekTasks', JSON.stringify(state.weekTasks)); }
      if(Array.isArray(c.ideas)){ state.ideas = c.ideas; localStorage.setItem('ideas', JSON.stringify(state.ideas)); }
      state.cierres = c.cierres || {}; localStorage.setItem('cierres', JSON.stringify(state.cierres));
      cambiadas.config = true;
    }
    return;
  }
  if(COLECCIONES.indexOf(col) === -1) return;
  var nuevo = d.borrado ? null : canonico(conId(d.datos, id));
  var anterior = _base.docs[col][id];
  var idx = state[col].findIndex(function(x){ return x.id === id; });
  var local = idx === -1 ? null : canonico(state[col][idx]);
  var pendiente = local !== (anterior === undefined ? null : anterior);   // cambio de aqui sin enviar
  if(nuevo === null) delete _base.docs[col][id]; else _base.docs[col][id] = nuevo;
  if(pendiente || local === nuevo) return;
  if(nuevo === null) state[col].splice(idx, 1);
  else if(idx === -1) state[col].push(JSON.parse(nuevo));
  else state[col][idx] = JSON.parse(nuevo);
  cambiadas[col] = true;
}

async function recibir(){
  var cambiadas = {};
  for(var vueltas = 0; vueltas < 50; vueltas++){
    var r = await pedir('?desde='+_base.version);
    (r.docs || []).forEach(function(d){ aplicarDoc(d, cambiadas); });
    if(typeof r.version === 'number' && r.version > _base.version) _base.version = r.version;
    if(r.completo !== false) break;
  }
  Object.keys(cambiadas).forEach(function(col){
    if(col !== 'config') ordenar(col);
    try{ _hooks.refrescarVista && _hooks.refrescarVista(col); }catch(e){}
  });
  guardarLocal();
}

// ---------- enviar cambios ----------
async function enviarOps(ops){
  for(var i = 0; i < ops.length; i += LOTE){
    var parte = ops.slice(i, i+LOTE);
    await pedir('/lote', { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ops: parte.map(function(op){ return op.borrar ? { col: op.col, id: op.id, borrar: true } : { col: op.col, id: op.id, json: op.json }; }) }) });
    parte.forEach(function(op){
      if(op.borrar) delete _base.docs[op.col][op.id]; else _base.docs[op.col][op.id] = op.json;
    });
  }
}
function opsColeccion(col){
  var ops = [], ids = new Set(), base = _base.docs[col];
  state[col].forEach(function(item){
    if(!item || !item.id) return;
    ids.add(item.id);
    var json = canonico(item);
    if(base[item.id] !== json) ops.push({ col: col, id: item.id, json: json, obj: item });
  });
  Object.keys(base).forEach(function(id){ if(!ids.has(id)) ops.push({ col: col, id: id, borrar: true }); });
  return ops;
}
function opsConfig(){
  var cfg = configActual(), json = canonico(cfg);
  return _base.docs.config.main === json ? [] : [{ col: 'config', id: 'main', json: json, obj: cfg }];
}
// col: una de COLECCIONES o 'config'
async function enviar(col){
  guardarLocal();
  if(_enviando[col]){ _repetir[col] = true; return; }
  if(!_activo) return;
  var ops = col === 'config' ? opsConfig() : opsColeccion(col);
  if(!ops.length){ estadoOk(); return; }
  if(!navigator.onLine){ estadoPendiente(); return; }
  _enviando[col] = true;
  setSyncStatus('Sincronizando...', 'var(--amber)', 'warn');
  try{
    await enviarOps(ops);
    estadoOk();
  }catch(e){
    _error = e.message || String(e);
    estadoPendiente();
  }
  _enviando[col] = false;
  guardarLocal();
  if(_repetir[col]){ _repetir[col] = false; await enviar(col); }
}
async function enviarTodo(){
  for(var i = 0; i < COLECCIONES.length; i++) await enviar(COLECCIONES[i]);
  await enviar('config');
}
function hayPendientes(){
  return COLECCIONES.some(function(c){ return opsColeccion(c).length; }) || opsConfig().length > 0;
}

// ---------- estado en pantalla ----------
function estadoOk(){
  _ultimaOk = new Date(); _error = '';
  var hora = _ultimaOk.toLocaleTimeString('es-MX');
  setSyncStatus('Sincronizado · '+hora, 'var(--green)', 'ok');
  localStorage.setItem('lastSync', hora);
  renderEstadoNube();
}
function estadoPendiente(){
  setSyncStatus(navigator.onLine ? 'Cambios sin enviar (se reintenta solo)' : 'Sin conexion: cambios guardados en este dispositivo', 'var(--red)', 'error');
  renderEstadoNube();
}
function renderEstadoNube(){
  var el = document.getElementById('espejo-cf-texto');
  if(!el) return;
  var n = 0; COLS.forEach(function(c){ n += Object.keys(_base.docs[c] || {}).length; });
  if(_error || !navigator.onLine){
    el.style.color = 'var(--red)';
    el.textContent = (navigator.onLine ? 'No se pudo sincronizar ('+_error+')' : 'Sin conexion') + '. Los cambios se guardan en este dispositivo y se envian solos.';
  }else if(_ultimaOk){
    el.style.color = 'var(--green)';
    el.textContent = 'Al dia · '+n+' documentos · '+_ultimaOk.toLocaleTimeString('es-MX');
  }else{
    el.style.color = 'var(--muted)'; el.textContent = 'Conectando...';
  }
}

// ---------- ciclo ----------
async function cicloUnaVez(){
  if(_ciclo) return _ciclo;
  _ciclo = (async function(){
    try{
      await recibir();
      if(hayPendientes()) await enviarTodo(); else estadoOk();
      if(_hooks.marcarInventarioCargado){ _hooks.marcarInventarioCargado(); try{ _hooks.refrescarVista('inventario'); }catch(e){} _hooks.marcarInventarioCargado = null; }
      _resolverListo();
    }catch(e){
      _error = e.message || String(e);
      estadoPendiente();
    }
  })();
  try{ await _ciclo; } finally { _ciclo = null; }
}
function tic(){ if(_activo && !document.hidden && navigator.onLine) cicloUnaVez(); }

async function iniciarNube(hooks){
  if(_activo) return;
  _activo = true;
  _hooks = hooks || {};
  var u = firebase.auth().currentUser;
  try{
    var guardado = await idbLeer('datos');
    if(guardado && u && guardado.uid === u.uid && guardado.base && guardado.local){
      _base = guardado.base;
      COLS.forEach(function(c){ if(!_base.docs[c]) _base.docs[c] = {}; });
      COLECCIONES.forEach(function(c){ if(Array.isArray(guardado.local[c])) state[c] = guardado.local[c]; });
      var c = guardado.config || {};
      if(typeof c.meta === 'number') state.meta = c.meta;
      if(Array.isArray(c.tasks)) state.tasks = c.tasks;
      if(c.weekTasks) state.weekTasks = c.weekTasks;
      if(Array.isArray(c.ideas)) state.ideas = c.ideas;
      if(hayCierres(c.cierres)) state.cierres = c.cierres;
      try{ _hooks.refrescarVistaCompleta && _hooks.refrescarVistaCompleta(); }catch(e){}
      _resolverListo();
    }
  }catch(e){ /* sin IndexedDB: se carga todo de Cloudflare */ }
  renderEstadoNube();
  await cicloUnaVez();
  clearInterval(_timer);
  _timer = setInterval(tic, CADA_MS);
}
function detenerNube(){ _activo = false; clearInterval(_timer); _timer = null; }
document.addEventListener('visibilitychange', tic);
window.addEventListener('online', tic);
window.addEventListener('offline', function(){ if(_activo) estadoPendiente(); });

// ---------- cambio de estado sin venta doble ----------
async function cambiarEstadoNube(id, estadoEsperado, cambios, quitar){
  if(!navigator.onLine) throw conflicto('Sin conexion a internet. Para evitar vender o reservar dos veces el mismo reloj, esta operacion necesita confirmar con la nube. Intentalo cuando tengas internet.');
  var r = await pedir('/estado', { method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ id: id, estadoEsperado: estadoEsperado, cambios: cambios, quitar: quitar || [] }) });
  var final = conId(r.datos, id);
  _base.docs.inventario[id] = canonico(final);
  guardarLocal();
}

// ---------- documentos sueltos (codigo de seguridad) ----------
function esperarDatos(ms){
  return Promise.race([_listo, new Promise(function(r){ setTimeout(r, ms || 8000); })]);
}
// undefined = no se pudo saber (sin datos de Cloudflare); null = no existe
async function leerDocNube(col, id){
  await esperarDatos();
  if(!_ultimaOk && !Object.keys(_base.docs[col] || {}).length) return undefined;
  var t = _base.docs[col] && _base.docs[col][id];
  return t ? JSON.parse(t) : null;
}
async function escribirDocNube(col, id, datos){
  var json = canonico(datos);
  await pedir('/lote', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ops: [{ col: col, id: id, json: json }] }) });
  _base.docs[col][id] = json;
  guardarLocal();
}

export { borrarDatosLocales, cambiarEstadoNube, detenerNube, enviar, escribirDocNube, iniciarNube, leerDocNube, renderEstadoNube };
