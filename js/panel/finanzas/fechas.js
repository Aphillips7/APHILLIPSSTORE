// =================== FINANZAS HELPERS ===================
import { state } from '../state.js';

function finParseFecha(str) {
  if (!str) return null;
  var p = str.split('/');
  return p.length === 3 ? new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0])) : null;
}
function finMesKey(str) {
  var d = finParseFecha(str);
  return d ? d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') : '';
}
function finMesLabel(key) {
  if (!key) return '';
  var p = key.split('-');
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(p[1])-1] + ' ' + p[0];
}
function finAllMeses() {
  return [...new Set(state.movimientos.map(m => finMesKey(m.fecha)).filter(Boolean))].sort();
}
function finSetEl(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

export { finAllMeses, finMesKey, finMesLabel, finParseFecha, finSetEl };
