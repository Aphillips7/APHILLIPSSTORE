// Envio de cambios del panel a Cloudflare (ver nube.js).
// save() -> scheduleSync(key) -> 1,2 s despues se envian solo las diferencias.
import { idAleatorio, state } from '../state.js';
import { syncCatalogoPublico } from './catalogo-publico.js';
import { setSyncStatus } from './estado-sync.js';
import { detenerNube, enviar } from './nube.js';

let _syncTimers = {};
let _syncListo = false;
// true la primera vez (cuando hay que arrancar los datos), false si ya estaba arrancado
function marcarSyncListo(){ if(_syncListo) return false; _syncListo = true; return true; }
function detenerSync(){ _syncListo = false; detenerNube(); }

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

async function syncColeccion(key){
  if(!_syncListo) return;
  asegurarIds(key);
  await enviar(key);
  if(key==='inventario'){ await syncCatalogoPublico(); }
}

async function syncConfig(){
  if(!_syncListo) return;
  await enviar('config');
}

function forzarSyncTodo(){
  if(!_syncListo){ alert('Aun conectando con la nube, espera un momento.'); return; }
  ['inventario','movimientos','clientes'].forEach(function(key){ syncColeccion(key); });
  syncConfig();
}

export { _syncListo, _syncTimers, asegurarIds, detenerSync, forzarSyncTodo, marcarSyncListo, scheduleSync, syncColeccion, syncConfig };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { forzarSyncTodo });
