// =================== STATE ===================
import { firebase } from '../firebase.js';
import { renderInventario } from './inventario/lista.js';
import { renderResumenRespaldo } from './respaldo.js';
import { renderEspacioUsado } from './sync/espacio.js';
import { scheduleSync } from './sync/sync.js';

const state = {
  tasks: JSON.parse(localStorage.getItem('tasks') || '[]'),
  movimientos: [],
  inventario: [],
  clientes: [],
  metricas: {},
  meta: parseFloat(localStorage.getItem('meta') || '0'),
  weekTasks: JSON.parse(localStorage.getItem('weekTasks') || '{}'),
  ideas: JSON.parse(localStorage.getItem('ideas') || '[]'),
};

const COLECCIONES = ['inventario', 'movimientos', 'clientes'];
function idxCliente(id){ return state.clientes.findIndex(function(x){return x.id===id;}); }
function idxInv(id){ return state.inventario.findIndex(function(x){return x.id===id;}); }
function invNoExiste(){ alert('Ese reloj ya no esta en la lista (pudo actualizarse en otro dispositivo). Refresca e intenta de nuevo.'); try{renderInventario();}catch(e){} }


const OWNER_EMAIL = 'aphillipsstore@gmail.com';

function esPropietario(){
  var u = firebase.auth().currentUser;
  return !!(u && u.email === OWNER_EMAIL);
}

function save(key) {
  if (!COLECCIONES.includes(key)) { localStorage.setItem(key, JSON.stringify(state[key])); }
  if (COLECCIONES.includes(key)) { scheduleSync(key); }
  else { scheduleSync('config'); }
  try{ renderEspacioUsado(); }catch(e){}
  try{ renderResumenRespaldo(); }catch(e){}
}
function saveMeta() {
  localStorage.setItem('meta', state.meta);
  scheduleSync('config');
}

function idAleatorio(prefijo){
  return prefijo+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
}

export { COLECCIONES, esPropietario, idAleatorio, idxCliente, idxInv, invNoExiste, OWNER_EMAIL, save, saveMeta, state };
